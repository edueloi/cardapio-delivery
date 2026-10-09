import React, { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, Lock, Unlock,
  TrendingUp, Banknote, CreditCard, QrCode, Receipt, History,
  CheckCircle2, AlertCircle, RefreshCw, Loader2,
  ArrowLeftRight, ChevronRight, ChevronDown, Tag, Percent,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import {
  PageWrapper, SectionTitle, ContentCard, StatGrid, StatCard, PanelCard, Tabs, Alert, IconButton,
  FilterLineSegmented, FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch,
  Modal, ModalFooter, Button, Input, EmptyState, Switch,
  useToast,
} from "../../../../components";
import { apiFetch, apiJson } from "../../../../lib/api";
import { printCashClosingReportPdf } from "../../../../lib/receipt";
import type { Tenant, CashRegister, CashMovement } from "../../../../types";

// Carregado sob demanda: recharts + exceljs só pesam no bundle quando a aba
// Histórico é de fato aberta, não no carregamento inicial do Financeiro.
const CashHistoryPanel = React.lazy(() => import("./CashHistoryPanel"));

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const MOVEMENT_META: Record<string, { label: string; color: string; bg: string; textBg: string; icon: React.ElementType; isOut: boolean }> = {
  SANGRIA:        { label: "Sangria",    color: "text-red-600",     bg: "bg-red-100",    textBg: "bg-red-50",   icon: ArrowUpCircle,   isOut: true  },
  SUPRIMENTO:     { label: "Suprimento", color: "text-green-600",   bg: "bg-green-100",  textBg: "bg-green-50", icon: ArrowDownCircle, isOut: false },
  PAYMENT_CASH:   { label: "Dinheiro",   color: "text-amber-700",   bg: "bg-amber-100",  textBg: "bg-amber-50", icon: Banknote,        isOut: false },
  PAYMENT_PIX:    { label: "Pix",        color: "text-violet-700",  bg: "bg-violet-100", textBg: "bg-violet-50",icon: QrCode,          isOut: false },
  PAYMENT_CREDIT: { label: "Crédito",    color: "text-blue-700",    bg: "bg-blue-100",   textBg: "bg-blue-50",  icon: CreditCard,      isOut: false },
  PAYMENT_DEBIT:  { label: "Débito",     color: "text-cyan-700",    bg: "bg-cyan-100",   textBg: "bg-cyan-50",  icon: CreditCard,      isOut: false },
  PAYMENT_VR:     { label: "VR/Ticket",  color: "text-emerald-700", bg: "bg-emerald-100",textBg:"bg-emerald-50",icon: Receipt,         isOut: false },
};

// Estornos ficam como movimentos próprios: não apagam a venda original e permitem
// conferir exatamente quando e de que forma o dinheiro foi devolvido.
Object.assign(MOVEMENT_META, {
  REFUND_CASH: { label: "Estorno em dinheiro", color: "text-red-700", bg: "bg-red-100", textBg: "bg-red-50", icon: ArrowUpCircle, isOut: true },
  REFUND_PIX: { label: "Estorno Pix", color: "text-red-700", bg: "bg-red-100", textBg: "bg-red-50", icon: ArrowUpCircle, isOut: true },
  REFUND_CREDIT: { label: "Estorno crédito", color: "text-red-700", bg: "bg-red-100", textBg: "bg-red-50", icon: ArrowUpCircle, isOut: true },
  REFUND_DEBIT: { label: "Estorno débito", color: "text-red-700", bg: "bg-red-100", textBg: "bg-red-50", icon: ArrowUpCircle, isOut: true },
  REFUND_VR: { label: "Estorno VR/Ticket", color: "text-red-700", bg: "bg-red-100", textBg: "bg-red-50", icon: ArrowUpCircle, isOut: true },
});

const PAYMENT_METHODS = ["PAYMENT_CASH", "PAYMENT_PIX", "PAYMENT_CREDIT", "PAYMENT_DEBIT", "PAYMENT_VR"] as const;

function todayISO() { return new Date().toISOString().split("T")[0]; }
function firstOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

type RevenuePeriod = "today" | "week" | "month" | "year";
function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function revenuePeriodRange(period: RevenuePeriod): { from: string; to: string } {
  const now = new Date();
  if (period === "today") { const t = toISODate(now); return { from: t, to: t }; }
  if (period === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: toISODate(start), to: toISODate(end) };
  }
  if (period === "year") return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
  return { from: firstOfMonthISO(), to: todayISO() };
}
const REVENUE_PERIOD_LABEL: Record<RevenuePeriod, string> = {
  today: "Hoje", week: "Esta semana", month: "Mês atual", year: "Este ano",
};

