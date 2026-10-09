import { useState, useEffect, useCallback, useMemo } from "react";
import { FileText, Download, Printer, AlertCircle, FileCode, Ban, Trash2, ListChecks, CheckCircle2, XCircle, Clock, Receipt, Wallet } from "lucide-react";
import {
  PageWrapper,
  SectionTitle,
  StatGrid,
  StatCard,
  ContentCard,
  Tabs,
  GridTable,
  EmptyState,
  Badge,
  FilterLine,
  FilterLineSection,
  FilterLineItem,
  FilterLineDateRange,
  Modal,
  ModalFooter,
  ConfirmModal,
  Button,
  Textarea,
  useToast,
  type Column,
} from "../../../../components";
import { apiFetch, apiJson } from "../../../../lib/api";
import { downloadDanfePdf, printDanfePdf } from "../../../../lib/receipt";
import type { Tenant, DanfeData } from "../../../../types";
import PendingNfceTab from "./PendingNfceTab";

interface NfceOrderRow {
  id: string;
  customerName: string;
  total: number;
  createdAt: string;
  nfceStatus: string;
  nfceKey: string | null;
  nfceNumber: number | null;
  nfceProtocol: string | null;
}

const STATUS_TABS = [
  { id: "ALL", label: "Todas", icon: ListChecks },
  { id: "AUTHORIZED", label: "Autorizadas", icon: CheckCircle2 },
  { id: "REJECTED", label: "Rejeitadas", icon: XCircle },
  { id: "CANCELLED", label: "Canceladas", icon: Ban },
  { id: "PENDING", label: "Pendentes", icon: Clock },
] as const;
type StatusTabId = (typeof STATUS_TABS)[number]["id"];

const STATUS_BADGE: Record<string, { label: string; color: "success" | "danger" | "default" | "warning" }> = {
  AUTHORIZED: { label: "Autorizada", color: "success" },
  REJECTED: { label: "Rejeitada", color: "danger" },
  CANCELLED: { label: "Cancelada", color: "default" },
  PENDING: { label: "Pendente", color: "warning" },
};

const fmtMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// Primeiro e último dia do mês atual, no formato "YYYY-MM-DD" exigido por DatePicker/FilterLineDateRange.
function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { from: fmt(first), to: fmt(last) };
}

interface NfceHistoryPanelProps {
  slug: string;
  tenant: Tenant;
}

const VIEW_TABS = [
  { id: "pending", label: "A emitir", icon: Receipt },
  { id: "issued", label: "Emitidas", icon: FileText },
] as const;
type ViewTabId = (typeof VIEW_TABS)[number]["id"];

export default function NfceHistoryPanel({ slug, tenant }: NfceHistoryPanelProps) {
  const fiscalEnabled = useMemo(() => {
    try {
      return (tenant.fiscalConfig ? JSON.parse(tenant.fiscalConfig as string) : null)?.enabled === true;
    } catch {
      return false;
    }
  }, [tenant.fiscalConfig]);
  const [view, setView] = useState<ViewTabId>(fiscalEnabled ? "pending" : "issued");
  // Chave para recarregar "Emitidas" depois de emitir pela aba "A emitir".
  const [issuedKey, setIssuedKey] = useState(0);

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle
          title="Notas Fiscais"
          description="Gere a NFC-e dos pedidos sem nota e consulte, reimprima ou cancele as emitidas"
          icon={FileText}
        />
        <Tabs<ViewTabId> items={VIEW_TABS} value={view} onChange={setView} label="Notas fiscais">
          {view === "pending" ? (
            <PendingNfceTab slug={slug} tenant={tenant} fiscalEnabled={fiscalEnabled} onChanged={() => setIssuedKey((k) => k + 1)} />
          ) : (
            <IssuedNfceTab key={issuedKey} tenant={tenant} />
          )}
        </Tabs>
      </div>
    </PageWrapper>
  );
}

