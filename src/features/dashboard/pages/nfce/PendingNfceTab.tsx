import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Receipt, Printer, Download, ExternalLink, FileCheck2, AlertCircle, Settings } from "lucide-react";
import {
  ContentCard,
  GridTable,
  EmptyState,
  Badge,
  Alert,
  FilterLine,
  FilterLineSection,
  FilterLineItem,
  FilterLineSearch,
  FilterLineDateRange,
  Modal,
  ModalFooter,
  ConfirmModal,
  Button,
  DetailField,
  useToast,
  type Column,
} from "../../../../components";
import { apiJson } from "../../../../lib/api";
import { downloadDanfePdf, printDanfePdf } from "../../../../lib/receipt";
import type { Tenant, DanfeData } from "../../../../types";

interface PendingItem {
  id: string;
  productId: string | null;
  productName: string;
  quantity: number;
  price: number;
  ncm: string;
  cfop: string;
  csosn: string | null;
}

interface PendingOrder {
  id: string;
  customerName: string;
  customerCpf: string | null;
  counterTicketNumber: number | null;
  orderType: string;
  paymentMethod: string;
  discount: number | null;
  discountType: string | null;
  feeAmount: number | null;
  feePassedToCustomer: boolean;
  serviceFeeAmount: number | null;
  total: number;
  createdAt: string;
  nfceStatus: string | null;
  items: PendingItem[];
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Dinheiro",
  PIX: "PIX",
  CREDIT: "Cartão de crédito",
  DEBIT: "Cartão de débito",
  VR: "Vale refeição",
  SPLIT: "Pagamento dividido",
};

const paymentLabel = (m: string) =>
  m.startsWith("STONE_") ? `Maquininha (${m.replace("STONE_", "")})` : PAYMENT_LABELS[m] ?? m;

const fmtMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const orderLabel = (o: PendingOrder) =>
  o.counterTicketNumber ? `Senha ${o.counterTicketNumber}` : `#${o.id.slice(-6).toUpperCase()}`;

const customerLabel = (o: PendingOrder) => (!o.customerName || o.customerName === "Venda PDV" ? "—" : o.customerName);

const itemsQty = (o: PendingOrder) => o.items.reduce((s, i) => s + i.quantity, 0);

// Mesmas regras de validação da emissão (fiscal-routes.ts): NCM de 8 dígitos (não zerado) e CFOP de 4.
function itemIssues(it: PendingItem): string[] {
  const issues: string[] = [];
  if (!/^\d{8}$/.test(it.ncm) || it.ncm === "00000000") issues.push("NCM ausente ou inválido");
  if (!/^\d{4}$/.test(it.cfop)) issues.push("CFOP ausente ou inválido");
  return issues;
}
const orderHasIssues = (o: PendingOrder) => o.items.length === 0 || o.items.some((i) => itemIssues(i).length > 0);