interface Summary {
  totalRevenue: number; orderCount: number; totalSangrias: number;
  totalSuprimentos: number; netBalance: number;
  byMethod: Record<string, number>; byDay: Record<string, number>;
  movements: Array<{ type: string; amount: number; description?: string; createdAt: string }>;
}

type CashTab = "caixa" | "movimentos" | "historico";
type MovementFilter = "all" | "sales" | "sangria" | "suprimento" | "refund";

interface CashFlowPanelProps { slug: string; tenant: Tenant; }

// ─── Sparkline de barras ────────────────────────────────────────────────────
const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// No período "Ano", agrega por mês (12 barras) em vez de por dia — sem isso, um
// ano inteiro tentaria desenhar até 365 barras diárias espremidas na mesma faixa.
function groupByMonth(byDay: Record<string, number>): Record<string, number> {
  const byMonth: Record<string, number> = {};
  for (const [day, val] of Object.entries(byDay)) {
    const monthKey = day.slice(0, 7); // "YYYY-MM"
    byMonth[monthKey] = (byMonth[monthKey] || 0) + val;
  }
  return byMonth;
}

function SparkBar({ byDay, maxBars = 31, granularity = "day" }: { byDay: Record<string, number>; maxBars?: number; granularity?: "day" | "month" }) {
  const data = granularity === "month" ? groupByMonth(byDay) : byDay;
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b)).slice(-maxBars);
  if (entries.length === 0) return null;
  const chartData = entries.map(([key, val]) => ({
    label: granularity === "month"
      ? `${MONTH_SHORT[Number(key.slice(5, 7)) - 1]}/${key.slice(2, 4)}`
      : fmtDate(key),
    value: val,
  }));
  return (
    <div className="h-56 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} interval="preserveStartEnd" />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} width={48} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))} />
          <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(v: number) => [fmt(v), ""]} separator="" contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }} />
          <Bar dataKey="value" fill="#2563eb" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Linha de forma de pagamento ────────────────────────────────────────────
