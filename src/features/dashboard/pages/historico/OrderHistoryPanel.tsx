import React, { useEffect, useMemo, useState } from "react";
import {
  CircleDollarSign,
  Clock,
  Download,
  Eye,
  History,
  Package,
  Printer,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  FilterLine,
  FilterLineDateRange,
  FilterLineItem,
  FilterLineSearch,
  FilterLineSection,
  FilterLineSegmented,
  FilterPopover,
  GridTable,
  IconButton,
  Input,
  Modal,
  ModalFooter,
  PageWrapper,
  PaymentBadge,
  Select,
  SectionTitle,
  StatCard,
  StatGrid,
  usePagination,
  useToast,
} from "../../../../components";
import { apiFetch, apiJson } from "../../../../lib/api";
import { Order, Tenant, dineInOrderLabel, type DanfeData } from "../../../../types";
import { printReceiptPdf, printDanfePdf, type ReceiptData } from "../../../../lib/receipt";

// selectedExtras (JSON de ProductExtra[]) inclui tanto os adicionais escolhidos manualmente
// quanto os aplicados automaticamente (ex: embalagem em pedidos para viagem) — esses últimos
// nunca entram no campo "notes" (que só é montado no momento da escolha manual no carrinho),
// então sem ler selectedExtras aqui o adicional automático nunca aparece na notinha.
function extrasLabelsFromOrderItem(i: any): string[] {
  if (!i.selectedExtras) return [];
  try {
    const extras: Array<{ label: string; price?: number }> = JSON.parse(i.selectedExtras);
    return extras.map((extra) => extra.price && extra.price > 0 ? `${extra.label} (+${fmt(extra.price)})` : extra.label);
  } catch {
    return [];
  }
}

// Reconstrói os dados da notinha a partir de um pedido já salvo — usado pra reimprimir
// direto do Histórico, sem precisar abrir o PDV (mesma lógica de OrdersList.tsx).
function buildReceiptDataFromOrder(order: Order, tenant: Tenant): ReceiptData {
  const items = (order.items || []).map((i: any) => ({
    quantity: i.quantity,
    name: i.productVariant?.name ? `${i.product?.name || ""} (${i.productVariant.name})` : (i.product?.name || ""),
    price: i.price,
    notes: i.notes || undefined,
    extras: extrasLabelsFromOrderItem(i),
  }));
  const orderSubtotal = items.reduce((acc: number, i: any) => acc + i.price * i.quantity, 0);
  let paymentDetail: { amountReceived?: number; change?: number; splits?: Array<{ method: string; amount: number; cardBrand?: string; installments?: number }> } = {};
  try { paymentDetail = order.paymentDetail ? JSON.parse(order.paymentDetail) : {}; } catch {}
  const isNumericName = order.customerName && /^\d+$/.test(order.customerName);
  let tenantCnpj: string | undefined;
  try { tenantCnpj = (tenant as any)?.fiscalConfig ? JSON.parse((tenant as any).fiscalConfig)?.cnpj || undefined : undefined; } catch {}

  return {
    tenantName: tenant?.name || "",
    tenantAddress: (tenant as any)?.address || undefined,
    tenantCnpj,
    tenantPhone: (tenant as any)?.whatsapp || undefined,
    orderId: order.id,
    tableId: order.tableId,
    counterTicketNumber: order.counterTicketNumber != null ? order.counterTicketNumber : (isNumericName && !order.tableId ? Number(order.customerName) : null),
    consumptionType: order.consumptionType || undefined,
    paperWidthMm: ((tenant as any)?.receiptPaperWidth === 58 ? 58 : 80) as 58 | 80,
    createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
    customerName: (!isNumericName || order.tableId) ? order.customerName : undefined,
    operatorName: order.operatorName || undefined,
    isPreCheckout: !(order.billed === true || order.status === "DELIVERED"),
    items,
    subtotal: orderSubtotal,
    discountAmount: order.discount || 0,
    feeAmount: order.feeAmount || undefined,
    feePercent: order.feePercent || undefined,
    feePassedToCustomer: (order as any).feePassedToCustomer,
    serviceFeeAmount: order.serviceFeeAmount || undefined,
    serviceFeePercent: order.serviceFeePercent || undefined,
    total: order.total,
    paymentMethod: order.paymentMethod,
    amountReceived: order.paymentMethod === "CASH" ? paymentDetail.amountReceived : undefined,
    change: order.paymentMethod === "CASH" ? paymentDetail.change : undefined,
    paymentSplits: order.paymentMethod === "SPLIT" ? paymentDetail.splits : undefined,
  };
}

