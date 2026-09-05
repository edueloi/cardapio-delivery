import { useState, useEffect, useCallback, useMemo } from "react";
import { FileText, Download, Printer, AlertCircle, FileCode, Ban, Trash2 } from "lucide-react";
import {
  PageWrapper,
  SectionTitle,
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

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Todos os status" },
  { value: "AUTHORIZED", label: "Autorizada" },
  { value: "REJECTED", label: "Rejeitada" },
  { value: "CANCELLED", label: "Cancelada" },
  { value: "PENDING", label: "Pendente" },
];

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

export default function NfceHistoryPanel({ tenant }: NfceHistoryPanelProps) {
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
        <span className="text-zinc-600">{new Date(row.createdAt).toLocaleString("pt-BR")}</span>
      ),
    },
    {
      header: "Número",
      render: (row) => (row.nfceNumber ? <span className="font-bold text-zinc-800">#{row.nfceNumber}</span> : <span className="text-zinc-300">—</span>),
    },
    {
      header: "Cliente",
      render: (row) => (
        <span className={row.customerName === "Venda PDV" ? "text-zinc-300" : "text-zinc-700"}>
          {row.customerName === "Venda PDV" ? "—" : row.customerName}
        </span>
      ),
    },
    {
      header: "Total",
      render: (row) => <span className="font-bold text-zinc-800">{fmtMoney(row.total)}</span>,
    },
    {
      header: "Chave de acesso",
      render: (row) => (
        <span className="font-mono text-[11px] text-zinc-500">
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
              <button
                onClick={() => handleDownload(row.id)}
                disabled={busy}
                title="Baixar PDF do DANFE"
                className="flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors"
              >
                <Download className="w-3 h-3" />
                PDF
              </button>
              <button
                onClick={() => handlePrint(row.id)}
                disabled={busy}
                title="Imprimir DANFE"
                className="flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors"
              >
                <Printer className="w-3 h-3" />
                Imprimir
              </button>
              <button
                onClick={() => handleDownloadXml(row.id)}
                disabled={busy}
                title="Baixar XML"
                className="flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors"
              >
                <FileCode className="w-3 h-3" />
                XML
              </button>
              <button
                onClick={() => openCancel(row)}
                title="Cancelar NFC-e"
                className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors"
              >
                <Ban className="w-3 h-3" />
                Cancelar
              </button>
            </div>
          );
        }
        // Rejeitada / cancelada / pendente — só sobra excluir (tentativa sem valor fiscal).
        return (
          <button
            onClick={() => setDeleteTarget(row)}
            title="Excluir este registro"
            className="flex items-center gap-1 bg-zinc-100 hover:bg-red-100 hover:text-red-600 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Excluir
          </button>
        );
      },
    },
  ];

  return (
    <PageWrapper>
      <SectionTitle
        title="Notas Fiscais Emitidas"
        description="Histórico de NFC-e emitidas pelo PDV, com reimpressão do DANFE"
        icon={FileText}
      />

      <FilterLine>
        <FilterLineSection grow>
          <FilterLineItem minWidth={260}>
            <FilterLineDateRange from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          </FilterLineItem>
        </FilterLineSection>
        <FilterLineSection align="right">
          <FilterLineItem minWidth={170} fullOnMobile={false}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-bold text-zinc-600 outline-none transition-colors focus:border-amber-400 focus:bg-white"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </FilterLineItem>
          {selectedAuthorizedCount > 0 && (
            <FilterLineItem fullOnMobile={false}>
              <Button size="sm" variant="secondary" onClick={handleDownloadXmlBatch}>
                <FileCode className="w-3.5 h-3.5" />
                Baixar {selectedAuthorizedCount} XML{selectedAuthorizedCount > 1 ? "s" : ""}
              </Button>
            </FilterLineItem>
          )}
          {selectedDeletableCount > 0 && (
            <FilterLineItem fullOnMobile={false}>
              <Button size="sm" variant="danger" onClick={() => setDeleteTarget("batch")}>
                <Trash2 className="w-3.5 h-3.5" />
                Excluir {selectedDeletableCount}
              </Button>
            </FilterLineItem>
          )}
        </FilterLineSection>
      </FilterLine>

      {!loading && orders.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="Nenhuma nota fiscal no período selecionado"
          description="Ajuste o filtro de data/status, ou emita uma NFC-e pelo PDV para ela aparecer aqui."
        />
      ) : (
        <GridTable
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
      )}

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
          <p className="text-sm text-zinc-600">
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
          <p className="text-xs text-zinc-400">{cancelReason.trim().length}/15 caracteres mínimos</p>
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
    </PageWrapper>
  );
}