function fmtDoc(doc: string) {
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return {
    from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

type EmitResult = { status?: string; numero?: number; chave?: string; motivo?: string };

interface Props {
  slug: string;
  tenant: Tenant;
  fiscalEnabled: boolean;
  /** Avisa o pai que a lista de emitidas mudou (contadores/abas). */
  onChanged?: () => void;
}

export default function PendingNfceTab({ slug, tenant, fiscalEnabled, onChanged }: Props) {
  const toast = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const defaultRange = useMemo(currentMonthRange, []);
  const [dateFrom, setDateFrom] = useState<string | null>(defaultRange.from);
  const [dateTo, setDateTo] = useState<string | null>(defaultRange.to);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [preview, setPreview] = useState<PendingOrder | null>(null);
  const [emittingId, setEmittingId] = useState<string | null>(null);
  const [emitError, setEmitError] = useState("");
  const [authorized, setAuthorized] = useState<{ orderId: string; numero?: number; chave?: string } | null>(null);
  const [danfeBusy, setDanfeBusy] = useState(false);

  const [batchConfirm, setBatchConfirm] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);

  const reqSeq = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const fetchOrders = useCallback(async () => {
    if (!fiscalEnabled) return;
    const seq = ++reqSeq.current;
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const data = await apiJson<{ orders: PendingOrder[]; total: number }>(
        `/api/owner/tenants/${tenant.id}/nfce/pending-orders?${params}`
      );
      if (seq !== reqSeq.current) return;
      setOrders(data.orders);
      setTotal(data.total);
    } catch (e: any) {
      if (seq !== reqSeq.current) return;
      setLoadError(e?.message ?? "Erro ao carregar pedidos sem nota.");
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [tenant.id, page, pageSize, dateFrom, dateTo, debouncedSearch, fiscalEnabled]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [dateFrom, dateTo, debouncedSearch]);

  // Mesmo endpoint e mesmo tratamento do PDV (handleEmitNfce).
  const emitOne = async (orderId: string): Promise<EmitResult> => {
    const res = (await apiJson(`/api/owner/tenants/${tenant.id}/nfce/emit`, {
      method: "POST",
      body: JSON.stringify({ orderId }),
    })) as EmitResult;
    return res;
  };

  const handleEmit = async (order: PendingOrder) => {
    setEmittingId(order.id);
    setEmitError("");
    try {
      const res = await emitOne(order.id);
      if (res.status === "AUTHORIZED") {
        toast.success(`NFC-e ${res.numero ?? ""} autorizada.`);
        setAuthorized({ orderId: order.id, numero: res.numero, chave: res.chave });
        onChanged?.();
      } else {
        setEmitError(res.motivo ?? "NFC-e rejeitada pela SEFAZ.");
      }
    } catch (err: any) {
      setEmitError(err?.message ?? "Erro ao emitir NFC-e.");
    } finally {
      setEmittingId(null);
      fetchOrders();
    }
  };

  const openPreview = (order: PendingOrder) => {
    setPreview(order);
    setEmitError("");
    setAuthorized(null);
  };

  const closePreview = () => {
    if (emittingId) return;
    setPreview(null);
    setAuthorized(null);
    setEmitError("");
  };

  const fetchDanfe = async (orderId: string): Promise<DanfeData | null> => {
    try {
      return await apiJson<DanfeData>(`/api/owner/tenants/${tenant.id}/nfce/danfe/${orderId}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao carregar dados da NFC-e.");
      return null;
    }
  };

  const handlePrint = async (orderId: string) => {
    setDanfeBusy(true);
    const data = await fetchDanfe(orderId);
    setDanfeBusy(false);
    if (!data) return;
    const desktop = (window as any).pdvDesktop;
    if (desktop?.printDanfe) desktop.printDanfe(data);
    else printDanfePdf(data, tenant.receiptPaperWidth);
  };

  const handleDownload = async (orderId: string) => {
    setDanfeBusy(true);
    const data = await fetchDanfe(orderId);
    setDanfeBusy(false);
    if (data) downloadDanfePdf(data, tenant.receiptPaperWidth);
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleSelectAll = () =>
    setSelectedIds((prev) =>
      orders.length > 0 && orders.every((o) => prev.has(o.id)) ? new Set() : new Set(orders.map((o) => o.id))
    );

  const selectedOrders = orders.filter((o) => selectedIds.has(o.id));
  const batchEligible = selectedOrders.filter((o) => !orderHasIssues(o));
  const batchSkipped = selectedOrders.length - batchEligible.length;

  // Emissão em lote: sequencial (o servidor reserva o número de forma atômica; em paralelo
  // só geraria disputa) e sempre pelo mesmo endpoint do PDV. Pedidos com dados fiscais
  // incompletos são pulados para não consumir numeração com notas fadadas à rejeição.
  const runBatch = async () => {
    setBatchRunning(true);
    let ok = 0;
    let fail = 0;
    for (const o of batchEligible) {
      try {
        const res = await emitOne(o.id);
        if (res.status === "AUTHORIZED") ok++;
        else fail++;
      } catch {
        fail++;
      }
    }
    setBatchRunning(false);
    setBatchConfirm(false);
    setSelectedIds(new Set());
    if (ok > 0) toast.success(`${ok} NFC-e autorizada${ok > 1 ? "s" : ""}.`);
    if (fail > 0) toast.error(`${fail} nota${fail > 1 ? "s" : ""} rejeitada${fail > 1 ? "s" : ""} ou com erro — veja em "Emitidas".`);
    onChanged?.();
    fetchOrders();
  };

  const goProducts = () => navigate(`/dashboard/${slug}/cardapio`);
  const goSettings = () => navigate(`/dashboard/${slug}/configuracoes`);

  if (!fiscalEnabled) {
    return (
      <ContentCard>
        <EmptyState
          icon={Settings}
          title="Emissão de NFC-e desativada"
          description="Para emitir notas a partir dos pedidos, habilite o módulo fiscal e informe os dados do emitente e o certificado em Configurações > Fiscal."
          action={<Button size="sm" onClick={goSettings}>Abrir configurações</Button>}
        />
      </ContentCard>
    );
  }

  const columns: Column<PendingOrder>[] = [
    {
      header: "Pedido",
      render: (o) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-800">{orderLabel(o)}</span>
          {o.nfceStatus === "REJECTED" && <span className="mt-0.5"><Badge color="danger">Rejeitada</Badge></span>}
          {o.nfceStatus === "PENDING" && <span className="mt-0.5"><Badge color="warning">Pendente</Badge></span>}
        </div>
      ),
    },
    {
      header: "Data",
      render: (o) => <span className="whitespace-nowrap text-xs text-slate-600">{new Date(o.createdAt).toLocaleString("pt-BR")}</span>,
    },
    { header: "Cliente", render: (o) => <span className="text-xs text-slate-700">{customerLabel(o)}</span> },
    { header: "Pagamento", render: (o) => <span className="text-xs text-slate-600">{paymentLabel(o.paymentMethod)}</span> },
    {
      header: "Itens",
      render: (o) => (
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          {itemsQty(o)}
          {orderHasIssues(o) && <span title="Dados fiscais incompletos"><AlertCircle size={13} className="text-amber-500" /></span>}
        </span>
      ),
    },
    {
      header: "Total",
      render: (o) => <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-slate-800">{fmtMoney(o.total)}</span>,
    },
    {
      header: "Ações",
      render: (o) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="xs" variant="outline" onClick={() => openPreview(o)} iconLeft={<Eye size={14} />}>
            Ver itens
          </Button>
          <Button
            size="xs"
            onClick={() => openPreview(o)}
            disabled={orderHasIssues(o)}
            title={orderHasIssues(o) ? "Corrija os dados fiscais dos produtos antes de emitir" : "Revisar e emitir NFC-e"}
            iconLeft={<Receipt size={14} />}
          >
            Emitir NFC-e
          </Button>
        </div>
      ),
    },
  ];

  const previewIssues = preview ? preview.items.flatMap((i) => itemIssues(i).map((msg) => ({ item: i, msg }))) : [];
  const previewSubtotal = preview ? preview.items.reduce((s, i) => s + i.quantity * i.price, 0) : 0;
  const previewAdjust = preview ? preview.total - previewSubtotal : 0;
  const isAuthorized = !!authorized && preview?.id === authorized.orderId;

  return (
    <div className="space-y-3">
      <FilterLine>
        <FilterLineSection grow>
          <FilterLineItem grow minWidth={200} className="sm:max-w-[280px]">
            <FilterLineSearch value={search} onChange={setSearch} placeholder="Buscar por cliente ou senha..." />
          </FilterLineItem>
          <FilterLineItem minWidth={260}>
            <FilterLineDateRange from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          </FilterLineItem>
        </FilterLineSection>
        <FilterLineSection align="right">
          {selectedOrders.length > 0 && (
            <FilterLineItem fullOnMobile={false}>
              <Button size="sm" onClick={() => setBatchConfirm(true)} iconLeft={<Receipt size={14} />}>
                Emitir selecionadas ({selectedOrders.length})
              </Button>
            </FilterLineItem>
          )}
        </FilterLineSection>
      </FilterLine>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {!loading && !loadError && orders.length === 0 ? (
        <ContentCard>
          <EmptyState
            icon={FileCheck2}
            title="Nenhum pedido aguardando NFC-e"
            description="Todas as vendas concluídas do período já têm nota autorizada, ou nenhum pedido corresponde à busca."
          />
        </ContentCard>
      ) : (
        <ContentCard padding="none">
          <GridTable
            noDesktopCard
            data={orders}
            columns={columns}
            keyExtractor={(o) => o.id}
            isLoading={loading}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            pagination={{
              total,
              page,
              pageSize,
              onPageChange: setPage,
              onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
            }}
          />
        </ContentCard>
      )}

      <Modal
        isOpen={!!preview}
        onClose={closePreview}
        title={preview ? `Prévia da NFC-e — ${orderLabel(preview)}` : "Prévia da NFC-e"}
        size="lg"
        footer={
          <ModalFooter>
            <Button variant="ghost" onClick={closePreview} disabled={!!emittingId}>Fechar</Button>
            {isAuthorized && authorized ? (
              <>
                <Button variant="outline" onClick={() => handleDownload(authorized.orderId)} disabled={danfeBusy} iconLeft={<Download size={14} />}>
                  Baixar
                </Button>
                <Button onClick={() => handlePrint(authorized.orderId)} disabled={danfeBusy} iconLeft={<Printer size={14} />}>
                  Imprimir DANFE
                </Button>
              </>
            ) : (
              preview && (
                <Button
                  onClick={() => handleEmit(preview)}
                  loading={emittingId === preview.id}
                  disabled={!!emittingId || previewIssues.length > 0 || preview.items.length === 0}
                  iconLeft={<Receipt size={14} />}
                >
                  Emitir NFC-e
                </Button>
              )
            )}
          </ModalFooter>
        }
      >
        {preview && (
          <div className="space-y-3">
            {isAuthorized && authorized && (
              <Alert variant="success" title={`NFC-e ${authorized.numero ?? ""} autorizada`}>
                {authorized.chave ? `Chave de acesso: ...${authorized.chave.slice(-8)}. ` : ""}Use os botões abaixo para imprimir ou baixar o DANFE.
              </Alert>
            )}
            {emitError && <Alert variant="error" title="Nota não emitida">{emitError}</Alert>}
            {previewIssues.length > 0 && !isAuthorized && (
              <Alert
                variant="warning"
                title="Dados fiscais incompletos — a SEFAZ rejeitaria esta nota"
                action={<Button size="xs" variant="outline" onClick={goProducts} iconLeft={<ExternalLink size={14} />}>Editar produto</Button>}
              >
                <ul className="list-disc pl-4">
                  {previewIssues.map((p, idx) => (
                    <li key={`${p.item.id}-${idx}`}>{p.item.productName}: {p.msg}</li>
                  ))}
                </ul>
                <span className="mt-1 block">Corrija em Cardápio &gt; Conferência fiscal e volte aqui para emitir.</span>
              </Alert>
            )}

            <dl className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
              <DetailField label="Data" value={new Date(preview.createdAt).toLocaleString("pt-BR")} />
              <DetailField label="Cliente" value={customerLabel(preview)} />
              <DetailField label="Pagamento" value={paymentLabel(preview.paymentMethod)} />
              <DetailField
                label="CPF/CNPJ do consumidor"
                value={preview.customerCpf ? fmtDoc(preview.customerCpf) : "Não informado"}
              />
            </dl>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 text-[11px] font-medium text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Qtd × Produto</th>
                    <th className="px-3 py-2 text-left">NCM</th>
                    <th className="px-3 py-2 text-left">CFOP</th>
                    <th className="px-3 py-2 text-left">CSOSN</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.items.map((it) => {
                    const bad = itemIssues(it);
                    return (
                      <tr key={it.id}>
                        <td className="px-3 py-2 text-slate-800">{it.quantity} × {it.productName}</td>
                        <td className={`px-3 py-2 font-mono ${/^\d{8}$/.test(it.ncm) && it.ncm !== "00000000" ? "text-slate-600" : "text-red-600"}`}>{it.ncm || "—"}</td>
                        <td className={`px-3 py-2 font-mono ${/^\d{4}$/.test(it.cfop) ? "text-slate-600" : "text-red-600"}`}>{it.cfop || "—"}</td>
                        <td className="px-3 py-2 font-mono text-slate-600">{it.csosn || "102"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-800" title={bad.join(", ")}>{fmtMoney(it.quantity * it.price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-600"><span>Subtotal dos itens</span><span className="tabular-nums">{fmtMoney(previewSubtotal)}</span></div>
              {Math.abs(previewAdjust) >= 0.005 && (
                <div className="flex justify-between text-slate-600">
                  <span>
                    {previewAdjust < 0 ? "Descontos" : "Taxas / acréscimos"}
                    {preview.discount ? ` (${preview.discountType === "PERCENT" ? `${preview.discount}%` : fmtMoney(preview.discount)})` : ""}
                  </span>
                  <span className="tabular-nums">{fmtMoney(previewAdjust)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1 text-[13px] font-semibold text-slate-900">
                <span>Total da nota</span><span className="tabular-nums">{fmtMoney(preview.total)}</span>
              </div>
            </div>
            <Badge color="info">{preview.orderType === "DELIVERY" ? "Delivery" : "Balcão/Mesa"}</Badge>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={batchConfirm}
        onClose={() => !batchRunning && setBatchConfirm(false)}
        onConfirm={runBatch}
        title="Emitir NFC-e selecionadas"
        message={
          batchEligible.length === 0
            ? "Nenhum dos pedidos selecionados está com os dados fiscais completos. Corrija os produtos em Cardápio > Conferência fiscal."
            : `Emitir ${batchEligible.length} NFC-e agora, uma por vez, na SEFAZ?${batchSkipped > 0 ? ` ${batchSkipped} pedido${batchSkipped > 1 ? "s" : ""} com dados fiscais incompletos ser${batchSkipped > 1 ? "ão" : "á"} ignorado${batchSkipped > 1 ? "s" : ""}.` : ""} Esta ação não pode ser desfeita (só cancelando a nota depois).`
        }
        confirmLabel={batchEligible.length === 0 ? "Entendi" : "Emitir"}
        variant="primary"
        loading={batchRunning}
      />
    </div>
  );
}