function parsePaymentSplits(order: Order): Array<{ method: string; amount: number }> {
  if (order.paymentMethod !== "SPLIT") return [];
  try {
    const detail = order.paymentDetail ? JSON.parse(order.paymentDetail) : null;
    return Array.isArray(detail?.splits) ? detail.splits : [];
  } catch {
    return [];
  }
}

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

// Pedido de Balcão/Mesa pago fica com status AWAITING_PAYMENT (ou PREPARING, se pago
// adiantado) pra sempre — o faturamento no PDV muda só o campo "billed", nunca o status.
// Usar só status === "DELIVERED" pra decidir "concluído" escondia essas vendas do total
// e ainda rotulava como "Cancelado" (o único outro rótulo que existia) pedidos que na
// verdade já foram pagos e entregues normalmente.
function isOrderConcluded(o: Order): boolean {
  return o.status !== "CANCELLED" && (o.billed === true || o.status === "DELIVERED");
}
function orderHistoryStatusLabel(o: Order): "Concluído" | "Cancelado" | "Em aberto" {
  if (o.status === "CANCELLED") return "Cancelado";
  return isOrderConcluded(o) ? "Concluído" : "Em aberto";
}

const HISTORY_PREFS_KEY = 'orderHistory_prefs_v1';

function loadHistoryPrefs(slug: string) {
  try {
    const raw = localStorage.getItem(`${HISTORY_PREFS_KEY}_${slug}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveHistoryPrefs(slug: string, prefs: object) {
  try {
    localStorage.setItem(`${HISTORY_PREFS_KEY}_${slug}`, JSON.stringify(prefs));
  } catch {}
}

function exportOrdersCSV(orders: Order[]) {
  const header = ['ID', 'Data', 'Horário', 'Cliente', 'Telefone', 'Tipo', 'Mesa', 'Status', 'Pagamento', 'Total'];
  const rows = orders.map(o => [
    `#${o.id.slice(-6).toUpperCase()}`,
    new Date(o.createdAt).toLocaleDateString('pt-BR'),
    new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    o.customerName,
    o.customerPhone || '',
    o.orderType === 'DELIVERY' ? 'Delivery' : o.orderType === 'DINE_IN' ? 'Mesa' : 'Retirada',
    o.tableId || '',
    orderHistoryStatusLabel(o),
    o.paymentMethod,
    String(o.total).replace('.', ','),
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historico_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const NOW = new Date();
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function OrderHistoryPanel({
  orders,
  slug,
  tenant,
  isOwner,
  onOrderChanged,
}: {
  orders: Order[];
  slug: string;
  tenant: Tenant;
  isOwner?: boolean;
  onOrderChanged?: () => void;
}) {
  const toast = useToast();
  const [detailsOrder, setDetailsOrder] = useState<Order | null>(null);
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [cancelPassword, setCancelPassword] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelOrder = async () => {
    if (!cancelOrder || !cancelPassword) return;
    setIsCancelling(true);
    try {
      await apiFetch(`/api/orders/${cancelOrder.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: cancelPassword }),
      }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Falha ao cancelar pedido.");
        }
      });
      toast.success("Pedido cancelado.");
      setCancelOrder(null);
      setCancelPassword("");
      setDetailsOrder(null);
      onOrderChanged?.();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao cancelar pedido.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReprintOrder = async (order: Order) => {
    const desktop = (window as any).pdvDesktop;
    // Pedido com NFC-e autorizada é documento fiscal — reimprime o DANFE completo em vez
    // da notinha comercial simples (mesma regra do Painel de Pedidos).
    if (order.nfceStatus === "AUTHORIZED" && (tenant as any)?.id) {
      try {
        const danfe = await apiJson<DanfeData>(`/api/owner/tenants/${(tenant as any).id}/nfce/danfe/${order.id}`);
        if (desktop?.printDanfe) desktop.printDanfe(danfe);
        else printDanfePdf(danfe, (tenant as any)?.receiptPaperWidth);
        return;
      } catch {
        // Se buscar o DANFE falhar, cai pro recibo comum abaixo em vez de travar a impressão.
      }
    }
    const data = buildReceiptDataFromOrder(order, tenant);
    if (desktop?.printReceipt) desktop.printReceipt(data);
    else printReceiptPdf(data);
  };

  const prefs = loadHistoryPrefs(slug);

  const [searchTerm, setSearchTerm] = useState<string>(prefs?.searchTerm ?? "");
  const [typeFilter, setTypeFilter] = useState<string>(prefs?.typeFilter ?? "all");
  const [paymentFilter, setPaymentFilter] = useState<string>(prefs?.paymentFilter ?? "all");
  const [statusFilter, setStatusFilter] = useState<string>(prefs?.statusFilter ?? "all");
  // date mode: 'range' | 'month'
  const [dateMode, setDateMode] = useState<'range' | 'month'>(prefs?.dateMode ?? 'month');
  const [dateFrom, setDateFrom] = useState<string | null>(prefs?.dateFrom ?? null);
  const [dateTo, setDateTo] = useState<string | null>(prefs?.dateTo ?? null);
  const [selMonth, setSelMonth] = useState<number>(prefs?.selMonth ?? NOW.getMonth());
  const [selYear, setSelYear] = useState<number>(prefs?.selYear ?? NOW.getFullYear());

  // persist prefs on change
  useEffect(() => {
    saveHistoryPrefs(slug, { searchTerm, typeFilter, paymentFilter, statusFilter, dateMode, dateFrom, dateTo, selMonth, selYear });
  }, [slug, searchTerm, typeFilter, paymentFilter, statusFilter, dateMode, dateFrom, dateTo, selMonth, selYear]);

  const filtered = useMemo(() => {
    // Mesmo bug de origem: pedido de Balcão/Mesa pago fica em AWAITING_PAYMENT/PREPARING
    // pra sempre, nunca vira DELIVERED — usar isOrderConcluded (billed=true conta) em vez
    // de checar só o status literal.
    //
    // Cada linha do banco aparece como seu próprio registro aqui — nunca somamos pedidos
    // diferentes (nem por mesma senha, nem por mesma mesa) num só total. Duas pessoas (ou
    // a mesma pessoa em dois momentos) que dividem uma senha/mesa aparecem cada uma com
    // seu próprio pedido, valor e itens, sem se misturar.
    const baseOrders = orders.filter(o => o.status === 'CANCELLED' || isOrderConcluded(o));

    return baseOrders
      .filter(o => {
        const d = new Date(o.createdAt);

        if (dateMode === 'month') {
          if (d.getMonth() !== selMonth || d.getFullYear() !== selYear) return false;
        } else {
          if (dateFrom) {
            const from = new Date(dateFrom + 'T00:00:00');
            if (d < from) return false;
          }
          if (dateTo) {
            const to = new Date(dateTo + 'T23:59:59');
            if (d > to) return false;
          }
        }

        const q = searchTerm.toLowerCase();
        const matchSearch = !q || o.id.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q);
        const matchType = typeFilter === 'all' || o.orderType === typeFilter;
        const matchPayment = paymentFilter === 'all' || o.paymentMethod === paymentFilter;
        const matchStatus = statusFilter === 'all'
          || (statusFilter === 'CANCELLED' ? o.status === 'CANCELLED' : isOrderConcluded(o));
        return matchSearch && matchType && matchPayment && matchStatus;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, searchTerm, typeFilter, paymentFilter, statusFilter, dateMode, dateFrom, dateTo, selMonth, selYear]);

  const totalSales = useMemo(() => filtered.reduce((acc, o) => acc + (isOrderConcluded(o) ? o.total : 0), 0), [filtered]);
  const concludedCount = filtered.filter(isOrderConcluded).length;
  const avgTicket = concludedCount > 0 ? totalSales / concludedCount : 0;
  const cancelled = filtered.filter(o => o.status === 'CANCELLED').length;

  const { page, pageSize, setPage, setPageSize, paginatedData, totalPages } = usePagination(filtered, 20);

  const yearOptions = useMemo(() => {
    const years = new Set(orders.map(o => new Date(o.createdAt).getFullYear()));
    years.add(NOW.getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [orders]);

  const typeOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'DELIVERY', label: 'Delivery' },
    { value: 'DINE_IN', label: 'Mesa' },
    { value: 'PICKUP', label: 'Retirada' },
  ];
  const paymentOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'PIX', label: 'Pix' },
    { value: 'CREDIT', label: 'Crédito' },
    { value: 'DEBIT', label: 'Débito' },
    { value: 'CASH', label: 'Dinheiro' },
    { value: 'VR', label: 'VR/VA' },
  ];
  const statusOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'CONCLUDED', label: 'Concluído' },
    { value: 'CANCELLED', label: 'Cancelado' },
  ];

  const columns = useMemo(() => [
    {
      header: 'ID',
      render: (o: Order) => (
        <span className="text-xs font-medium text-slate-800 tabular-nums">#{o.id.slice(-6).toUpperCase()}</span>
      ),
    },
    {
      header: 'Data / Hora',
      render: (o: Order) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-slate-700">
            {new Date(o.createdAt).toLocaleDateString('pt-BR')}
          </span>
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ),
    },
    {
      header: 'Cliente',
      render: (o: Order) => (
        <p className="text-xs font-medium text-slate-700 truncate max-w-[130px]">{o.customerName}</p>
      ),
    },
    {
      header: 'Tipo',
      hideOnMobile: true,
      render: (o: Order) => (
        <span className="text-[11px] text-slate-500">
          {o.orderType === 'DELIVERY' ? 'Delivery' : o.orderType === 'DINE_IN' ? dineInOrderLabel(o) : 'Retirada'}
        </span>
      ),
    },
    {
      header: 'Atendente',
      hideOnMobile: true,
      render: (o: Order) => (
        <span className="text-xs text-slate-600 truncate max-w-[110px] block">{o.operatorName || "—"}</span>
      ),
    },
    {
      header: 'Status',
      hideOnMobile: true,
      render: (o: Order) => (
        <Badge color={o.status === 'CANCELLED' ? 'danger' : isOrderConcluded(o) ? 'success' : 'warning'} pill>
          {orderHistoryStatusLabel(o)}
        </Badge>
      ),
    },
    {
      header: 'Pagamento',
      hideOnMobile: true,
      render: (o: Order) => <PaymentBadge method={o.paymentMethod.toLowerCase() as any} size="sm" />,
    },
    {
      header: 'Valor',
      render: (o: Order) => (
        <div className="flex flex-col items-end">
          <span className="text-xs font-medium text-slate-800 tabular-nums">{fmt(o.total)}</span>
          {!!o.discount && (
            <span className="text-[11px] font-medium text-emerald-600 tabular-nums">
              -{o.discountType === "PERCENT" ? `${o.discount}%` : fmt(o.discount)}
            </span>
          )}
        </div>
      ),
    },
    {
      header: '',
      render: (o: Order) => (
        <IconButton size="sm" variant="ghost" aria-label="Ver detalhes do pedido" onClick={() => setDetailsOrder(o)}>
          <Eye className="w-4 h-4" />
        </IconButton>
      ),
    },
  ], [slug]);

  const [draft, setDraft] = useState({ type: "all", payment: "all", status: "all", mode: "month" as "range" | "month", from: null as string | null, to: null as string | null, month: NOW.getMonth(), year: NOW.getFullYear() });
  const dateIsDefault = dateMode === 'month' && selMonth === NOW.getMonth() && selYear === NOW.getFullYear();
  const filterChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (typeFilter !== 'all') filterChips.push({ key: 'type', label: `Tipo: ${typeOptions.find(o => o.value === typeFilter)?.label ?? typeFilter}`, onRemove: () => setTypeFilter('all') });
  if (paymentFilter !== 'all') filterChips.push({ key: 'payment', label: `Pagamento: ${paymentOptions.find(o => o.value === paymentFilter)?.label ?? paymentFilter}`, onRemove: () => setPaymentFilter('all') });
  if (statusFilter !== 'all') filterChips.push({ key: 'status', label: `Status: ${statusOptions.find(o => o.value === statusFilter)?.label ?? statusFilter}`, onRemove: () => setStatusFilter('all') });
  if (!dateIsDefault) {
    const dateLabel = dateMode === 'month'
      ? `${MONTH_NAMES[selMonth]}/${selYear}`
      : `${dateFrom ? new Date(dateFrom + 'T12:00:00').toLocaleDateString('pt-BR') : '...'} a ${dateTo ? new Date(dateTo + 'T12:00:00').toLocaleDateString('pt-BR') : '...'}`;
    filterChips.push({ key: 'date', label: `Período: ${dateLabel}`, onRemove: () => { setDateMode('month'); setDateFrom(null); setDateTo(null); setSelMonth(NOW.getMonth()); setSelYear(NOW.getFullYear()); } });
  }
  const openFilters = () => setDraft({ type: typeFilter, payment: paymentFilter, status: statusFilter, mode: dateMode, from: dateFrom, to: dateTo, month: selMonth, year: selYear });
  const applyFilters = () => {
    setTypeFilter(draft.type); setPaymentFilter(draft.payment); setStatusFilter(draft.status);
    setDateMode(draft.mode); setDateFrom(draft.from); setDateTo(draft.to); setSelMonth(draft.month); setSelYear(draft.year);
  };
  const clearFilters = () => {
    setTypeFilter('all'); setPaymentFilter('all'); setStatusFilter('all');
    setDateMode('month'); setDateFrom(null); setDateTo(null); setSelMonth(NOW.getMonth()); setSelYear(NOW.getFullYear());
    setDraft({ type: 'all', payment: 'all', status: 'all', mode: 'month', from: null, to: null, month: NOW.getMonth(), year: NOW.getFullYear() });
  };

  return (
    <PageWrapper>
    <div className="space-y-4">
      <SectionTitle
        title="Histórico de Pedidos"
        description="Relatório detalhado de vendas finalizadas"
        icon={History}
        action={
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => exportOrdersCSV(filtered)} iconLeft={<Download size={14} />}>
            Exportar CSV
          </Button>
        }
      />

      <StatGrid cols={3}>
        <StatCard title="Vendas Filtradas" value={fmt(totalSales)} icon={CircleDollarSign} color="success" />
        <StatCard title="Total de Pedidos" value={filtered.length} icon={Package} color="info" />
        <StatCard title="Ticket Médio" value={fmt(avgTicket)} icon={TrendingUp} color="info" />
      </StatGrid>

      <FilterLine>
        <FilterLineSection grow wrap className="gap-2">
          <FilterLineItem fullOnMobile={false} grow className="min-w-0 sm:max-w-[280px]">
            <FilterLineSearch
              value={searchTerm}
              onChange={v => setSearchTerm(v)}
              placeholder="Buscar por ID ou cliente..."
              aria-label="Buscar pedidos"
              className="h-[34px]"
            />
          </FilterLineItem>
          <FilterPopover activeCount={filterChips.length} onOpen={openFilters} onApply={applyFilters} onClear={clearFilters}>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Período</label>
              <FilterLineSegmented
                value={draft.mode}
                onChange={v => setDraft(d => ({ ...d, mode: v as 'range' | 'month' }))}
                options={[
                  { value: 'month', label: 'Por Mês' },
                  { value: 'range', label: 'Período' },
                ]}
                size="sm"
              />
              {draft.mode === 'month' ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Select
                    aria-label="Mês"
                    value={String(draft.month)}
                    onChange={e => setDraft(d => ({ ...d, month: Number(e.target.value) }))}
                    options={MONTH_NAMES.map((m, i) => ({ value: String(i), label: m }))}
                  />
                  <Select
                    aria-label="Ano"
                    value={String(draft.year)}
                    onChange={e => setDraft(d => ({ ...d, year: Number(e.target.value) }))}
                    options={yearOptions.map(y => ({ value: String(y), label: String(y) }))}
                  />
                </div>
              ) : (
                <div className="pt-1">
                  <FilterLineDateRange
                    from={draft.from}
                    to={draft.to}
                    onFromChange={v => setDraft(d => ({ ...d, from: v }))}
                    onToChange={v => setDraft(d => ({ ...d, to: v }))}
                  />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Tipo</label>
              <Select aria-label="Filtrar por tipo" value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))} options={typeOptions} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Pagamento</label>
              <Select aria-label="Filtrar por pagamento" value={draft.payment} onChange={e => setDraft(d => ({ ...d, payment: e.target.value }))} options={paymentOptions} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Status</label>
              <Select aria-label="Filtrar por status" value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))} options={statusOptions} />
            </div>
          </FilterPopover>
        </FilterLineSection>
      </FilterLine>

      {filterChips.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {filterChips.map((chip) => (
            <span key={chip.key} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 py-0.5 pl-2 pr-1 text-[11px] font-medium text-blue-700">
              <span className="truncate">{chip.label}</span>
              <button type="button" onClick={chip.onRemove} aria-label={`Remover filtro ${chip.label}`} className="rounded p-0.5 hover:bg-blue-100">
                <X size={11} />
              </button>
            </span>
          ))}
          <button type="button" onClick={clearFilters} className="px-1 text-[11px] font-medium text-slate-500 hover:text-slate-800">
            Limpar filtros
          </button>
        </div>
      )}

      <GridTable
        data={paginatedData}
        columns={columns}
        keyExtractor={o => o.id}
        emptyMessage={
          <EmptyState
            icon={History}
            title="Nenhum pedido encontrado"
            description="Tente ajustar os filtros de data ou busca"
            className="border-none bg-transparent py-4"
          />
        }
        noDesktopCard={false}
        pagination={{
          total: filtered.length,
          page,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
      />

      {/* Detalhes do pedido */}
      <Modal
        isOpen={!!detailsOrder}
        onClose={() => setDetailsOrder(null)}
        title={detailsOrder ? `Pedido #${detailsOrder.id.slice(-6).toUpperCase()}` : ""}
        size="md"
      >
        {detailsOrder && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">
                {new Date(detailsOrder.createdAt).toLocaleString('pt-BR')}
              </span>
              <Badge color={detailsOrder.status === 'CANCELLED' ? 'danger' : isOrderConcluded(detailsOrder) ? 'success' : 'warning'} pill>
                {orderHistoryStatusLabel(detailsOrder)}
              </Badge>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-800">{detailsOrder.customerName}</p>
              <p className="text-[11px] text-slate-500">
                {detailsOrder.orderType === 'DELIVERY' ? 'Delivery' : detailsOrder.orderType === 'DINE_IN' ? dineInOrderLabel(detailsOrder) : 'Retirada'}
              </p>
              {detailsOrder.operatorName && (
                <p className="text-[11px] text-slate-500">Atendente: <span className="text-slate-600">{detailsOrder.operatorName}</span></p>
              )}
            </div>

            <div className="border border-slate-100 rounded-lg divide-y divide-slate-100">
              {detailsOrder.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-700 truncate">{item.quantity}x {item.product?.name || "Produto"}</p>
                    {extrasLabelsFromOrderItem(item).map((extra, idx) => (
                      <p key={idx} className="text-[11px] text-slate-500 truncate">+ {extra}</p>
                    ))}
                    {item.notes && <p className="text-[11px] text-slate-500 italic truncate">{item.notes}</p>}
                  </div>
                  <span className="font-medium text-slate-800 shrink-0 ml-2">{fmt(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {!!detailsOrder.discount && (
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] text-slate-500">Desconto</span>
                <span className="text-xs font-semibold text-emerald-600">
                  {detailsOrder.discountType === "PERCENT" ? `${detailsOrder.discount}%` : fmt(detailsOrder.discount)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">Pagamento</span>
                <PaymentBadge method={detailsOrder.paymentMethod.toLowerCase() as any} size="sm" />
              </div>
              <span className="text-base font-semibold text-slate-800">{fmt(detailsOrder.total)}</span>
            </div>

            {parsePaymentSplits(detailsOrder).length > 0 && (
              <div className="border border-slate-100 rounded-lg divide-y divide-slate-100">
                {parsePaymentSplits(detailsOrder).map((split, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-2 text-xs">
                    <PaymentBadge method={split.method.toLowerCase() as any} size="sm" />
                    <span className="font-medium text-slate-700">{fmt(split.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className={`grid gap-2.5 ${isOwner && detailsOrder.status !== 'CANCELLED' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <Button variant="outline" fullWidth onClick={() => void handleReprintOrder(detailsOrder)} iconLeft={<Printer size={14} />}>
                Reimprimir
              </Button>
              {isOwner && detailsOrder.status !== 'CANCELLED' && (
                <Button variant="danger" fullWidth onClick={() => { setCancelOrder(detailsOrder); setCancelPassword(""); }}>
                  Cancelar Pedido
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Cancelar pedido — exige senha do proprietário */}
      <Modal
        isOpen={!!cancelOrder}
        onClose={() => { setCancelOrder(null); setCancelPassword(""); }}
        title="Cancelar Pedido"
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="ghost" onClick={() => { setCancelOrder(null); setCancelPassword(""); }}>Voltar</Button>
            <Button variant="danger" loading={isCancelling} disabled={!cancelPassword} onClick={handleCancelOrder}>Confirmar Cancelamento</Button>
          </ModalFooter>
        }
      >
        {cancelOrder && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Confirme sua senha para cancelar o pedido <strong>#{cancelOrder.id.slice(-6).toUpperCase()}</strong> ({fmt(cancelOrder.total)}). O pedido não é apagado, apenas marcado como cancelado e sai dos relatórios.
            </p>
            <Input
              type="password"
              autoFocus
              value={cancelPassword}
              onChange={(e) => setCancelPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCancelOrder(); }}
              placeholder="Sua senha"
            />
          </div>
        )}
      </Modal>
    </div>
    </PageWrapper>
  );
}

