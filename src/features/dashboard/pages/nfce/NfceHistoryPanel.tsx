import { useState, useEffect, useCallback } from "react";
import { FileText, Download, Printer, AlertCircle } from "lucide-react";
import { PageWrapper, SectionTitle, GridTable, EmptyState, type Column } from "../../../../components";
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

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  AUTHORIZED: { label: "Autorizada", className: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Rejeitada", className: "bg-red-100 text-red-700" },
  CANCELLED: { label: "Cancelada", className: "bg-zinc-200 text-zinc-600" },
  PENDING: { label: "Pendente", className: "bg-amber-100 text-amber-700" },
};

const fmtMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

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
  const [reprintingId, setReprintingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/owner/tenants/${tenant.id}/nfce/list?page=${page}&pageSize=${pageSize}`
      );
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
  }, [tenant.id, page, pageSize]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const fetchDanfe = async (orderId: string): Promise<DanfeData | null> => {
    try {
      return await apiJson<DanfeData>(`/api/owner/tenants/${tenant.id}/nfce/danfe/${orderId}`);
    } catch (err: any) {
      alert(err?.message ?? "Erro ao carregar dados da NFC-e.");
      return null;
    }
  };

  const handleDownload = async (orderId: string) => {
    setReprintingId(orderId);
    const data = await fetchDanfe(orderId);
    setReprintingId(null);
    if (data) downloadDanfePdf(data, tenant.receiptPaperWidth);
  };

  const handlePrint = async (orderId: string) => {
    setReprintingId(orderId);
    const data = await fetchDanfe(orderId);
    setReprintingId(null);
    if (!data) return;
    const desktop = (window as any).pdvDesktop;
    if (desktop?.printDanfe) {
      desktop.printDanfe(data);
    } else {
      printDanfePdf(data, tenant.receiptPaperWidth);
    }
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
      accessor: "customerName",
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
        const status = STATUS_LABELS[row.nfceStatus] ?? { label: row.nfceStatus, className: "bg-zinc-100 text-zinc-600" };
        return (
          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${status.className}`}>
            {status.label}
          </span>
        );
      },
    },
    {
      header: "Ações",
      render: (row) => {
        if (row.nfceStatus !== "AUTHORIZED") return null;
        const busy = reprintingId === row.id;
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
