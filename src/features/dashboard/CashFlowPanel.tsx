import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, Lock, Unlock,
  TrendingUp, Banknote, CreditCard, QrCode, Receipt, History,
  CheckCircle2, ChevronDown, ChevronUp, CalendarDays, Filter,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard,
  Modal, ModalFooter, Button, Input, EmptyState, Switch,
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

// ─── Configuração de tipos de movimento ──────────────────────────────────────
const MOVEMENT_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType; isOut: boolean }> = {
  SANGRIA:        { label: "Sangria",    color: "text-red-600",     bg: "bg-red-50",     icon: ArrowUpCircle,   isOut: true  },
  SUPRIMENTO:     { label: "Suprimento", color: "text-green-600",   bg: "bg-green-50",   icon: ArrowDownCircle, isOut: false },
  PAYMENT_CASH:   { label: "Dinheiro",   color: "text-slate-700",   bg: "bg-slate-100",  icon: Banknote,        isOut: false },
  PAYMENT_PIX:    { label: "PIX",        color: "text-violet-600",  bg: "bg-violet-50",  icon: QrCode,          isOut: false },
  PAYMENT_CREDIT: { label: "Crédito",    color: "text-orange-600",  bg: "bg-orange-50",  icon: CreditCard,      isOut: false },
  PAYMENT_DEBIT:  { label: "Débito",     color: "text-cyan-600",    bg: "bg-cyan-50",    icon: CreditCard,      isOut: false },
  PAYMENT_VR:     { label: "VR/Ticket",  color: "text-emerald-600", bg: "bg-emerald-50", icon: Receipt,         isOut: false },
};

const PAYMENT_METHODS = ["PAYMENT_CASH", "PAYMENT_PIX", "PAYMENT_CREDIT", "PAYMENT_DEBIT", "PAYMENT_VR"] as const;

// ─── Helpers de data ──────────────────────────────────────────────────────────
function todayISO() { return new Date().toISOString().split("T")[0]; }
function firstOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Summary {
  totalRevenue: number;
  orderCount: number;
  totalSangrias: number;
  totalSuprimentos: number;
  netBalance: number;
  byMethod: Record<string, number>;
  byDay: Record<string, number>;
  movements: Array<{ type: string; amount: number; description?: string; createdAt: string }>;
}

interface CashFlowPanelProps { slug: string; tenant: Tenant; }

