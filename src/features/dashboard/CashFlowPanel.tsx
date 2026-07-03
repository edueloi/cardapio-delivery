import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, Lock, Unlock,
  TrendingUp, Banknote, CreditCard, QrCode, Receipt, History,
  CheckCircle2, CalendarDays, Filter, AlertCircle, RefreshCw,
  ArrowLeftRight, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  PageWrapper, SectionTitle, ContentCard,
  Modal, ModalFooter, Button, Input, EmptyState, Switch,
  useToast,
} from "../../components";
import { DatePicker } from "../../components/DatePicker";
import { apiJson } from "../../lib/api";
import type { Tenant, CashRegister, CashMovement } from "../../types";

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

const PAYMENT_METHODS = ["PAYMENT_CASH", "PAYMENT_PIX", "PAYMENT_CREDIT", "PAYMENT_DEBIT", "PAYMENT_VR"] as const;

function todayISO() { return new Date().toISOString().split("T")[0]; }
function firstOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

interface Summary {
  totalRevenue: number; orderCount: number; totalSangrias: number;
  totalSuprimentos: number; netBalance: number;
  byMethod: Record<string, number>; byDay: Record<string, number>;
  movements: Array<{ type: string; amount: number; description?: string; createdAt: string }>;
}

interface CashFlowPanelProps { slug: string; tenant: Tenant; }

