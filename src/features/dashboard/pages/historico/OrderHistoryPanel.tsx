import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Download,
  Eye,
  History,
  Package,
  Printer,
  TrendingUp,
} from "lucide-react";
import {
  Button,
  EmptyState,
  FilterLine,
  FilterLineDateRange,
  FilterLineItem,
  FilterLineSearch,
  FilterLineSection,
  FilterLineSegmented,
  GridTable,
  Modal,
  PaymentBadge,
  SectionTitle,
  StatCard,
  StatGrid,
  usePagination,
  useToast,
} from "../../../../components";
import { apiFetch, apiJson } from "../../../../lib/api";
import { Order, Tenant, dineInOrderLabel, type DanfeData } from "../../../../types";
import { printReceiptPdf, printDanfePdf, type ReceiptData } from "../../../../lib/receipt";

// Reconstrói os dados da notinha a partir de um pedido já salvo — usado pra reimprimir
// direto do Histórico, sem precisar abrir o PDV (mesma lógica de OrdersList.tsx).
function buildReceiptDataFromOrder(order: Order, tenant: Tenant): ReceiptData {
  const items = (order.items || []).map((i: any) => ({
    quantity: i.quantity,
    name: i.productVariant?.name ? `${i.product?.name || ""} (${i.productVariant.name})` : (i.product?.name || ""),
    price: i.price,
    notes: i.notes || undefined,
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
    isPreCheckout: !(order.billed === true || order.status === "DELIVERED"),
    items,
    subtotal: orderSubtotal,
    discountAmount: (order as any).discount || 0,
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
    { value: 'all', label: 'Pagamento' },
    { value: 'PIX', label: 'Pix' },
    { value: 'CREDIT', label: 'Crédito' },
    { value: 'DEBIT', label: 'Débito' },
    { value: 'CASH', label: 'Dinheiro' },
    { value: 'VR', label: 'VR/VA' },
  ];
  const statusOptions = [
    { value: 'all', label: 'Status' },
    { value: 'CONCLUDED', label: 'Concluído' },
    { value: 'CANCELLED', label: 'Cancelado' },
  ];

  const columns = useMemo(() => [
    {
      header: 'ID',
      render: (o: Order) => (
        <span className="text-xs font-black text-slate-800 tabular-nums">#{o.id.slice(-6).toUpperCase()}</span>
      ),
    },
    {
      header: 'Data / Hora',
      render: (o: Order) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-slate-700">
            {new Date(o.createdAt).toLocaleDateString('pt-BR')}
          </span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ),
    },
    {
      header: 'Cliente',
      render: (o: Order) => (
        <p className="text-xs font-bold text-slate-700 truncate max-w-[130px]">{o.customerName}</p>
      ),
    },
    {
      header: 'Tipo',
      hideOnMobile: true,
      render: (o: Order) => (
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          {o.orderType === 'DELIVERY' ? 'Delivery' : o.orderType === 'DINE_IN' ? dineInOrderLabel(o) : 'Retirada'}
        </span>
      ),
    },
    {
      header: 'Status',
      hideOnMobile: true,
      render: (o: Order) => (
        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
          o.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : isOrderConcluded(o) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {orderHistoryStatusLabel(o)}
        </span>
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
        <span className="text-xs font-black text-slate-800 tabular-nums">{fmt(o.total)}</span>
      ),
    },
    {
      header: '',
      render: (o: Order) => (
        <button
          onClick={() => setDetailsOrder(o)}
          className="p-2 text-slate-300 hover:text-amber-500 transition-colors inline-block"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ], [slug]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <SectionTitle
          title="Histórico de Pedidos"
          description="Relatório detalhado de vendas finalizadas"
          icon={History}
        />
        <Button variant="outline" size="sm" className="hidden sm:flex gap-2" onClick={() => exportOrdersCSV(filtered)}>
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      <StatGrid cols={3} className="mb-2">
        <StatCard title="Vendas Filtradas" value={fmt(totalSales)} icon={CircleDollarSign} color="success" />
        <StatCard title="Total de Pedidos" value={filtered.length} icon={Package} color="info" />
        <StatCard title="Ticket Médio" value={fmt(avgTicket)} icon={TrendingUp} color="warning" />
      </StatGrid>

      {/* Filter bar */}
      <FilterLine>
        {/* Linha 1: Modo de data + seletores */}
        <FilterLineSection grow wrap>
          {/* Segmentado Mês / Período */}
          <FilterLineItem fullOnMobile={false}>
            <FilterLineSegmented
              value={dateMode}
              onChange={v => { setDateMode(v as 'range' | 'month'); }}
              options={[
                { value: 'month', label: 'Por Mês' },
                { value: 'range', label: 'Período' },
              ]}
              size="sm"
            />
          </FilterLineItem>

          {dateMode === 'month' ? (
            <>
              {/* Seletor de Mês */}
              <FilterLineItem fullOnMobile={false}>
                <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 px-2 h-10">
                  <button
                    type="button"
                    onClick={() => {
                      if (selMonth === 0) { setSelMonth(11); setSelYear(y => y - 1); }
                      else setSelMonth(m => m - 1);
                    }}
                    className="p-1 text-zinc-400 hover:text-amber-500 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-black text-zinc-700 w-8 text-center">{MONTH_NAMES[selMonth]}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selMonth === 11) { setSelMonth(0); setSelYear(y => y + 1); }
                      else setSelMonth(m => m + 1);
                    }}
                    className="p-1 text-zinc-400 hover:text-amber-500 transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </FilterLineItem>

              {/* Seletor de Ano */}
              <FilterLineItem fullOnMobile={false}>
                <select
                  value={selYear}
                  onChange={e => { setSelYear(Number(e.target.value)); }}
                  className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-black text-zinc-700 outline-none focus:border-amber-400"
                >
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </FilterLineItem>
            </>
          ) : (
            <FilterLineItem grow>
              <FilterLineDateRange
                from={dateFrom}
                to={dateTo}
                onFromChange={v => setDateFrom(v)}
                onToChange={v => setDateTo(v)}
              />
            </FilterLineItem>
          )}
        </FilterLineSection>

        {/* Linha 2: Busca + dropdowns */}
        <FilterLineSection grow wrap>
          <FilterLineItem grow>
            <FilterLineSearch
              value={searchTerm}
              onChange={v => setSearchTerm(v)}
              placeholder="Buscar por ID ou cliente..."
            />
          </FilterLineItem>

          <FilterLineItem fullOnMobile={false}>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-black text-zinc-600 outline-none focus:border-amber-400"
            >
              {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FilterLineItem>

          <FilterLineItem fullOnMobile={false}>
            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-black text-zinc-600 outline-none focus:border-amber-400"
            >
              {paymentOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FilterLineItem>

          <FilterLineItem fullOnMobile={false}>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-black text-zinc-600 outline-none focus:border-amber-400"
            >
              {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FilterLineItem>
        </FilterLineSection>
      </FilterLine>

      <GridTable
        data={paginatedData}
        columns={columns}
        keyExtractor={o => o.id}
        emptyMessage={
          <EmptyState
            icon={History}
            title="Nenhum pedido encontrado"
            description="Tente ajustar os filtros de data ou busca"
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
              <span className="font-bold text-slate-500">
                {new Date(detailsOrder.createdAt).toLocaleString('pt-BR')}
              </span>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                detailsOrder.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : isOrderConcluded(detailsOrder) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {orderHistoryStatusLabel(detailsOrder)}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-black text-slate-800">{detailsOrder.customerName}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {detailsOrder.orderType === 'DELIVERY' ? 'Delivery' : detailsOrder.orderType === 'DINE_IN' ? dineInOrderLabel(detailsOrder) : 'Retirada'}
              </p>
            </div>

            <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100">
              {detailsOrder.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-700 truncate">{item.quantity}x {item.product?.name || "Produto"}</p>
                    {item.notes && <p className="text-[10px] text-slate-400 italic truncate">{item.notes}</p>}
                  </div>
                  <span className="font-black text-slate-800 shrink-0 ml-2">{fmt(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pagamento</span>
                <PaymentBadge method={detailsOrder.paymentMethod.toLowerCase() as any} size="sm" />
              </div>
              <span className="text-base font-black text-slate-800">{fmt(detailsOrder.total)}</span>
            </div>

            {parsePaymentSplits(detailsOrder).length > 0 && (
              <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100">
                {parsePaymentSplits(detailsOrder).map((split, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-2 text-xs">
                    <PaymentBadge method={split.method.toLowerCase() as any} size="sm" />
                    <span className="font-black text-slate-700">{fmt(split.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className={`grid gap-2.5 ${isOwner && detailsOrder.status !== 'CANCELLED' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <button
                onClick={() => void handleReprintOrder(detailsOrder)}
                className="w-full py-3 rounded-2xl border border-slate-200 text-slate-600 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Reimprimir
              </button>
              {isOwner && detailsOrder.status !== 'CANCELLED' && (
                <button
                  onClick={() => { setCancelOrder(detailsOrder); setCancelPassword(""); }}
                  className="w-full py-3 rounded-2xl border border-red-200 text-red-600 text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-colors"
                >
                  Cancelar Pedido
                </button>
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
      >
        {cancelOrder && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Confirme sua senha para cancelar o pedido <strong>#{cancelOrder.id.slice(-6).toUpperCase()}</strong> ({fmt(cancelOrder.total)}). O pedido não é apagado, apenas marcado como cancelado e sai dos relatórios.
            </p>
            <input
              type="password"
              autoFocus
              value={cancelPassword}
              onChange={(e) => setCancelPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCancelOrder(); }}
              placeholder="Sua senha"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:border-red-400 outline-none"
            />
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setCancelOrder(null); setCancelPassword(""); }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-500 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all"
              >
                Voltar
              </button>
              <button
                disabled={!cancelPassword || isCancelling}
                onClick={handleCancelOrder}
                className="bg-red-500 hover:bg-red-600 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
              >
                {isCancelling ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : "Confirmar Cancelamento"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