// ─── Mini bar chart inline ────────────────────────────────────────────────────
function SparkBar({ byDay }: { byDay: Record<string, number> }) {
  const entries = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  if (entries.length === 0) return null;
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="flex items-end gap-0.5 h-10 w-full">
      {entries.map(([day, val]) => {
        const isToday = day === todayISO();
        const pct = Math.max((val / max) * 100, 4);
        return (
          <div key={day} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div
              className={`w-full rounded-t transition-all ${isToday ? "bg-amber-400" : "bg-slate-200 group-hover:bg-amber-300"}`}
              style={{ height: `${pct}%` }}
            />
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
              {fmtDate(day)}: {fmt(val)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Card de método de pagamento ──────────────────────────────────────────────
function PayMethodCard({ type, value, total }: { type: string; value: number; total: number }) {
  const meta = MOVEMENT_META[type] || { label: type, color: "text-slate-600", bg: "bg-slate-100", icon: Wallet, isOut: false };
  const Icon = meta.icon;
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className={`rounded-2xl p-4 ${meta.bg} flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${meta.color}`} />
          <span className={`text-[10px] font-black uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
        </div>
        <span className="text-[10px] font-bold text-slate-400">{pct.toFixed(0)}%</span>
      </div>
      <p className={`text-xl font-black ${meta.color}`}>{fmt(value)}</p>
      <div className="w-full h-1 bg-white/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${meta.color.replace("text-", "bg-")}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Linha de movimento ───────────────────────────────────────────────────────
function MovementRow({ m }: { m: CashMovement }) {
  const meta = MOVEMENT_META[m.type] || { label: m.type, color: "text-slate-600", bg: "bg-slate-100", icon: Wallet, isOut: false };
  const Icon = meta.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 py-3 px-4 hover:bg-slate-50 rounded-xl transition-colors"
    >
      <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 truncate">{m.description || meta.label}</p>
        <p className="text-[10px] text-slate-400">{fmtDateTime(m.createdAt)}{m.operatorName ? ` · ${m.operatorName}` : ""}</p>
      </div>
      <span className={`text-sm font-black shrink-0 ${meta.isOut ? "text-red-500" : "text-green-600"}`}>
        {meta.isOut ? "−" : "+"}{fmt(m.amount)}
      </span>
    </motion.div>
  );
}

// ─── Row do histórico de caixa ────────────────────────────────────────────────
function CashHistoryRow({ h }: { h: CashRegister & { movements?: CashMovement[] } }) {
  const [open, setOpen] = useState(false);
  const diff = h.closingBalance != null && h.expectedBalance != null ? h.closingBalance - h.expectedBalance : null;
  const vendas = h.movements?.filter(m => m.type.startsWith("PAYMENT_")).reduce((s, m) => s + m.amount, 0) ?? 0;
  return (
    <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
          <History className="w-4 h-4 text-slate-500" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-black text-slate-800">
            {new Date(h.openedAt).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
          </p>
          <p className="text-[10px] text-slate-400">
            {fmtTime(h.openedAt)} → {h.closedAt ? fmtTime(h.closedAt) : "—"}
            {h.operatorName ? ` · ${h.operatorName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-black text-slate-800">{fmt(vendas)}</span>
          {diff !== null && (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${Math.abs(diff) < 0.01 ? "bg-green-50 text-green-600" : diff < 0 ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"}`}>
              {diff >= 0 ? "+" : ""}{fmt(diff)}
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-100"
          >
            <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Fundo</p>
                <p className="text-sm font-black text-slate-700">{fmt(h.openingBalance)}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-green-500 mb-1">Vendas</p>
                <p className="text-sm font-black text-green-700">{fmt(vendas)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Esperado</p>
                <p className="text-sm font-black text-slate-700">{fmt(h.expectedBalance ?? 0)}</p>
              </div>
              <div className={`rounded-xl p-3 ${Math.abs(diff ?? 0) < 0.01 ? "bg-green-50" : (diff ?? 0) < 0 ? "bg-red-50" : "bg-orange-50"}`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Contado</p>
                <p className={`text-sm font-black ${Math.abs(diff ?? 0) < 0.01 ? "text-green-700" : (diff ?? 0) < 0 ? "text-red-700" : "text-orange-700"}`}>{fmt(h.closingBalance ?? 0)}</p>
              </div>
            </div>
            {h.movements && h.movements.length > 0 && (
              <div className="px-4 pb-3 space-y-1">
                {h.movements.map(m => <MovementRow key={m.id} m={m} />)}
              </div>
            )}
            {h.notes && (
              <p className="px-4 pb-3 text-xs text-slate-500 italic">{h.notes}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CashFlowPanel({ slug }: CashFlowPanelProps) {
  const [currentCash, setCurrentCash] = useState<CashRegister | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [history, setHistory] = useState<(CashRegister & { movements?: CashMovement[] })[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"caixa" | "resumo" | "historico">("caixa");

  // Filtros de data
  const [dateFrom, setDateFrom] = useState<string | null>(firstOfMonthISO());
  const [dateTo,   setDateTo]   = useState<string | null>(todayISO());
  const [autoRegister, setAutoRegister] = useState(true);

  // Modais
  const [showOpenModal,     setShowOpenModal]     = useState(false);
  const [showCloseModal,    setShowCloseModal]     = useState(false);
  const [showMovementModal, setShowMovementModal]  = useState(false);
  const [openingBalance,    setOpeningBalance]     = useState("0");
  const [operatorName,      setOperatorName]       = useState("");
  const [openLoading,       setOpenLoading]        = useState(false);
  const [closingBalance,    setClosingBalance]     = useState("");
  const [closeNotes,        setCloseNotes]         = useState("");
  const [closeLoading,      setCloseLoading]       = useState(false);
  const [movementType,      setMovementType]       = useState<"SANGRIA" | "SUPRIMENTO">("SANGRIA");
  const [movementAmount,    setMovementAmount]     = useState("");
  const [movementDesc,      setMovementDesc]       = useState("");
  const [movementLoading,   setMovementLoading]    = useState(false);

  const authHeader = { Authorization: `Bearer ${localStorage.getItem("auth_token")}` };

  const fetchCaixa = useCallback(async () => {
    const [cashRes, movRes] = await Promise.all([
      fetch(`/api/tenants/${slug}/cash/current`, { headers: authHeader }),
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
    try {
      await Promise.all([fetchCaixa(), fetchResumo(), fetchHistorico()]);
    } finally {
      setLoading(false);
    }
  }, [fetchCaixa, fetchResumo, fetchHistorico]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Re-fetch resumo e histórico quando datas mudam
  useEffect(() => {
    if (!loading) {
      fetchResumo();
      fetchHistorico();
    }
  }, [dateFrom, dateTo]);

  // Computed do caixa atual
  const paymentTotals = useMemo(() => movements.reduce<Record<string, number>>((acc, m) => {
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
    } catch { alert("Erro ao abrir caixa."); }
    finally { setOpenLoading(false); }
  };

  const handleCloseCash = async () => {
    setCloseLoading(true);
    try {
      await apiJson(`/api/tenants/${slug}/cash/close`, { method: "POST", body: JSON.stringify({ closingBalance: parseFloat(closingBalance || "0"), notes: closeNotes }) });
      setShowCloseModal(false); setClosingBalance(""); setCloseNotes("");
      fetchAll();
    } catch { alert("Erro ao fechar caixa."); }
    finally { setCloseLoading(false); }
  };

  const handleMovement = async () => {
    setMovementLoading(true);
    try {
      await apiJson(`/api/tenants/${slug}/cash/movement`, { method: "POST", body: JSON.stringify({ type: movementType, amount: parseFloat(movementAmount || "0"), description: movementDesc }) });
      setShowMovementModal(false); setMovementAmount(""); setMovementDesc("");
      fetchCaixa();
    } catch { alert("Erro ao registrar movimento."); }
    finally { setMovementLoading(false); }
  };

  // ─── Atalhos de período ─────────────────────────────────────────────────────
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
      <PageWrapper>
        <div className="flex items-center justify-center h-48 opacity-30">
          <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      {/* ── Header ── */}
      <SectionTitle title="Fluxo de Caixa" description="Entradas, saídas e resumo financeiro" icon={Wallet} className="mb-4 sm:mb-6" />

      {/* ── Tabs ── */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-5 sm:mb-6">
        {([
          { id: "caixa",     label: "Caixa Atual", icon: Wallet },
          { id: "resumo",    label: "Resumo",       icon: TrendingUp },
          { id: "historico", label: "Histórico",    icon: History },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id ? "bg-white shadow-sm text-amber-500" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ══ TAB: CAIXA ATUAL ══ */}
      {activeTab === "caixa" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

          {/* Status card */}
          <div className={`rounded-2xl p-4 flex items-center gap-4 ${isOpen ? "bg-green-500" : "bg-slate-100"}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isOpen ? "bg-white/20" : "bg-white"}`}>
              {isOpen
                ? <CheckCircle2 className="w-6 h-6 text-white" />
                : <Lock className="w-6 h-6 text-slate-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-black text-sm ${isOpen ? "text-white" : "text-slate-600"}`}>
                {isOpen ? "Caixa Aberto" : "Caixa Fechado"}
              </p>
              <p className={`text-xs truncate ${isOpen ? "text-white/80" : "text-slate-400"}`}>
                {isOpen
                  ? `Desde ${fmtDateTime(currentCash!.openedAt)}${currentCash!.operatorName ? ` · ${currentCash!.operatorName}` : ""}`
                  : "Abra o caixa para registrar vendas e movimentos."}
              </p>
            </div>
            {/* Ações inline no status */}
            {isOpen ? (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => { setMovementType("SANGRIA"); setShowMovementModal(true); }}
                  className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  title="Sangria"
                >
                  <ArrowUpCircle className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={() => { setMovementType("SUPRIMENTO"); setShowMovementModal(true); }}
                  className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  title="Suprimento"
                >
                  <ArrowDownCircle className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={() => { setClosingBalance(""); setCloseNotes(""); setShowCloseModal(true); }}
                  className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  title="Fechar Caixa"
                >
                  <Lock className="w-5 h-5 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowOpenModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#0D1B3E] text-white rounded-xl text-xs font-black shrink-0 hover:bg-[#0D1B3E]/90 transition-colors"
              >
                <Unlock className="w-4 h-4" />
                <span className="hidden sm:inline">Abrir</span>
              </button>
            )}
          </div>

          {/* Registro automático toggle */}
          <ContentCard padding="lg">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-slate-900">Registro Automático</p>
                <p className="text-xs text-slate-500 mt-0.5">Pagamentos dos pedidos entram automaticamente como movimentos.</p>
              </div>
              <Switch checked={autoRegister} onCheckedChange={setAutoRegister} />
            </div>
          </ContentCard>

          {/* Stats do caixa */}
          <StatGrid cols={4}>
            <StatCard title="Fundo de Caixa" value={fmt(currentCash?.openingBalance ?? 0)} icon={Banknote} color="default" delay={0} />
            <StatCard title="Total Vendas"    value={fmt(totalVendas)}    icon={TrendingUp}    color="success" delay={0.05} />
            <StatCard title="Sangrias"        value={fmt(totalSangrias)}  icon={ArrowUpCircle} color="danger"  delay={0.1}  />
            <StatCard title="Saldo Esperado"  value={fmt(expectedBalance)} icon={Wallet}       color="info"    delay={0.15} />
          </StatGrid>

          {/* Breakdown por método */}
          {isOpen && totalVendas > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 px-1">Receita por Método</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {PAYMENT_METHODS.map(type => (
                  <PayMethodCard key={type} type={type} value={paymentTotals[type] || 0} total={totalVendas} />
                ))}
              </div>
            </div>
          )}

          {/* Movimentos */}
          <ContentCard padding="none">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Movimentos do Caixa</p>
            </div>
            {movements.length === 0 ? (
              <EmptyState title="Nenhum movimento" description="Os movimentos aparecerão conforme as vendas forem registradas." icon={History} />
            ) : (
              <div className="p-2 space-y-0.5">
                <AnimatePresence>
                  {movements.map(m => <MovementRow key={m.id} m={m} />)}
                </AnimatePresence>
              </div>
            )}
          </ContentCard>
        </motion.div>
      )}

      {/* ══ TAB: RESUMO ══ */}
      {activeTab === "resumo" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

          {/* Filtros */}
          <ContentCard padding="lg">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-slate-400" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Período</p>
            </div>
            {/* Presets */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { id: "today",      label: "Hoje" },
                { id: "week",       label: "Esta semana" },
                { id: "month",      label: "Este mês" },
                { id: "last-month", label: "Mês anterior" },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id as any)}
                  className="px-3 py-1.5 rounded-full border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-amber-300 hover:text-amber-600 transition-all"
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* De / Até com DatePicker */}
            <div className="grid grid-cols-2 gap-3">
              <DatePicker label="De" value={dateFrom} onChange={setDateFrom} max={dateTo ?? undefined} />
              <DatePicker label="Até" value={dateTo} onChange={setDateTo} min={dateFrom ?? undefined} />
            </div>
          </ContentCard>

          {summary ? (
            <>
              {/* KPIs do período */}
              <StatGrid cols={4}>
                <StatCard title="Receita Total"  value={fmt(summary.totalRevenue)}    icon={TrendingUp}    color="success" delay={0}    />
                <StatCard title="Pedidos"         value={summary.orderCount}           icon={Receipt}       color="info"    delay={0.05} />
                <StatCard title="Sangrias"        value={fmt(summary.totalSangrias)}   icon={ArrowUpCircle} color="danger"  delay={0.1}  />
                <StatCard title="Saldo Líquido"   value={fmt(summary.netBalance)}      icon={Wallet}        color="default" delay={0.15} />
              </StatGrid>

              {/* Gráfico sparkbar */}
              {Object.keys(summary.byDay).length > 1 && (
                <ContentCard padding="lg">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Receita por dia</p>
                  <SparkBar byDay={summary.byDay} />
                  <div className="flex justify-between mt-2">
                    <span className="text-[9px] text-slate-300">{Object.keys(summary.byDay).sort()[0]}</span>
                    <span className="text-[9px] text-slate-300">{Object.keys(summary.byDay).sort().at(-1)}</span>
                  </div>
                </ContentCard>
              )}

              {/* Por método de pagamento */}
              {Object.keys(summary.byMethod).length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 px-1">Receita por Método</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {Object.entries(summary.byMethod).map(([method, value]) => (
                      <PayMethodCard key={method} type={`PAYMENT_${method}`} value={value} total={summary.totalRevenue} />
                    ))}
                  </div>
                </div>
              )}

              {/* Movimentos manuais do período */}
              {summary.movements.length > 0 && (
                <ContentCard padding="none">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Movimentos Manuais do Período</p>
                  </div>
                  <div className="p-2 space-y-0.5">
                    {summary.movements.map((m, i) => (
                      <MovementRow key={i} m={{ ...m, id: String(i), cashRegisterId: "", tenantId: "", orderId: null, operatorName: null } as any} />
                    ))}
                  </div>
                </ContentCard>
              )}

              {summary.totalRevenue === 0 && summary.orderCount === 0 && (
                <EmptyState title="Sem dados no período" description="Nenhum pedido entregue neste período." icon={TrendingUp} />
              )}
            </>
          ) : (
            <EmptyState title="Sem dados" description="Selecione um período para ver o resumo." icon={TrendingUp} />
          )}
        </motion.div>
      )}

      {/* ══ TAB: HISTÓRICO ══ */}
      {activeTab === "historico" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

          {/* Filtro de data */}
          <ContentCard padding="lg">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-4 h-4 text-slate-400" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filtrar por período</p>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { id: "today",      label: "Hoje" },
                { id: "week",       label: "Semana" },
                { id: "month",      label: "Mês" },
                { id: "last-month", label: "Mês anterior" },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id as any)}
                  className="px-3 py-1.5 rounded-full border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-amber-300 hover:text-amber-600 transition-all"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DatePicker label="De" value={dateFrom} onChange={setDateFrom} max={dateTo ?? undefined} />
              <DatePicker label="Até" value={dateTo} onChange={setDateTo} min={dateFrom ?? undefined} />
            </div>
          </ContentCard>

          {history.length === 0 ? (
            <EmptyState title="Nenhum fechamento" description="Os fechamentos de caixa aparecerão aqui." icon={History} />
          ) : (
            <div className="space-y-2">
              {history.map(h => <CashHistoryRow key={h.id} h={h} />)}
            </div>
          )}
        </motion.div>
      )}

      {/* ══ MODAL: Abrir Caixa ══ */}
      <Modal isOpen={showOpenModal} onClose={() => setShowOpenModal(false)} title="Abrir Caixa" size="sm"
        footer={<ModalFooter><Button variant="ghost" onClick={() => setShowOpenModal(false)}>Cancelar</Button><Button variant="primary" loading={openLoading} onClick={handleOpenCash} iconLeft={<Unlock className="w-4 h-4" />}>Abrir Caixa</Button></ModalFooter>}
      >
        <div className="space-y-4">
          <Input label="Operador / Responsável" placeholder="Nome do operador" value={operatorName} onChange={e => setOperatorName(e.target.value)} />
          <Input label="Fundo de Caixa (R$)" type="number" placeholder="0,00" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} hint="Valor em dinheiro presente no caixa agora." />
        </div>
      </Modal>

      {/* ══ MODAL: Fechar Caixa ══ */}
      <Modal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} title="Fechar Caixa" size="sm"
        footer={<ModalFooter><Button variant="ghost" onClick={() => setShowCloseModal(false)}>Cancelar</Button><Button variant="danger" loading={closeLoading} onClick={handleCloseCash} iconLeft={<Lock className="w-4 h-4" />}>Confirmar Fechamento</Button></ModalFooter>}
      >
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
            {[
              { label: "Fundo de caixa",       value: fmt(currentCash?.openingBalance ?? 0), color: "" },
              { label: "Vendas em dinheiro",   value: `+${fmt(paymentTotals["PAYMENT_CASH"] ?? 0)}`, color: "text-green-600" },
              { label: "Suprimentos",          value: `+${fmt(totalSuprimentos)}`, color: "text-green-600" },
              { label: "Sangrias",             value: `-${fmt(totalSangrias)}`, color: "text-red-500" },
            ].map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="text-slate-500">{row.label}</span>
                <span className={`font-bold ${row.color}`}>{row.value}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-black border-t border-slate-200 pt-2">
              <span>Saldo Esperado</span>
              <span className="text-amber-500">{fmt(expectedBalance)}</span>
            </div>
          </div>

          <Input label="Saldo Contado em Caixa (R$)" type="number" placeholder="0,00" value={closingBalance} onChange={e => setClosingBalance(e.target.value)} />

          {closingBalance && (
            <div className={`rounded-xl p-3 text-sm font-black flex items-center gap-2 ${Math.abs(diffBalance) < 0.01 ? "bg-green-50 text-green-700" : diffBalance < 0 ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}`}>
              {Math.abs(diffBalance) < 0.01 ? "✓ Caixa confere" : diffBalance < 0 ? `Falta ${fmt(Math.abs(diffBalance))} no caixa` : `Sobra ${fmt(diffBalance)} no caixa`}
            </div>
          )}

          <Input label="Observações (opcional)" placeholder="Motivo de diferenças, etc." value={closeNotes} onChange={e => setCloseNotes(e.target.value)} />
        </div>
      </Modal>

      {/* ══ MODAL: Sangria / Suprimento ══ */}
      <Modal isOpen={showMovementModal} onClose={() => setShowMovementModal(false)}
        title={movementType === "SANGRIA" ? "Registrar Sangria" : "Registrar Suprimento"} size="sm"
        footer={<ModalFooter><Button variant="ghost" onClick={() => setShowMovementModal(false)}>Cancelar</Button><Button variant={movementType === "SANGRIA" ? "danger" : "primary"} loading={movementLoading} onClick={handleMovement}>Confirmar</Button></ModalFooter>}
      >
        <div className="space-y-4">
          {/* Toggle Sangria/Suprimento */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(["SANGRIA", "SUPRIMENTO"] as const).map(t => (
              <button key={t} onClick={() => setMovementType(t)}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${movementType === t ? (t === "SANGRIA" ? "bg-red-500 text-white shadow-sm" : "bg-green-500 text-white shadow-sm") : "text-slate-400"}`}
              >
                {t === "SANGRIA" ? "Sangria (Saída)" : "Suprimento (Entrada)"}
              </button>
            ))}
          </div>
          <div className={`rounded-xl p-3 text-xs font-medium ${movementType === "SANGRIA" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {movementType === "SANGRIA" ? "Retirada de dinheiro do caixa para depósito ou segurança." : "Adição de troco ou fundo extra ao caixa."}
          </div>
          <Input label="Valor (R$)" type="number" placeholder="0,00" value={movementAmount} onChange={e => setMovementAmount(e.target.value)} />
          <Input label="Descrição (opcional)" placeholder="Ex: Depósito banco, troco adicional..." value={movementDesc} onChange={e => setMovementDesc(e.target.value)} />
        </div>
      </Modal>
    </PageWrapper>
  );
}