// ─── Sparkline de barras ────────────────────────────────────────────────────
function SparkBar({ byDay }: { byDay: Record<string, number> }) {
  const entries = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  if (entries.length === 0) return null;
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="flex items-end gap-1 h-16 w-full">
      {entries.map(([day, val]) => {
        const isToday = day === todayISO();
        const pct = Math.max((val / max) * 100, 4);
        return (
          <div key={day} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
              {fmtDate(day)}<br />{fmt(val)}
            </div>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${pct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={`w-full rounded-t-lg ${isToday ? "bg-[#C9A227]" : "bg-slate-200 group-hover:bg-[#C9A227]/50 transition-colors"}`}
            />
            {isToday && <span className="text-[8px] font-bold text-[#C9A227] mt-0.5">hoje</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Chip de método ─────────────────────────────────────────────────────────
function MethodChip({ type, value, total }: { type: string; value: number; total: number }) {
  const meta = MOVEMENT_META[type] || MOVEMENT_META.PAYMENT_CASH;
  const Icon = meta.icon;
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`flex flex-col gap-2 rounded-2xl p-4 ${meta.textBg} border border-white`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg ${meta.bg} flex items-center justify-center`}>
            <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
          </div>
          <span className={`text-[11px] font-bold ${meta.color}`}>{meta.label}</span>
        </div>
        <span className="text-[10px] font-bold text-slate-400">{pct}%</span>
      </div>
      <p className={`text-lg font-black ${meta.color}`}>{fmt(value)}</p>
      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }}
          className={`h-full rounded-full ${meta.bg}`}
        />
      </div>
    </div>
  );
}

// ─── Linha de movimento ──────────────────────────────────────────────────────
function MovementRow({ m }: { m: CashMovement }) {
  const meta = MOVEMENT_META[m.type] || MOVEMENT_META.PAYMENT_CASH;
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/70 rounded-xl transition-colors">
      <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{m.description || meta.label}</p>
        <p className="text-[10px] text-slate-400">{fmtDateTime(m.createdAt)}{m.operatorName ? ` · ${m.operatorName}` : ""}</p>
      </div>
      <span className={`text-sm font-black shrink-0 tabular-nums ${meta.isOut ? "text-red-500" : "text-green-600"}`}>
        {meta.isOut ? "−" : "+"}{fmt(m.amount)}
      </span>
    </div>
  );
}

// ─── Card de histórico ───────────────────────────────────────────────────────
function HistoryCard({ h }: { h: CashRegister & { movements?: CashMovement[] } }) {
  const diff = h.closingBalance != null && h.expectedBalance != null ? h.closingBalance - h.expectedBalance : null;
  const vendas = h.movements?.filter(m => m.type.startsWith("PAYMENT_")).reduce((s, m) => s + m.amount, 0) ?? 0;
  const sangrias = h.movements?.filter(m => m.type === "SANGRIA").reduce((s, m) => s + m.amount, 0) ?? 0;
  const isOk = diff == null || Math.abs(diff) < 0.01;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-50">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isOk ? "bg-green-100" : "bg-red-50"}`}>
          <History className={`w-4 h-4 ${isOk ? "text-green-600" : "text-red-500"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">
            {new Date(h.openedAt).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
          <p className="text-[11px] text-slate-400">
            {fmtTime(h.openedAt)} → {h.closedAt ? fmtTime(h.closedAt) : "Aberto"}
            {h.operatorName ? ` · ${h.operatorName}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-black text-slate-800">{fmt(vendas)}</p>
          {diff !== null && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${isOk ? "bg-green-50 text-green-600" : diff < 0 ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"}`}>
              {diff > 0 ? "+" : ""}{fmt(diff)}
            </span>
          )}
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-4 divide-x divide-slate-50">
        {[
          { label: "Fundo", value: fmt(h.openingBalance), color: "text-slate-700" },
          { label: "Vendas", value: fmt(vendas), color: "text-green-700" },
          { label: "Sangrias", value: fmt(sangrias), color: "text-red-600" },
          { label: "Contado", value: fmt(h.closingBalance ?? 0), color: isOk ? "text-green-700" : "text-red-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="px-4 py-3 text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
            <p className={`text-sm font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>
      {/* Movimentos */}
      {h.movements && h.movements.length > 0 && (
        <div className="border-t border-slate-50 py-1">
          {h.movements.map(m => <MovementRow key={m.id} m={m} />)}
        </div>
      )}
      {h.notes && (
        <p className="px-5 pb-3 text-xs text-slate-400 italic">{h.notes}</p>
      )}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function CashFlowPanel({ slug }: CashFlowPanelProps) {
  const toast = useToast();
  const [currentCash, setCurrentCash] = useState<CashRegister | null>(null);
  const [movements,   setMovements]   = useState<CashMovement[]>([]);
  const [history,     setHistory]     = useState<(CashRegister & { movements?: CashMovement[] })[]>([]);
  const [summary,     setSummary]     = useState<Summary | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<"caixa" | "historico">("caixa");

  const [dateFrom, setDateFrom] = useState<string | null>(firstOfMonthISO());
  const [dateTo,   setDateTo]   = useState<string | null>(todayISO());
  const [autoRegister, setAutoRegister] = useState(true);

  const [showOpenModal,     setShowOpenModal]     = useState(false);
  const [showCloseModal,    setShowCloseModal]    = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [openingBalance,    setOpeningBalance]    = useState("0");
  const [operatorName,      setOperatorName]      = useState("");
  const [openLoading,       setOpenLoading]       = useState(false);
  const [closingBalance,    setClosingBalance]    = useState("");
  const [closeNotes,        setCloseNotes]        = useState("");
  const [closeLoading,      setCloseLoading]      = useState(false);
  const [movementType,      setMovementType]      = useState<"SANGRIA" | "SUPRIMENTO">("SANGRIA");
  const [movementAmount,    setMovementAmount]    = useState("");
  const [movementDesc,      setMovementDesc]      = useState("");
  const [movementLoading,   setMovementLoading]   = useState(false);

  const authHeader = { Authorization: `Bearer ${localStorage.getItem("auth_token")}` };

  const fetchCaixa = useCallback(async () => {
    const [cashRes, movRes] = await Promise.all([
      fetch(`/api/tenants/${slug}/cash/current`,   { headers: authHeader }),
      fetch(`/api/tenants/${slug}/cash/movements`, { headers: authHeader }),
    ]);
    setCurrentCash(cashRes.ok ? await cashRes.json() : null);
    setMovements(movRes.ok ? await movRes.json() : []);
  }, [slug]);

  const fetchResumo = useCallback(async () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo)   params.set("to",   dateTo);
    const res = await fetch(`/api/tenants/${slug}/cash/summary?${params}`, { headers: authHeader });
    setSummary(res.ok ? await res.json() : null);
  }, [slug, dateFrom, dateTo]);

  const fetchHistorico = useCallback(async () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo)   params.set("to",   dateTo);
    const res = await fetch(`/api/tenants/${slug}/cash/history?${params}`, { headers: authHeader });
    setHistory(res.ok ? await res.json() : []);
  }, [slug, dateFrom, dateTo]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try { await Promise.all([fetchCaixa(), fetchResumo(), fetchHistorico()]); }
    finally { setLoading(false); }
  }, [fetchCaixa, fetchResumo, fetchHistorico]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { if (!loading) { fetchResumo(); fetchHistorico(); } }, [dateFrom, dateTo]);

  const paymentTotals = useMemo(() =>
    movements.reduce<Record<string, number>>((acc, m) => {
      if (m.type.startsWith("PAYMENT_")) acc[m.type] = (acc[m.type] || 0) + m.amount;
      return acc;
    }, {}), [movements]);

  const totalSangrias    = useMemo(() => movements.filter(m => m.type === "SANGRIA").reduce((s, m) => s + m.amount, 0), [movements]);
  const totalSuprimentos = useMemo(() => movements.filter(m => m.type === "SUPRIMENTO").reduce((s, m) => s + m.amount, 0), [movements]);
  const totalVendas      = useMemo(() => movements.filter(m => m.type.startsWith("PAYMENT_")).reduce((s, m) => s + m.amount, 0), [movements]);
  const expectedBalance  = (currentCash?.openingBalance ?? 0) + (paymentTotals["PAYMENT_CASH"] ?? 0) + totalSuprimentos - totalSangrias;
  const diffBalance      = closingBalance ? parseFloat(closingBalance) - expectedBalance : 0;
  const isOpen           = currentCash?.status === "OPEN";

  const handleOpenCash = async () => {
    setOpenLoading(true);
    try {
      await apiJson(`/api/tenants/${slug}/cash/open`, { method: "POST", body: JSON.stringify({ openingBalance: parseFloat(openingBalance || "0"), operatorName }) });
      setShowOpenModal(false); setOpeningBalance("0"); setOperatorName("");
      fetchCaixa();
    } catch { toast.error("Erro ao abrir caixa."); }
    finally { setOpenLoading(false); }
  };

  const handleCloseCash = async () => {
    setCloseLoading(true);
    try {
      await apiJson(`/api/tenants/${slug}/cash/close`, { method: "POST", body: JSON.stringify({ closingBalance: parseFloat(closingBalance || "0"), notes: closeNotes }) });
      setShowCloseModal(false); setClosingBalance(""); setCloseNotes("");
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

  const setPreset = (preset: "today" | "week" | "month" | "last-month") => {
    const now = new Date();
    if (preset === "today") {
      setDateFrom(todayISO()); setDateTo(todayISO());
    } else if (preset === "week") {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay());
      setDateFrom(start.toISOString().split("T")[0]); setDateTo(todayISO());
    } else if (preset === "month") {
      setDateFrom(firstOfMonthISO()); setDateTo(todayISO());
    } else {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last  = new Date(now.getFullYear(), now.getMonth(), 0);
      setDateFrom(first.toISOString().split("T")[0]);
      setDateTo(last.toISOString().split("T")[0]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PageWrapper>
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-black text-slate-800">Fluxo de Caixa</h2>
          <p className="text-xs text-slate-400 mt-0.5">Entradas, saídas e resumo financeiro do dia</p>
        </div>
        <button onClick={fetchAll} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        {([
          { id: "caixa",     label: "Caixa do Dia",  icon: Wallet },
          { id: "historico", label: "Histórico",     icon: History },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 py-2 px-5 rounded-lg text-[11px] font-bold transition-all ${activeTab === tab.id ? "bg-white shadow-sm text-[#C9A227]" : "text-slate-400 hover:text-slate-600"}`}
          >
            <tab.icon className="w-3.5 h-3.5 shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════ TAB: CAIXA DO DIA ══════ */}
      {activeTab === "caixa" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

          {/* ── Banner de status do caixa ── */}
          {isOpen ? (
            <div className="rounded-2xl bg-[#0D1B3E] text-white p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <p className="font-black text-sm text-green-400">Caixa Aberto</p>
                </div>
                <p className="text-xs text-white/60">
                  Desde {fmtDateTime(currentCash!.openedAt)}
                  {currentCash!.operatorName ? ` · Operador: ${currentCash!.operatorName}` : ""}
                  {" · "} Fundo: {fmt(currentCash!.openingBalance)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                <button onClick={() => { setMovementType("SUPRIMENTO"); setShowMovementModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors">
                  <ArrowDownCircle className="w-3.5 h-3.5 text-green-400" /> Suprimento
                </button>
                <button onClick={() => { setMovementType("SANGRIA"); setShowMovementModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors">
                  <ArrowUpCircle className="w-3.5 h-3.5 text-red-400" /> Sangria
                </button>
                <button onClick={() => { setClosingBalance(""); setCloseNotes(""); setShowCloseModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-500/80 hover:bg-red-500 rounded-xl text-xs font-black text-white transition-colors">
                  <Lock className="w-3.5 h-3.5" /> Fechar Caixa
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                <Lock className="w-7 h-7 text-slate-400" />
              </div>
              <div className="flex-1">
                <p className="font-black text-slate-700 mb-1">Caixa Fechado</p>
                <p className="text-xs text-slate-400">Abra o caixa para registrar vendas e movimentos do dia.</p>
              </div>
              <Button onClick={() => setShowOpenModal(true)} iconLeft={<Unlock className="w-4 h-4" />} className="shrink-0">
                Abrir Caixa
              </Button>
            </div>
          )}

          {/* ── KPIs do caixa atual ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Fundo de Caixa", value: fmt(currentCash?.openingBalance ?? 0), icon: Banknote, color: "text-slate-700", bg: "bg-slate-50 border-slate-100" },
              { label: "Total em Vendas", value: fmt(totalVendas), icon: TrendingUp, color: "text-green-700", bg: "bg-green-50 border-green-100" },
              { label: "Sangrias", value: fmt(totalSangrias), icon: ArrowUpCircle, color: "text-red-600", bg: "bg-red-50 border-red-100" },
              { label: "Saldo Esperado", value: fmt(expectedBalance), icon: Wallet, color: "text-[#C9A227]", bg: "bg-amber-50 border-amber-100" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
                <Icon className={`w-5 h-5 mb-2 ${color}`} />
                <p className={`text-xl font-black ${color}`}>{value}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Receita por método ── */}
          {totalVendas > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Receita por método de pagamento</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {PAYMENT_METHODS.map(type => (
                  <MethodChip key={type} type={type} value={paymentTotals[type] || 0} total={totalVendas} />
                ))}
              </div>
            </div>
          )}

          {/* ── Gráfico diário (mês atual) ── */}
          {summary && Object.keys(summary.byDay).length > 1 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-black text-slate-800">Receita — Mês atual</p>
                <span className="text-xs font-bold text-[#C9A227]">{fmt(summary.totalRevenue)}</span>
              </div>
              <SparkBar byDay={summary.byDay} />
            </div>
          )}

          {/* ── Toggle registro automático ── */}
          <div className="bg-white rounded-2xl border border-slate-100 px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-800">Registro Automático de Pagamentos</p>
              <p className="text-xs text-slate-400 mt-0.5">Pagamentos dos pedidos entram como movimentos automaticamente.</p>
            </div>
            <Switch checked={autoRegister} onCheckedChange={setAutoRegister} />
          </div>

          {/* ── Lista de movimentos ── */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <p className="text-sm font-black text-slate-800">Movimentos do Caixa Atual</p>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{movements.length}</span>
            </div>
            {movements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                <ArrowLeftRight className="w-8 h-8 mb-2" />
                <p className="text-xs font-medium">Nenhum movimento registrado</p>
              </div>
            ) : (
              <div className="py-1 max-h-[400px] overflow-y-auto">
                <AnimatePresence>
                  {movements.map(m => <MovementRow key={m.id} m={m} />)}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ══════ TAB: HISTÓRICO ══════ */}
      {activeTab === "historico" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

          {/* Filtros */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-slate-400" />
              <p className="text-sm font-bold text-slate-700">Filtrar período</p>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { id: "today", label: "Hoje" },
                { id: "week",  label: "Esta semana" },
                { id: "month", label: "Este mês" },
                { id: "last-month", label: "Mês anterior" },
              ].map(p => (
                <button key={p.id} onClick={() => setPreset(p.id as any)}
                  className="px-3 py-1.5 rounded-full border border-slate-200 text-[11px] font-semibold text-slate-500 hover:border-[#C9A227] hover:text-[#C9A227] transition-all"
                >{p.label}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DatePicker label="De" value={dateFrom} onChange={setDateFrom} max={dateTo ?? undefined} />
              <DatePicker label="Até" value={dateTo} onChange={setDateTo} min={dateFrom ?? undefined} />
            </div>
          </div>

          {/* KPIs do período */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Receita Total",    value: fmt(summary.totalRevenue),    color: "text-green-700",   bg: "bg-green-50 border-green-100",  icon: TrendingUp },
                { label: "Pedidos",          value: summary.orderCount.toString(),color: "text-blue-700",    bg: "bg-blue-50 border-blue-100",    icon: Receipt },
                { label: "Sangrias",         value: fmt(summary.totalSangrias),   color: "text-red-600",     bg: "bg-red-50 border-red-100",      icon: ArrowUpCircle },
                { label: "Saldo Líquido",    value: fmt(summary.netBalance),      color: "text-[#C9A227]",   bg: "bg-amber-50 border-amber-100",  icon: Wallet },
              ].map(({ label, value, color, bg, icon: Icon }) => (
                <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
                  <Icon className={`w-5 h-5 mb-2 ${color}`} />
                  <p className={`text-xl font-black ${color}`}>{value}</p>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-1">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Lista de fechamentos */}
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300">
              <History className="w-10 h-10 mb-3" />
              <p className="text-sm font-medium">Nenhum fechamento no período</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(h => <HistoryCard key={h.id} h={h} />)}
            </div>
          )}
        </motion.div>
      )}

      {/* ══ MODAL: Abrir Caixa ══ */}
      <Modal isOpen={showOpenModal} onClose={() => setShowOpenModal(false)} title="Abrir Caixa" size="sm"
        footer={<ModalFooter><Button variant="ghost" onClick={() => setShowOpenModal(false)}>Cancelar</Button><Button variant="primary" loading={openLoading} onClick={handleOpenCash} iconLeft={<Unlock className="w-4 h-4" />}>Abrir Caixa</Button></ModalFooter>}
      >
        <div className="space-y-4 p-1">
          <Input label="Operador / Responsável" placeholder="Nome do operador" value={operatorName} onChange={e => setOperatorName(e.target.value)} />
          <Input label="Fundo de Caixa (R$)" type="number" placeholder="0,00" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} hint="Valor em dinheiro presente no caixa ao abrir." />
        </div>
      </Modal>

      {/* ══ MODAL: Fechar Caixa ══ */}
      <Modal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} title="Fechar Caixa" size="sm"
        footer={<ModalFooter><Button variant="ghost" onClick={() => setShowCloseModal(false)}>Cancelar</Button><Button variant="danger" loading={closeLoading} onClick={handleCloseCash} iconLeft={<Lock className="w-4 h-4" />}>Confirmar Fechamento</Button></ModalFooter>}
      >
        <div className="space-y-4 p-1">
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5 text-sm">
            {[
              { label: "Fundo de caixa",     value: fmt(currentCash?.openingBalance ?? 0),                color: "text-slate-700" },
              { label: "Vendas em dinheiro", value: `+${fmt(paymentTotals["PAYMENT_CASH"] ?? 0)}`,        color: "text-green-600" },
              { label: "Suprimentos",        value: `+${fmt(totalSuprimentos)}`,                          color: "text-green-600" },
              { label: "Sangrias",           value: `−${fmt(totalSangrias)}`,                             color: "text-red-500" },
            ].map(row => (
              <div key={row.label} className="flex justify-between">
                <span className="text-slate-500">{row.label}</span>
                <span className={`font-bold ${row.color}`}>{row.value}</span>
              </div>
            ))}
            <div className="flex justify-between font-black border-t border-slate-200 pt-2.5">
              <span className="text-slate-700">Saldo Esperado</span>
              <span className="text-[#C9A227]">{fmt(expectedBalance)}</span>
            </div>
          </div>
          <Input label="Saldo Contado (R$)" type="number" placeholder="0,00" value={closingBalance} onChange={e => setClosingBalance(e.target.value)} />
          {closingBalance && (
            <div className={`rounded-xl px-4 py-3 text-sm font-bold flex items-center gap-2 ${Math.abs(diffBalance) < 0.01 ? "bg-green-50 text-green-700" : diffBalance < 0 ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}`}>
              {Math.abs(diffBalance) < 0.01
                ? <><CheckCircle2 className="w-4 h-4" /> Caixa confere</>
                : diffBalance < 0
                ? <><AlertCircle className="w-4 h-4" /> Falta {fmt(Math.abs(diffBalance))}</>
                : <><AlertCircle className="w-4 h-4" /> Sobra {fmt(diffBalance)}</>}
            </div>
          )}
          <Input label="Observações (opcional)" placeholder="Ex: motivo de diferença..." value={closeNotes} onChange={e => setCloseNotes(e.target.value)} />
        </div>
      </Modal>

      {/* ══ MODAL: Sangria / Suprimento ══ */}
      <Modal isOpen={showMovementModal} onClose={() => setShowMovementModal(false)}
        title={movementType === "SANGRIA" ? "Registrar Sangria" : "Registrar Suprimento"} size="sm"
        footer={<ModalFooter><Button variant="ghost" onClick={() => setShowMovementModal(false)}>Cancelar</Button><Button variant={movementType === "SANGRIA" ? "danger" : "primary"} loading={movementLoading} onClick={handleMovement}>Confirmar</Button></ModalFooter>}
      >
        <div className="space-y-4 p-1">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(["SANGRIA", "SUPRIMENTO"] as const).map(t => (
              <button key={t} onClick={() => setMovementType(t)}
                className={`flex-1 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${movementType === t ? (t === "SANGRIA" ? "bg-red-500 text-white shadow-sm" : "bg-green-500 text-white shadow-sm") : "text-slate-400 hover:text-slate-600"}`}
              >{t === "SANGRIA" ? "Sangria (Saída)" : "Suprimento (Entrada)"}</button>
            ))}
          </div>
          <div className={`rounded-xl px-4 py-3 text-xs font-medium ${movementType === "SANGRIA" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {movementType === "SANGRIA" ? "Retirada de dinheiro do caixa (depósito, segurança)." : "Adição de troco ou fundo extra ao caixa."}
          </div>
          <Input label="Valor (R$)" type="number" placeholder="0,00" value={movementAmount} onChange={e => setMovementAmount(e.target.value)} />
          <Input label="Descrição (opcional)" placeholder="Ex: Depósito banco..." value={movementDesc} onChange={e => setMovementDesc(e.target.value)} />
        </div>
      </Modal>
    </PageWrapper>
  );
}