function MethodRow({ type, value, total }: { type: string; value: number; total: number }) {
  const meta = MOVEMENT_META[type] || MOVEMENT_META.PAYMENT_CASH;
  const Icon = meta.icon;
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-slate-800 truncate">{meta.label}</span>
          <span className="text-[13px] font-semibold tabular-nums text-slate-800">{fmt(value)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} className="h-full rounded-full bg-blue-600" />
          </div>
          <span className="text-[11px] text-slate-500 w-8 text-right tabular-nums">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

// ─── Linha de movimento ──────────────────────────────────────────────────────
// Quando o movimento vem de uma venda (m.order presente), a linha fica clicável e
// expande o detalhamento: valor bruto dos itens, desconto, taxa de maquininha/serviço
// (e se foi repassada ao cliente), valor líquido, e a lista de itens vendidos.
function MovementRow({ m, onCancelOrder }: { m: CashMovement; onCancelOrder?: (order: any) => void }) {
  const [expanded, setExpanded] = useState(false);
  const meta = MOVEMENT_META[m.type] || MOVEMENT_META.PAYMENT_CASH;
  const Icon = meta.icon;
  const order = m.order;
  const isExpandable = !!order;

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <div
        onClick={() => isExpandable && setExpanded((v) => !v)}
        className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${isExpandable ? "cursor-pointer hover:bg-slate-50" : ""}`}
      >
        <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${meta.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-slate-800 truncate">{m.description || meta.label}</p>
          <p className="text-[11px] text-slate-500">{fmtDateTime(m.createdAt)}{m.operatorName ? ` · ${m.operatorName}` : ""}</p>
        </div>
        <span className={`text-[13px] font-semibold shrink-0 tabular-nums ${meta.isOut ? "text-red-600" : "text-emerald-700"}`}>
          {meta.isOut ? "−" : "+"}{fmt(m.amount)}
        </span>
        {isExpandable && (
          <ChevronDown className={`w-4 h-4 text-slate-300 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
        )}
      </div>

      <AnimatePresence>
        {expanded && order && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-100 space-y-3">
              {/* Itens vendidos */}
              <div className="space-y-1.5">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-semibold">{item.quantity}x {item.productName}</span>
                    <span className="text-slate-500 tabular-nums">{fmt(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              {m.type.startsWith("PAYMENT_") && (
                <Button variant="danger" size="xs" fullWidth onClick={() => onCancelOrder?.(order)}>
                  Cancelar pedido e estornar
                </Button>
              )}

              <div className="h-px bg-slate-200" />

              {/* Detalhamento financeiro */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Valor bruto</span>
                  <span className="text-slate-600 tabular-nums">{fmt(order.grossTotal)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Desconto{order.discountType === "PERCENT" ? " (%)" : ""}
                    </span>
                    <span className="text-red-500 tabular-nums">−{fmt(order.discount)}</span>
                  </div>
                )}
                {order.feeAmount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Percent className="w-3 h-3" /> Taxa maquininha{order.feePercent ? ` (${order.feePercent.toFixed(2)}%)` : ""}
                    </span>
                    <span className={`tabular-nums ${order.feePassedToCustomer ? "text-slate-400" : "text-red-500"}`}>
                      {order.feePassedToCustomer ? `${fmt(order.feeAmount)} (repassada ao cliente)` : `−${fmt(order.feeAmount)}`}
                    </span>
                  </div>
                )}
                {order.serviceFeeAmount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Taxa de serviço{order.serviceFeePercent ? ` (${order.serviceFeePercent}%)` : ""}</span>
                    <span className="text-slate-600 tabular-nums">+{fmt(order.serviceFeeAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200">
                  <span className="text-slate-700 font-semibold">Total recebido</span>
                  <span className="text-slate-800 font-semibold tabular-nums">{fmt(order.total)}</span>
                </div>
                {!order.feePassedToCustomer && order.feeAmount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-semibold">Líquido real (após taxa)</span>
                    <span className="text-green-600 font-semibold tabular-nums">{fmt(order.total - order.feeAmount)}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function CashFlowPanel({ slug, tenant }: CashFlowPanelProps) {
  const toast = useToast();
  const [currentCash, setCurrentCash] = useState<CashRegister | null>(null);
  const [movements,   setMovements]   = useState<CashMovement[]>([]);
  const [summary,     setSummary]     = useState<Summary | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<CashTab>("caixa");
  const [movSearch,   setMovSearch]   = useState("");
  const [movFilter,   setMovFilter]   = useState<MovementFilter>("all");

  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>("month");
  const [dateFrom, setDateFrom] = useState<string | null>(firstOfMonthISO());
  const [dateTo,   setDateTo]   = useState<string | null>(todayISO());
  const [autoRegister, setAutoRegister] = useState(true);

  const handleRevenuePeriodChange = (period: RevenuePeriod) => {
    setRevenuePeriod(period);
    const r = revenuePeriodRange(period);
    setDateFrom(r.from);
    setDateTo(r.to);
  };

  const [showOpenModal,     setShowOpenModal]     = useState(false);
  const [showCloseModal,    setShowCloseModal]    = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [openingBalance,    setOpeningBalance]    = useState("0");
  const [openLoading,       setOpenLoading]       = useState(false);
  const [closingBalance,    setClosingBalance]    = useState("");
  const [countedByMethod,   setCountedByMethod]   = useState<Record<string, string>>({});
  const [closeNotes,        setCloseNotes]        = useState("");
  const [closeLoading,      setCloseLoading]      = useState(false);
  const [movementType,      setMovementType]      = useState<"SANGRIA" | "SUPRIMENTO">("SANGRIA");
  const [movementAmount,    setMovementAmount]    = useState("");
  const [movementDesc,      setMovementDesc]      = useState("");
  const [movementLoading,   setMovementLoading]   = useState(false);
  const [cancelOrder, setCancelOrder] = useState<any | null>(null);
  const [cancelPassword, setCancelPassword] = useState("");
  const [restockInventory, setRestockInventory] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const fetchCaixa = useCallback(async () => {
    const [cashRes, movRes] = await Promise.all([
      apiFetch(`/api/tenants/${slug}/cash/current`),
      apiFetch(`/api/tenants/${slug}/cash/movements`),
    ]);
    setCurrentCash(cashRes.ok ? await cashRes.json() : null);
    setMovements(movRes.ok ? await movRes.json() : []);
  }, [slug]);

  const fetchResumo = useCallback(async () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo)   params.set("to",   dateTo);
    const res = await apiFetch(`/api/tenants/${slug}/cash/summary?${params}`);
    setSummary(res.ok ? await res.json() : null);
  }, [slug, dateFrom, dateTo]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try { await Promise.all([fetchCaixa(), fetchResumo()]); }
    finally { setLoading(false); }
  }, [fetchCaixa, fetchResumo]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { if (!loading) { fetchResumo(); } }, [dateFrom, dateTo]);

  const paymentTotals = useMemo(() =>
    movements.reduce<Record<string, number>>((acc, m) => {
      if (m.type.startsWith("PAYMENT_")) acc[m.type] = (acc[m.type] || 0) + m.amount;
      if (m.type.startsWith("REFUND_")) {
        const paymentType = m.type.replace("REFUND_", "PAYMENT_");
        acc[paymentType] = (acc[paymentType] || 0) - m.amount;
      }
      return acc;
    }, {}), [movements]);

  const totalSangrias    = useMemo(() => movements.filter(m => m.type === "SANGRIA").reduce((s, m) => s + m.amount, 0), [movements]);
  const totalSuprimentos = useMemo(() => movements.filter(m => m.type === "SUPRIMENTO").reduce((s, m) => s + m.amount, 0), [movements]);
  const totalVendas      = useMemo(() => movements.reduce((s, m) => s + (m.type.startsWith("PAYMENT_") ? m.amount : m.type.startsWith("REFUND_") ? -m.amount : 0), 0), [movements]);
  const expectedBalance  = (currentCash?.openingBalance ?? 0) + (paymentTotals["PAYMENT_CASH"] ?? 0) + totalSuprimentos - totalSangrias;
  const diffBalance      = closingBalance ? parseFloat(closingBalance) - expectedBalance : 0;
  const isOpen           = currentCash?.status === "OPEN";

  // Resumo do caixa a qualquer momento do dia, sem precisar fechar — pedido explícito
  // do dono pra conferir vendas/formas de pagamento no meio do turno.
  const handlePrintDaySummary = () => {
    if (!currentCash) return;
    const ordersCount = movements.filter((m) => m.type.startsWith("PAYMENT_")).length;
    const salesByMethod = Object.entries(paymentTotals)
      .filter(([, total]) => total > 0)
      .map(([type, total]) => ({ method: type.replace("PAYMENT_", ""), total }));
    const summaryData = {
      openedAt: currentCash.openedAt,
      openingBalance: currentCash.openingBalance,
      closingBalance: 0,
      expectedBalance,
      ordersCount,
      grossTotal: totalVendas,
      salesByMethod,
      movements: movements.map((m) => ({ type: m.type, amount: m.amount, description: m.description })),
      isPreview: true,
    };
    const desktop = (window as any).pdvDesktop;
    if (desktop?.printCashClosingReport) {
      desktop.printCashClosingReport(tenant.name, summaryData);
    } else {
      printCashClosingReportPdf(tenant.name, summaryData, (tenant.receiptPaperWidth === 58 ? 58 : 80) as 58 | 80);
    }
  };

  const handleOpenCash = async () => {
    setOpenLoading(true);
    try {
      await apiJson(`/api/tenants/${slug}/cash/open`, { method: "POST", body: JSON.stringify({ openingBalance: parseFloat(openingBalance || "0") }) });
      setShowOpenModal(false); setOpeningBalance("0");
      fetchCaixa();
    } catch { toast.error("Erro ao abrir caixa."); }
    finally { setOpenLoading(false); }
  };

  const handleCloseCash = async () => {
    setCloseLoading(true);
    try {
      const countedBreakdown = Object.fromEntries(
        Object.entries(countedByMethod)
          .filter(([, value]) => value.trim() !== "")
          .map(([method, value]) => [method, parseFloat(value)])
      );
      await apiJson(`/api/tenants/${slug}/cash/close`, { method: "POST", body: JSON.stringify({ closingBalance: parseFloat(closingBalance), countedBreakdown, notes: closeNotes }) });
      setShowCloseModal(false); setClosingBalance(""); setCountedByMethod({}); setCloseNotes("");
      fetchAll();
    } catch { toast.error("Erro ao fechar caixa."); }
    finally { setCloseLoading(false); }
  };

  const handleMovement = async () => {
    setMovementLoading(true);
    try {
      await apiJson(`/api/tenants/${slug}/cash/movement`, { method: "POST", body: JSON.stringify({ type: movementType, amount: parseFloat(movementAmount || "0"), description: movementDesc }) });
      setShowMovementModal(false); setMovementAmount(""); setMovementDesc("");
      fetchCaixa();
    } catch { toast.error("Erro ao registrar movimento."); }
    finally { setMovementLoading(false); }
  };

  const handleCancelOrder = async () => {
    if (!cancelOrder || !cancelPassword) return;
    setCancelling(true);
    try {
      await apiJson(`/api/orders/${cancelOrder.id}/cancel`, { method: "POST", body: JSON.stringify({ password: cancelPassword, restockInventory }) });
      toast.success(restockInventory ? "Pedido cancelado, estornado e devolvido ao estoque." : "Pedido cancelado e estornado; estoque mantido como perda.");
      setCancelOrder(null); setCancelPassword(""); await fetchAll();
    } catch (err: any) { toast.error(err?.message || "Não foi possível cancelar o pedido."); }
    finally { setCancelling(false); }
  };

  if (loading) {
    return (
      <PageWrapper>
        <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 size={18} className="animate-spin" />Carregando fluxo de caixa…
        </div>
      </PageWrapper>
    );
  }

  const cashTabs = [
    { id: "caixa" as const, label: "Caixa do dia", icon: Wallet },
    { id: "movimentos" as const, label: "Movimentos", icon: ArrowLeftRight, badge: movements.length },
    { id: "historico" as const, label: "Histórico", icon: History },
  ];

  const filteredMovements = movements.filter((m) => {
    if (movFilter === "sales" && !m.type.startsWith("PAYMENT_")) return false;
    if (movFilter === "sangria" && m.type !== "SANGRIA") return false;
    if (movFilter === "suprimento" && m.type !== "SUPRIMENTO") return false;
    if (movFilter === "refund" && !m.type.startsWith("REFUND_")) return false;
    if (movSearch.trim()) {
      const term = movSearch.trim().toLowerCase();
      const hay = `${m.description || ""} ${MOVEMENT_META[m.type]?.label || ""} ${m.operatorName || ""}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  return (
    <PageWrapper>
      <div className="space-y-4">
        {/* ── Header ── */}
        <SectionTitle
          title="Fluxo de Caixa"
          description="Entradas, saídas e resumo financeiro do dia"
          icon={Wallet}
          action={
            <>
              {isOpen && (
                <>
                  <Button variant="outline" size="sm" onClick={handlePrintDaySummary} iconLeft={<Receipt size={14} />}>Imprimir resumo</Button>
                  <Button variant="outline" size="sm" onClick={() => { setMovementType("SUPRIMENTO"); setShowMovementModal(true); }} iconLeft={<ArrowDownCircle size={14} />}>Suprimento</Button>
                  <Button variant="outline" size="sm" onClick={() => { setMovementType("SANGRIA"); setShowMovementModal(true); }} iconLeft={<ArrowUpCircle size={14} />}>Sangria</Button>
                  <Button variant="danger" size="sm" onClick={() => { setClosingBalance(""); setCloseNotes(""); setShowCloseModal(true); }} iconLeft={<Lock size={14} />}>Fechar caixa</Button>
                </>
              )}
              {!isOpen && (
                <Button size="sm" onClick={() => setShowOpenModal(true)} iconLeft={<Unlock size={14} />}>Abrir caixa</Button>
              )}
              <IconButton variant="outline" size="sm" aria-label="Atualizar" onClick={fetchAll}>
                <RefreshCw size={14} />
              </IconButton>
            </>
          }
        />

        {/* ── KPIs do caixa atual ── */}
        <StatGrid cols={4}>
          <StatCard title="Fundo de caixa" value={fmt(currentCash?.openingBalance ?? 0)} icon={Banknote} color="default" />
          <StatCard title="Total em vendas" value={fmt(totalVendas)} icon={TrendingUp} color="success" />
          <StatCard title="Sangrias" value={fmt(totalSangrias)} description={`Suprimentos: ${fmt(totalSuprimentos)}`} icon={ArrowUpCircle} color="danger" />
          <StatCard title="Saldo esperado" value={fmt(expectedBalance)} icon={Wallet} color="info" />
        </StatGrid>

        <Tabs<CashTab> items={cashTabs} value={activeTab} onChange={setActiveTab} label="Fluxo de caixa">
          {/* ══════ TAB: CAIXA DO DIA ══════ */}
          {activeTab === "caixa" && (
            <div className="space-y-3">
              {/* ── Status do caixa ── */}
              {isOpen ? (
                <Alert variant="success" title="Caixa aberto">
                  Desde {fmtDateTime(currentCash!.openedAt)}
                  {(currentCash!.openedByName || currentCash!.operatorName) ? ` · Aberto por: ${currentCash!.openedByName || currentCash!.operatorName}` : ""}
                  {" · "}Fundo: {fmt(currentCash!.openingBalance)}
                </Alert>
              ) : (
                <ContentCard>
                  <EmptyState
                    icon={Lock}
                    title="Caixa fechado"
                    description="Abra o caixa para registrar vendas e movimentos do dia."
                    action={<Button onClick={() => setShowOpenModal(true)} iconLeft={<Unlock size={14} />}>Abrir caixa</Button>}
                  />
                </ContentCard>
              )}

              {/* ── Receita por método ── */}
              {totalVendas > 0 && (
                <PanelCard title="Receita por forma de pagamento" description={fmt(totalVendas)} icon={CreditCard}>
                  <div className="px-4 py-2 divide-y divide-slate-100">
                    {PAYMENT_METHODS.map(type => (
                      <MethodRow key={type} type={type} value={paymentTotals[type] || 0} total={totalVendas} />
                    ))}
                  </div>
                </PanelCard>
              )}

              {/* ── Gráfico diário ── */}
              {summary && (
                <PanelCard
                  title={`Receita — ${REVENUE_PERIOD_LABEL[revenuePeriod]}`}
                  description={fmt(summary.totalRevenue)}
                  action={
                    <FilterLineSegmented
                      size="sm"
                      value={revenuePeriod}
                      onChange={(v) => handleRevenuePeriodChange(v as RevenuePeriod)}
                      options={[
                        { value: "today", label: "Hoje" },
                        { value: "week", label: "Semana" },
                        { value: "month", label: "Mês" },
                        { value: "year", label: "Ano" },
                      ]}
                    />
                  }
                >
                  <div className="p-3">
                    {Object.keys(summary.byDay).length > 0 ? (
                      <SparkBar
                        byDay={summary.byDay}
                        granularity={revenuePeriod === "year" ? "month" : "day"}
                        maxBars={revenuePeriod === "year" ? 12 : revenuePeriod === "month" ? 31 : revenuePeriod === "week" ? 7 : 1}
                      />
                    ) : (
                      <p className="text-center text-xs text-slate-500 py-8">Sem vendas nesse período</p>
                    )}
                  </div>
                </PanelCard>
              )}

              {/* ── Toggle registro automático ── */}
              <ContentCard padding="md">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Registro automático de pagamentos</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Pagamentos dos pedidos entram como movimentos automaticamente.</p>
                  </div>
                  <Switch checked={autoRegister} onCheckedChange={setAutoRegister} />
                </div>
              </ContentCard>

            </div>
          )}

          {/* ══════ TAB: MOVIMENTOS ══════ */}
          {activeTab === "movimentos" && (
            <div className="space-y-3">
              <FilterLine>
                <FilterLineSection grow>
                  <FilterLineItem grow minWidth={180}>
                    <FilterLineSearch value={movSearch} onChange={setMovSearch} placeholder="Buscar movimento..." aria-label="Buscar movimento" className="max-w-[280px]" />
                  </FilterLineItem>
                  <FilterLineItem fullOnMobile={false}>
                    <FilterLineSegmented
                      value={movFilter}
                      onChange={(v) => setMovFilter(v as MovementFilter)}
                      options={[
                        { value: "all", label: "Todos" },
                        { value: "sales", label: "Vendas" },
                        { value: "sangria", label: "Sangrias" },
                        { value: "suprimento", label: "Suprimentos" },
                        { value: "refund", label: "Estornos" },
                      ]}
                    />
                  </FilterLineItem>
                  <span className="text-xs text-slate-500">{filteredMovements.length} movimento{filteredMovements.length === 1 ? "" : "s"}</span>
                </FilterLineSection>
              </FilterLine>

              <ContentCard padding="none">
                {filteredMovements.length === 0 ? (
                  <EmptyState icon={ArrowLeftRight} title="Nenhum movimento encontrado" description="As vendas, sangrias e suprimentos do caixa atual aparecem aqui." />
                ) : (
                  <div className="max-h-[560px] overflow-y-auto">
                    <AnimatePresence>
                      {filteredMovements.map(m => <MovementRow key={m.id} m={m} onCancelOrder={(order) => { setCancelOrder(order); setCancelPassword(""); setRestockInventory(true); }} />)}
                    </AnimatePresence>
                  </div>
                )}
              </ContentCard>
            </div>
          )}

          {/* ══════ TAB: HISTÓRICO ══════ */}
          {activeTab === "historico" && (
            <Suspense fallback={
              <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                <Loader2 size={18} className="animate-spin" />Carregando histórico…
              </div>
            }>
              <CashHistoryPanel tenant={tenant} />
            </Suspense>
          )}
        </Tabs>
      </div>

      {/* ══ MODAL: Abrir Caixa ══ */}
      <Modal isOpen={showOpenModal} onClose={() => setShowOpenModal(false)} title="Abrir Caixa" size="sm"
        footer={<ModalFooter><Button variant="ghost" onClick={() => setShowOpenModal(false)}>Cancelar</Button><Button variant="primary" loading={openLoading} onClick={handleOpenCash} iconLeft={<Unlock className="w-4 h-4" />}>Abrir Caixa</Button></ModalFooter>}
      >
        <div className="space-y-4 p-1">
          <Input label="Fundo de Caixa (R$)" type="number" placeholder="0,00" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} hint="Valor em dinheiro presente no caixa ao abrir." />
          <p className="text-[11px] text-slate-400">A abertura fica registrada automaticamente com o nome e e-mail da sua conta.</p>
        </div>
      </Modal>

      {/* ══ MODAL: Fechar Caixa ══ */}
      <Modal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} title="Fechar Caixa" size="sm"
        footer={<ModalFooter><Button variant="ghost" onClick={() => setShowCloseModal(false)}>Cancelar</Button><Button variant="danger" loading={closeLoading} disabled={closingBalance.trim() === ""} onClick={handleCloseCash} iconLeft={<Lock className="w-4 h-4" />}>Confirmar Fechamento</Button></ModalFooter>}
      >
        <div className="space-y-4 p-1">
          <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-xs">
            {[
              { label: "Fundo de caixa",     value: fmt(currentCash?.openingBalance ?? 0),                color: "text-slate-700" },
              { label: "Vendas em dinheiro", value: `+${fmt(paymentTotals["PAYMENT_CASH"] ?? 0)}`,        color: "text-green-600" },
              { label: "Suprimentos",        value: `+${fmt(totalSuprimentos)}`,                          color: "text-green-600" },
              { label: "Sangrias",           value: `−${fmt(totalSangrias)}`,                             color: "text-red-500" },
            ].map(row => (
              <div key={row.label} className="flex justify-between">
                <span className="text-slate-500">{row.label}</span>
                <span className={`font-semibold ${row.color}`}>{row.value}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold border-t border-slate-200 pt-2.5">
              <span className="text-slate-700">Saldo Esperado</span>
              <span className="text-blue-700">{fmt(expectedBalance)}</span>
            </div>
          </div>
          <Input label="Saldo Contado (R$)" type="number" placeholder="0,00" value={closingBalance} onChange={e => setClosingBalance(e.target.value)} />
          {closingBalance && (
            <div className={`rounded-lg px-4 py-3 text-sm font-semibold flex items-center gap-2 ${Math.abs(diffBalance) < 0.01 ? "bg-green-50 text-green-700" : diffBalance < 0 ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}`}>
              {Math.abs(diffBalance) < 0.01
                ? <><CheckCircle2 className="w-4 h-4" /> Caixa confere</>
                : diffBalance < 0
                ? <><AlertCircle className="w-4 h-4" /> Falta {fmt(Math.abs(diffBalance))}</>
                : <><AlertCircle className="w-4 h-4" /> Sobra {fmt(diffBalance)}</>}
            </div>
          )}
          <div className="rounded-lg border border-slate-100 p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-700">Conferir outros pagamentos</p>
              <p className="text-[11px] text-slate-400">Opcional: informe o total do comprovante Pix ou da maquininha para registrar qualquer diferença.</p>
            </div>
            {Object.entries(paymentTotals).filter(([type]) => type !== "PAYMENT_CASH").map(([type, expected]) => {
              const method = type.replace("PAYMENT_", "");
              const counted = countedByMethod[method];
              const difference = counted?.trim() ? parseFloat(counted) - expected : null;
              return <div key={type} className="grid grid-cols-[1fr_105px] gap-3 items-end">
                <div><p className="text-xs font-semibold text-slate-600">{MOVEMENT_META[type]?.label || method}</p><p className="text-[11px] text-slate-400">Esperado: {fmt(expected)}</p></div>
                <Input label="Conferido (R$)" type="number" placeholder="Opcional" value={counted ?? ""} onChange={e => setCountedByMethod(values => ({ ...values, [method]: e.target.value }))} />
                {difference != null && Number.isFinite(difference) && <p className={`col-span-2 -mt-2 text-right text-[11px] font-semibold ${Math.abs(difference) < 0.01 ? "text-green-600" : "text-red-600"}`}>{Math.abs(difference) < 0.01 ? "Confere" : `${difference < 0 ? "Falta" : "Sobra"} ${fmt(Math.abs(difference))}`}</p>}
              </div>;
            })}
          </div>
          <Input label="Observações (opcional)" placeholder="Ex: motivo de diferença..." value={closeNotes} onChange={e => setCloseNotes(e.target.value)} />
        </div>
      </Modal>

      {/* ══ MODAL: Sangria / Suprimento ══ */}
      <Modal isOpen={showMovementModal} onClose={() => setShowMovementModal(false)}
        title={movementType === "SANGRIA" ? "Registrar Sangria" : "Registrar Suprimento"} size="sm"
        footer={<ModalFooter><Button variant="ghost" onClick={() => setShowMovementModal(false)}>Cancelar</Button><Button variant={movementType === "SANGRIA" ? "danger" : "primary"} loading={movementLoading} onClick={handleMovement}>Confirmar</Button></ModalFooter>}
      >
        <div className="space-y-4 p-1">
          <FilterLineSegmented
            value={movementType}
            onChange={(v) => setMovementType(v as "SANGRIA" | "SUPRIMENTO")}
            options={[
              { value: "SANGRIA", label: "Sangria (Saída)" },
              { value: "SUPRIMENTO", label: "Suprimento (Entrada)" },
            ]}
          />
          <Alert variant={movementType === "SANGRIA" ? "error" : "success"}>
            {movementType === "SANGRIA" ? "Retirada de dinheiro do caixa (depósito, segurança)." : "Adição de troco ou fundo extra ao caixa."}
          </Alert>
          <Input label="Valor (R$)" type="number" placeholder="0,00" value={movementAmount} onChange={e => setMovementAmount(e.target.value)} />
          <Input label="Descrição (opcional)" placeholder="Ex: Depósito banco..." value={movementDesc} onChange={e => setMovementDesc(e.target.value)} />
        </div>
      </Modal>

      <Modal isOpen={!!cancelOrder} onClose={() => setCancelOrder(null)} title="Cancelar pedido pago" size="sm"
        footer={<ModalFooter><Button variant="ghost" onClick={() => setCancelOrder(null)}>Voltar</Button><Button variant="danger" loading={cancelling} disabled={!cancelPassword} onClick={handleCancelOrder}>Confirmar cancelamento</Button></ModalFooter>}
      >
        <div className="space-y-4 p-1">
          <p className="text-[13px] text-slate-600">O estorno será registrado no caixa aberto atual. A venda original continuará no histórico para auditoria.</p>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer"><input type="checkbox" checked={restockInventory} onChange={(e) => setRestockInventory(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-600" /><span className="text-xs text-slate-600"><strong className="block text-slate-800">Devolver produtos ao estoque</strong>Desmarque se os itens foram consumidos, preparados ou perdidos.</span></label>
          <Input label="Senha da sua conta (Admin ou Proprietário)" type="password" value={cancelPassword} onChange={(e) => setCancelPassword(e.target.value)} />
        </div>
      </Modal>
    </PageWrapper>
  );
}