function IssuedNfceTab({ tenant }: { tenant: Tenant }) {
  const toast = useToast();
  const [orders, setOrders] = useState<NfceOrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const defaultRange = useMemo(currentMonthRange, []);
  const [dateFrom, setDateFrom] = useState<string | null>(defaultRange.from);
  const [dateTo, setDateTo] = useState<string | null>(defaultRange.to);
  const [statusFilter, setStatusFilter] = useState("");

  const [cancelTarget, setCancelTarget] = useState<NfceOrderRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<NfceOrderRow | "batch" | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (statusFilter) params.set("status", statusFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await apiFetch(`/api/owner/tenants/${tenant.id}/nfce/list?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
        setTotal(data.total);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [tenant.id, page, pageSize, statusFilter, dateFrom, dateTo]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  // Filtro mudou — volta pra primeira página e limpa seleção (a seleção é só da página atual).
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [statusFilter, dateFrom, dateTo]);

  const fetchDanfe = async (orderId: string): Promise<DanfeData | null> => {
    try {
      return await apiJson<DanfeData>(`/api/owner/tenants/${tenant.id}/nfce/danfe/${orderId}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao carregar dados da NFC-e.");
      return null;
    }
  };

  const handleDownload = async (orderId: string) => {
    setBusyId(orderId);
    const data = await fetchDanfe(orderId);
    setBusyId(null);
    if (data) downloadDanfePdf(data, tenant.receiptPaperWidth);
  };

  const handlePrint = async (orderId: string) => {
    setBusyId(orderId);
    const data = await fetchDanfe(orderId);
    setBusyId(null);
    if (!data) return;
    const desktop = (window as any).pdvDesktop;
    if (desktop?.printDanfe) {
      desktop.printDanfe(data);
    } else {
      printDanfePdf(data, tenant.receiptPaperWidth);
    }
  };

  const handleDownloadXml = async (orderId: string) => {
    setBusyId(orderId);
    try {
      const res = await apiFetch(`/api/owner/tenants/${tenant.id}/nfce/xml/${orderId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error ?? "Erro ao baixar XML.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? `NFCe-${orderId}.xml`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao baixar XML.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDownloadXmlBatch = async () => {
    const ids = Array.from(selectedIds).filter((id) => {
      const row = orders.find((o) => o.id === id);
      return row?.nfceStatus === "AUTHORIZED";
    });
    for (const id of ids) {
      // Sequencial (não em paralelo) — evita disparar dezenas de downloads simultâneos e
      // o navegador bloquear alguns como popup/flood de downloads.
      await handleDownloadXml(id);
    }
  };

  const openCancel = (row: NfceOrderRow) => {
    setCancelTarget(row);
    setCancelReason("");
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    if (cancelReason.trim().length < 15) {
      toast.error("Justificativa deve ter ao menos 15 caracteres.");
      return;
    }
    setCancelling(true);
    try {
      const result = await apiJson<{ success: boolean; motivo?: string }>(
        `/api/owner/tenants/${tenant.id}/nfce/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: cancelTarget.id, justificativa: cancelReason.trim() }),
        }
      );
      if (result.success) {
        toast.success("NFC-e cancelada.");
        setCancelTarget(null);
        fetchOrders();
      } else {
        toast.error(result.motivo ?? "Falha ao cancelar NFC-e.");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao cancelar NFC-e.");
    } finally {
      setCancelling(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget === "batch") {
        const ids = Array.from(selectedIds).filter((id) => {
          const row = orders.find((o) => o.id === id);
          return row && row.nfceStatus !== "AUTHORIZED";
        });
        for (const id of ids) {
          await apiJson(`/api/owner/tenants/${tenant.id}/nfce/${id}`, { method: "DELETE" });
        }
        toast.success(`${ids.length} nota${ids.length > 1 ? "s" : ""} excluída${ids.length > 1 ? "s" : ""}.`);
        setSelectedIds(new Set());
      } else {
        await apiJson(`/api/owner/tenants/${tenant.id}/nfce/${deleteTarget.id}`, { method: "DELETE" });
        toast.success("Nota excluída.");
      }
      setDeleteTarget(null);
      fetchOrders();
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao excluir.");
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const allSelected = orders.length > 0 && orders.every((o) => prev.has(o.id));
      if (allSelected) return new Set();
      return new Set(orders.map((o) => o.id));
    });
  };

  const selectedAuthorizedCount = Array.from(selectedIds).filter(
    (id) => orders.find((o) => o.id === id)?.nfceStatus === "AUTHORIZED"
  ).length;
  const selectedDeletableCount = Array.from(selectedIds).filter(
    (id) => orders.find((o) => o.id === id)?.nfceStatus !== "AUTHORIZED"
  ).length;

  const columns: Column<NfceOrderRow>[] = [
    {
      header: "Data",
      render: (row) => (
        <span className="text-xs text-slate-600 whitespace-nowrap">{new Date(row.createdAt).toLocaleString("pt-BR")}</span>
      ),
    },
    {
      header: "Número",
      render: (row) => (row.nfceNumber ? <span className="text-xs font-semibold text-slate-800">#{row.nfceNumber}</span> : <span className="text-xs text-slate-300">—</span>),
    },
    {
      header: "Cliente",
      render: (row) => (
        <span className={row.customerName === "Venda PDV" ? "text-xs text-slate-300" : "text-xs text-slate-700"}>
          {row.customerName === "Venda PDV" ? "—" : row.customerName}
        </span>
      ),
    },
    {
      header: "Total",
      render: (row) => <span className="text-xs font-semibold tabular-nums whitespace-nowrap text-slate-800">{fmtMoney(row.total)}</span>,
    },
    {
      header: "Chave de acesso",
      render: (row) => (
        <span className="font-mono text-[11px] text-slate-500">
          {row.nfceKey ? `...${row.nfceKey.slice(-8)}` : "—"}
        </span>
      ),
    },
    {
      header: "Status",
      render: (row) => {
        const status = STATUS_BADGE[row.nfceStatus] ?? { label: row.nfceStatus, color: "default" as const };
        return <Badge color={status.color}>{status.label}</Badge>;
      },
    },
    {
      header: "Ações",
      render: (row) => {
        const busy = busyId === row.id;
        if (row.nfceStatus === "AUTHORIZED") {
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="xs" variant="outline" onClick={() => handleDownload(row.id)} disabled={busy} title="Baixar PDF do DANFE" iconLeft={<Download size={14} />}>
                PDF
              </Button>
              <Button size="xs" variant="outline" onClick={() => handlePrint(row.id)} disabled={busy} title="Imprimir DANFE" iconLeft={<Printer size={14} />}>
                Imprimir
              </Button>
              <Button size="xs" variant="outline" onClick={() => handleDownloadXml(row.id)} disabled={busy} title="Baixar XML" iconLeft={<FileCode size={14} />}>
                XML
              </Button>
              <Button size="xs" variant="danger" onClick={() => openCancel(row)} title="Cancelar NFC-e" iconLeft={<Ban size={14} />}>
                Cancelar
              </Button>
            </div>
          );
        }
        // Rejeitada / cancelada / pendente — só sobra excluir (tentativa sem valor fiscal).
        return (
          <Button size="xs" variant="outline" onClick={() => setDeleteTarget(row)} title="Excluir este registro" iconLeft={<Trash2 size={14} />}>
            Excluir
          </Button>
        );
      },
    },
  ];

  const pageTotal = orders.reduce((sum, o) => sum + o.total, 0);
  const authorizedInPage = orders.filter((o) => o.nfceStatus === "AUTHORIZED").length;

  const filters = (
    <FilterLine>
      <FilterLineSection grow>
        <FilterLineItem minWidth={260}>
          <FilterLineDateRange from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
        </FilterLineItem>
      </FilterLineSection>
      <FilterLineSection align="right">
        {selectedAuthorizedCount > 0 && (
          <FilterLineItem fullOnMobile={false}>
            <Button size="sm" variant="secondary" onClick={handleDownloadXmlBatch} iconLeft={<FileCode size={14} />}>
              Baixar {selectedAuthorizedCount} XML{selectedAuthorizedCount > 1 ? "s" : ""}
            </Button>
          </FilterLineItem>
        )}
        {selectedDeletableCount > 0 && (
          <FilterLineItem fullOnMobile={false}>
            <Button size="sm" variant="danger" onClick={() => setDeleteTarget("batch")} iconLeft={<Trash2 size={14} />}>
              Excluir {selectedDeletableCount}
            </Button>
          </FilterLineItem>
        )}
      </FilterLineSection>
    </FilterLine>
  );

  return (
    <>
      <div className="space-y-4">
        <StatGrid cols={3}>
          <StatCard title="Notas no período" value={total} icon={Receipt} color="info" />
          <StatCard title="Autorizadas na página" value={authorizedInPage} icon={CheckCircle2} color="success" />
          <StatCard title="Valor na página" value={fmtMoney(pageTotal)} icon={Wallet} color="default" />
        </StatGrid>

        <Tabs<StatusTabId>
          items={STATUS_TABS}
          value={(statusFilter || "ALL") as StatusTabId}
          onChange={(v) => setStatusFilter(v === "ALL" ? "" : v)}
          label="Status da nota fiscal"
        >
          <div className="space-y-3">
            {filters}

            {!loading && orders.length === 0 ? (
              <ContentCard>
                <EmptyState
                  icon={AlertCircle}
                  title="Nenhuma nota fiscal no período selecionado"
                  description="Ajuste o filtro de data/status, ou emita uma NFC-e pelo PDV para ela aparecer aqui."
                />
              </ContentCard>
            ) : (
              <ContentCard padding="none">
                <GridTable
                  noDesktopCard
                  data={orders}
                  columns={columns}
                  keyExtractor={(row) => row.id}
                  isLoading={loading}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onToggleSelectAll={toggleSelectAll}
                  pagination={{
                    total,
                    page,
                    pageSize,
                    onPageChange: setPage,
                    onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
                  }}
                />
              </ContentCard>
            )}
          </div>
        </Tabs>
      </div>

      <Modal
        isOpen={!!cancelTarget}
        onClose={() => !cancelling && setCancelTarget(null)}
        title="Cancelar NFC-e"
        size="sm"
        mobileStyle="center"
        footer={
          <ModalFooter>
            <Button variant="ghost" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              Voltar
            </Button>
            <Button variant="danger" onClick={confirmCancel} disabled={cancelling}>
              {cancelling ? "Cancelando..." : "Confirmar cancelamento"}
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3">
          <p className="text-[13px] text-slate-600">
            NFC-e <strong>#{cancelTarget?.nfceNumber}</strong> será cancelada junto à SEFAZ. A
            justificativa é obrigatória (mínimo 15 caracteres).
          </p>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Ex: Venda cancelada a pedido do cliente."
            rows={3}
            autoFocus
          />
          <p className="text-[11px] text-slate-500">{cancelReason.trim().length}/15 caracteres mínimos</p>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Excluir nota fiscal"
        message={
          deleteTarget === "batch"
            ? `Excluir ${selectedDeletableCount} nota${selectedDeletableCount > 1 ? "s" : ""} selecionada${selectedDeletableCount > 1 ? "s" : ""}? Essa ação remove o(s) pedido(s) por completo (nunca afeta notas autorizadas) e não pode ser desfeita.`
            : "Excluir este registro? A ação remove o pedido por completo e não pode ser desfeita."
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
      />
    </>
  );
}
