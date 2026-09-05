import { useState, useEffect, useCallback, useMemo } from "react";
import { FileText, Download, Printer, AlertCircle, FileCode } from "lucide-react";
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
      alert(err?.message ?? "Erro ao carregar dados da NFC-e.");
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
        alert(err?.error ?? "Erro ao baixar XML.");
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
      alert("Erro ao baixar XML.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDownloadXmlBatch = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      // Sequencial (não em paralelo) — evita disparar dezenas de downloads simultâneos e
      // o navegador bloquear alguns como popup/flood de downloads.
      await handleDownloadXml(id);
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

  const authorizedOnPage = orders.filter((o) => o.nfceStatus === "AUTHORIZED");
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const allSelected = authorizedOnPage.length > 0 && authorizedOnPage.every((o) => prev.has(o.id));
      if (allSelected) return new Set();
      return new Set(authorizedOnPage.map((o) => o.id));
    });
  };

  const columns: Column<NfceOrderRow>[] = [
    {
      header: "Data",
      render: (row) => new Date(row.createdAt).toLocaleString("pt-BR"),
    },
    {
      header: "Número",
      render: (row) => row.nfceNumber ? `#${row.nfceNumber}` : "—",
    },
    {
      header: "Cliente",
      render: (row) => (row.customerName === "Venda PDV" ? "—" : row.customerName),
    },
    {
      header: "Total",
      render: (row) => fmtMoney(row.total),
    },
    {
      header: "Chave de acesso",
      render: (row) => row.nfceKey ? `...${row.nfceKey.slice(-8)}` : "—",
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
        if (row.nfceStatus !== "AUTHORIZED") return null;
        const busy = busyId === row.id;
        return (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleDownload(row.id)}
              disabled={busy}
              className="flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors"
            >
              <Download className="w-3 h-3" />
              PDF
            </button>
            <button
              onClick={() => handlePrint(row.id)}
              disabled={busy}
              className="flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors"
            >
              <Printer className="w-3 h-3" />
              Imprimir
            </button>
            <button
              onClick={() => handleDownloadXml(row.id)}
              disabled={busy}
              className="flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors"
            >
              <FileCode className="w-3 h-3" />
              XML
            </button>
          </div>
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
          <FilterLineItem minWidth={220}>
            <FilterLineDateRange from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          </FilterLineItem>
        </FilterLineSection>
        <FilterLineSection>
          <FilterLineItem minWidth={170}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-black text-zinc-600 outline-none focus:border-amber-400"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </FilterLineItem>
          {selectedIds.size > 0 && (
            <FilterLineItem>
              <button
                onClick={handleDownloadXmlBatch}
                className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl bg-amber-500 hover:bg-amber-600 px-3 text-xs font-black text-white transition-colors"
              >
                <FileCode className="w-3.5 h-3.5" />
                Baixar {selectedIds.size} XML{selectedIds.size > 1 ? "s" : ""}
              </button>
            </FilterLineItem>
          )}
        </FilterLineSection>
      </FilterLine>

      {!loading && orders.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="Nenhuma nota fiscal emitida ainda"
          description="Notas emitidas pelo PDV aparecerão aqui, com opção de baixar ou reimprimir o DANFE."
        />
      ) : (
        <GridTable
          data={orders}
          columns={columns}
          keyExtractor={(row) => row.id}
          isLoading={loading}
          selectedIds={selectedIds}
          onToggleSelect={(id) => {
            const row = orders.find((o) => o.id === id);
            if (row?.nfceStatus === "AUTHORIZED") toggleSelect(id);
          }}
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
    </PageWrapper>
  );
}
