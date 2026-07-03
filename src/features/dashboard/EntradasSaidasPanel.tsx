import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowDownCircle, ArrowUpCircle, Plus, Filter, Download,
  Trash2, Edit2, TrendingUp, TrendingDown, Wallet,
  FileSpreadsheet, FileText, Search, X, CheckCircle2, AlertCircle,
  CalendarDays, RefreshCw, Tag, ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  PageWrapper, Modal, ModalFooter, Button, Input, EmptyState,
  useToast,
} from "../../components";
import { DatePicker } from "../../components/DatePicker";
import type { Tenant } from "../../types";

// ─── Tipos ───────────────────────────────────────────────────────────────────
type EntryType = "INCOME" | "EXPENSE";

interface Entry {
  id: string;
  tenantId: string;
  type: EntryType;
  category: string;
  description: string;
  amount: number;
  date: string;       // YYYY-MM-DD
  notes?: string | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function todayISO() { return new Date().toISOString().split("T")[0]; }
function firstOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ─── Categorias padrão ────────────────────────────────────────────────────────
const INCOME_CATEGORIES = ["Vendas Balcão", "Delivery", "iFood", "Pix", "Cartão", "Dinheiro", "Outros"];
const EXPENSE_CATEGORIES = [
  "Fornecedores", "Aluguel", "Energia Elétrica", "Água", "Gás", "Internet",
  "Funcionários", "Impostos", "Material de Limpeza", "Embalagens",
  "Manutenção", "Marketing", "Equipamentos", "Taxa iFood", "Outros"
];

// ─── Cores por categoria ──────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  "Fornecedores": "bg-orange-100 text-orange-700",
  "Aluguel": "bg-red-100 text-red-700",
  "Energia Elétrica": "bg-yellow-100 text-yellow-700",
  "Água": "bg-blue-100 text-blue-700",
  "Gás": "bg-amber-100 text-amber-700",
  "Internet": "bg-cyan-100 text-cyan-700",
  "Funcionários": "bg-purple-100 text-purple-700",
  "Impostos": "bg-pink-100 text-pink-700",
  "Vendas Balcão": "bg-green-100 text-green-700",
  "Delivery": "bg-emerald-100 text-emerald-700",
  "iFood": "bg-red-100 text-red-700",
  "Taxa iFood": "bg-rose-100 text-rose-700",
};

function catColor(cat: string): string {
  return CATEGORY_COLORS[cat] || "bg-slate-100 text-slate-600";
}

// ─── Hook de dados (usa /api/tenants/:slug/entries) ──────────────────────────
function useEntries(slug: string, dateFrom: string | null, dateTo: string | null) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const authHeader = { Authorization: `Bearer ${localStorage.getItem("auth_token")}` };

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo)   params.set("to",   dateTo);
      const res = await fetch(`/api/tenants/${slug}/entries?${params}`, { headers: authHeader });
      setEntries(res.ok ? await res.json() : []);
    } catch { setEntries([]); }
    finally { setLoading(false); }
  }, [slug, dateFrom, dateTo]);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { entries, loading, refetch: fetch_ };
}

// ─── Exportação Excel ─────────────────────────────────────────────────────────
function exportExcel(entries: Entry[], tenant: Tenant, dateFrom: string | null, dateTo: string | null) {
  const totalIncome  = entries.filter(e => e.type === "INCOME").reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter(e => e.type === "EXPENSE").reduce((s, e) => s + e.amount, 0);

  const rows = [
    /* cabeçalho do estabelecimento */
    [`${tenant.name || "Estabelecimento"}`, "", "", "", "", ""],
    [`Entradas e Saídas — ${dateFrom ? fmtDate(dateFrom) : "—"} a ${dateTo ? fmtDate(dateTo) : "—"}`, "", "", "", "", ""],
    ["", "", "", "", "", ""],
    /* cabeçalho da tabela */
    ["Data", "Tipo", "Categoria", "Descrição", "Valor (R$)", "Observações"],
    /* dados */
    ...entries.map(e => [
      fmtDate(e.date),
      e.type === "INCOME" ? "Entrada" : "Saída",
      e.category,
      e.description,
      e.type === "INCOME" ? e.amount : -e.amount,
      e.notes || "",
    ]),
    /* totais */
    ["", "", "", "", "", ""],
    ["Total Entradas", "", "", "", totalIncome,   ""],
    ["Total Saídas",   "", "", "", -totalExpense, ""],
    ["Saldo",          "", "", "", totalIncome - totalExpense, ""],
  ];

  /* Converte para CSV com separador ; (Excel BR) */
  const csv = rows.map(row =>
    row.map(cell => {
      const s = String(cell ?? "").replace(/"/g, '""');
      return s.includes(";") || s.includes("\n") ? `"${s}"` : s;
    }).join(";")
  ).join("\n");

  const BOM = "﻿";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `entradas-saidas-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Exportação PDF (HTML → print) ───────────────────────────────────────────
function exportPDF(entries: Entry[], tenant: Tenant, dateFrom: string | null, dateTo: string | null) {
  const totalIncome  = entries.filter(e => e.type === "INCOME").reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter(e => e.type === "EXPENSE").reduce((s, e) => s + e.amount, 0);
  const saldo        = totalIncome - totalExpense;

  const rows = entries.map(e => `
    <tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:8px 10px;color:#64748b;font-size:12px;">${fmtDate(e.date)}</td>
      <td style="padding:8px 10px;">
        <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;
          background:${e.type === "INCOME" ? "#dcfce7" : "#fee2e2"};
          color:${e.type === "INCOME" ? "#15803d" : "#b91c1c"};">
          ${e.type === "INCOME" ? "Entrada" : "Saída"}
        </span>
      </td>
      <td style="padding:8px 10px;font-size:12px;">${e.category}</td>
      <td style="padding:8px 10px;font-size:12px;">${e.description}</td>
      <td style="padding:8px 10px;font-size:12px;font-weight:700;text-align:right;
        color:${e.type === "INCOME" ? "#15803d" : "#b91c1c"};">
        ${e.type === "INCOME" ? "+" : "−"}${fmt(e.amount)}
      </td>
      <td style="padding:8px 10px;font-size:11px;color:#94a3b8;">${e.notes || "—"}</td>
    </tr>
  `).join("");

  const html = `
    <!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="UTF-8" />
    <title>Entradas e Saídas — ${tenant.name}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1e293b; padding: 32px; }
      h1 { font-size: 22px; font-weight: 900; color: #0D1B3E; }
      .sub { font-size: 13px; color: #64748b; margin-top: 4px; }
      .logo-row { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; border-bottom: 2px solid #C9A227; padding-bottom: 16px; }
      .logo-box { width: 48px; height: 48px; background: #0D1B3E; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
      .kpis { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin: 20px 0 24px; }
      .kpi { border-radius: 12px; padding: 14px 16px; }
      .kpi-income  { background: #f0fdf4; border: 1px solid #bbf7d0; }
      .kpi-expense { background: #fff1f2; border: 1px solid #fecdd3; }
      .kpi-balance { background: #fefce8; border: 1px solid #fde68a; }
      .kpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; }
      .kpi-value { font-size: 20px; font-weight: 900; margin-top: 6px; }
      table { width: 100%; border-collapse: collapse; }
      thead th { background: #0D1B3E; color: white; padding: 10px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; text-align: left; }
      thead th:last-child { text-align: right; }
      tbody tr:nth-child(even) { background: #f8fafc; }
      .footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
      @media print { body { padding: 16px; } }
    </style>
    </head><body>
    <div class="logo-row">
      <div class="logo-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="#C9A227" stroke-width="2" width="28" height="28">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <div>
        <h1>${tenant.name || "Estabelecimento"}</h1>
        <p class="sub">Relatório de Entradas e Saídas &nbsp;·&nbsp; ${dateFrom ? fmtDate(dateFrom) : "—"} até ${dateTo ? fmtDate(dateTo) : "—"}</p>
        ${tenant.address ? `<p class="sub" style="font-size:11px;margin-top:2px;">${tenant.address}</p>` : ""}
      </div>
    </div>

    <div class="kpis">
      <div class="kpi kpi-income">
        <div class="kpi-label">Total Entradas</div>
        <div class="kpi-value" style="color:#15803d;">${fmt(totalIncome)}</div>
      </div>
      <div class="kpi kpi-expense">
        <div class="kpi-label">Total Saídas</div>
        <div class="kpi-value" style="color:#b91c1c;">${fmt(totalExpense)}</div>
      </div>
      <div class="kpi kpi-balance">
        <div class="kpi-label">Saldo</div>
        <div class="kpi-value" style="color:${saldo >= 0 ? "#15803d" : "#b91c1c"};">${fmt(saldo)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th style="text-align:right;">Valor</th><th>Obs.</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="footer">Gerado em ${new Date().toLocaleString("pt-BR")} · BoxSys</div>
    </body></html>
  `;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.print(); };
}

// ─── Componente principal ─────────────────────────────────────────────────────
interface Props { slug: string; tenant: Tenant; }

export default function EntradasSaidasPanel({ slug, tenant }: Props) {
  const toast = useToast();
  const [dateFrom, setDateFrom] = useState<string | null>(firstOfMonthISO());
  const [dateTo,   setDateTo]   = useState<string | null>(todayISO());
  const { entries, loading, refetch } = useEntries(slug, dateFrom, dateTo);

  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState<"ALL" | EntryType>("ALL");
  const [catFilter,    setCatFilter]    = useState<string>("ALL");
  const [showFilters,  setShowFilters]  = useState(false);

  const [showModal,   setShowModal]   = useState(false);
  const [editEntry,   setEditEntry]   = useState<Entry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<Entry | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  // Formulário
  const [formType,    setFormType]    = useState<EntryType>("EXPENSE");
  const [formCat,     setFormCat]     = useState("");
  const [formDesc,    setFormDesc]    = useState("");
  const [formAmount,  setFormAmount]  = useState("");
  const [formDate,    setFormDate]    = useState(todayISO());
  const [formNotes,   setFormNotes]   = useState("");
  const [formError,   setFormError]   = useState("");

  const authHeader = { Authorization: `Bearer ${localStorage.getItem("auth_token")}` };

  const openNew = (type: EntryType = "EXPENSE") => {
    setEditEntry(null);
    setFormType(type); setFormCat(""); setFormDesc("");
    setFormAmount(""); setFormDate(todayISO()); setFormNotes(""); setFormError("");
    setShowModal(true);
  };

  const openEdit = (e: Entry) => {
    setEditEntry(e);
    setFormType(e.type); setFormCat(e.category); setFormDesc(e.description);
    setFormAmount(String(e.amount)); setFormDate(e.date); setFormNotes(e.notes || "");
    setFormError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formDesc.trim()) { setFormError("Informe uma descrição."); return; }
    const amount = parseFloat(formAmount);
    if (!amount || amount <= 0) { setFormError("Informe um valor válido."); return; }
    if (!formCat) { setFormError("Selecione uma categoria."); return; }

    setSaving(true);
    setFormError("");
    try {
      const body = JSON.stringify({
        type: formType, category: formCat, description: formDesc.trim(),
        amount, date: formDate, notes: formNotes || null,
      });
      if (editEntry) {
        await fetch(`/api/tenants/${slug}/entries/${editEntry.id}`, {
          method: "PATCH", headers: { ...authHeader, "Content-Type": "application/json" }, body,
        });
      } else {
        await fetch(`/api/tenants/${slug}/entries`, {
          method: "POST", headers: { ...authHeader, "Content-Type": "application/json" }, body,
        });
      }
      setShowModal(false);
      refetch();
    } catch { setFormError("Erro ao salvar. Tente novamente."); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteEntry) return;
    setDeleting(true);
    try {
      await fetch(`/api/tenants/${slug}/entries/${deleteEntry.id}`, {
        method: "DELETE", headers: authHeader,
      });
      setDeleteEntry(null);
      refetch();
    } catch { toast.error("Erro ao excluir."); }
    finally { setDeleting(false); }
  };

  const setPreset = (preset: string) => {
    const now = new Date();
    if (preset === "today") { setDateFrom(todayISO()); setDateTo(todayISO()); }
    else if (preset === "week") { const s = new Date(now); s.setDate(now.getDate() - now.getDay()); setDateFrom(s.toISOString().split("T")[0]); setDateTo(todayISO()); }
    else if (preset === "month") { setDateFrom(firstOfMonthISO()); setDateTo(todayISO()); }
    else { const f = new Date(now.getFullYear(), now.getMonth() - 1, 1); const l = new Date(now.getFullYear(), now.getMonth(), 0); setDateFrom(f.toISOString().split("T")[0]); setDateTo(l.toISOString().split("T")[0]); }
  };

  // Filtros aplicados
  const allCats = useMemo(() => [...new Set(entries.map(e => e.category))].sort(), [entries]);
  const filtered = useMemo(() => entries.filter(e => {
    if (typeFilter !== "ALL" && e.type !== typeFilter) return false;
    if (catFilter !== "ALL" && e.category !== catFilter) return false;
    if (search && !e.description.toLowerCase().includes(search.toLowerCase()) && !e.category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [entries, typeFilter, catFilter, search]);

  // Totais
  const totalIncome  = useMemo(() => filtered.filter(e => e.type === "INCOME").reduce((s, e) => s + e.amount, 0), [filtered]);
  const totalExpense = useMemo(() => filtered.filter(e => e.type === "EXPENSE").reduce((s, e) => s + e.amount, 0), [filtered]);
  const saldo        = totalIncome - totalExpense;

  // Por categoria (top gastos)
  const byCat = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    filtered.forEach(e => {
      if (!map[e.category]) map[e.category] = { income: 0, expense: 0 };
      if (e.type === "INCOME") map[e.category].income += e.amount;
      else map[e.category].expense += e.amount;
    });
    return Object.entries(map).sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense)).slice(0, 6);
  }, [filtered]);

  const categories = formType === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <PageWrapper>
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-slate-800">Entradas e Saídas</h2>
          <p className="text-xs text-slate-400 mt-0.5">Controle financeiro completo do estabelecimento</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={refetch} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors shrink-0">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors">
              <Download className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Exportar</span> <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 hidden group-hover:block w-44">
              <button onClick={() => exportExcel(filtered, tenant, dateFrom, dateTo)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                <FileSpreadsheet className="w-4 h-4 text-green-600" /> Exportar Excel
              </button>
              <button onClick={() => exportPDF(filtered, tenant, dateFrom, dateTo)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                <FileText className="w-4 h-4 text-red-500" /> Exportar PDF
              </button>
            </div>
          </div>
          <button onClick={() => openNew("INCOME")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-colors shadow-sm">
            <ArrowDownCircle className="w-3.5 h-3.5" /> <span>Entrada</span>
          </button>
          <button onClick={() => openNew("EXPENSE")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors shadow-sm">
            <ArrowUpCircle className="w-3.5 h-3.5" /> <span>Saída</span>
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="rounded-2xl bg-green-50 border border-green-100 p-4 flex sm:flex-col items-center sm:items-start gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:mb-2">
            <ArrowDownCircle className="w-4 h-4 text-green-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-green-600">Total Entradas</span>
          </div>
          <div className="ml-auto sm:ml-0">
            <p className="text-xl sm:text-2xl font-black text-green-700 text-right sm:text-left">{fmt(totalIncome)}</p>
            <p className="text-[10px] text-green-500 mt-0.5 text-right sm:text-left">{filtered.filter(e => e.type === "INCOME").length} lançamentos</p>
          </div>
        </div>
        <div className="rounded-2xl bg-red-50 border border-red-100 p-4 flex sm:flex-col items-center sm:items-start gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:mb-2">
            <ArrowUpCircle className="w-4 h-4 text-red-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-red-600">Total Saídas</span>
          </div>
          <div className="ml-auto sm:ml-0">
            <p className="text-xl sm:text-2xl font-black text-red-700 text-right sm:text-left">{fmt(totalExpense)}</p>
            <p className="text-[10px] text-red-500 mt-0.5 text-right sm:text-left">{filtered.filter(e => e.type === "EXPENSE").length} lançamentos</p>
          </div>
        </div>
        <div className={`rounded-2xl border p-4 flex sm:flex-col items-center sm:items-start gap-3 sm:gap-0 ${saldo >= 0 ? "bg-amber-50 border-amber-100" : "bg-red-50 border-red-100"}`}>
          <div className="flex items-center gap-2 sm:mb-2">
            <Wallet className={`w-4 h-4 ${saldo >= 0 ? "text-[#C9A227]" : "text-red-600"}`} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${saldo >= 0 ? "text-[#C9A227]" : "text-red-600"}`}>Saldo</span>
          </div>
          <div className="ml-auto sm:ml-0">
            <p className={`text-xl sm:text-2xl font-black text-right sm:text-left ${saldo >= 0 ? "text-amber-700" : "text-red-700"}`}>{fmt(saldo)}</p>
            <p className={`text-[10px] mt-0.5 text-right sm:text-left ${saldo >= 0 ? "text-amber-500" : "text-red-500"}`}>{filtered.length} lançamentos no período</p>
          </div>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-5 space-y-3">
        {/* Presets + botão filtros */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "today", label: "Hoje" },
              { id: "week", label: "Semana" },
              { id: "month", label: "Mês" },
              { id: "last-month", label: "Mês ant." },
            ].map(p => (
              <button key={p.id} onClick={() => setPreset(p.id)}
                className="px-2.5 py-1.5 rounded-full border border-slate-200 text-[11px] font-semibold text-slate-500 hover:border-[#C9A227] hover:text-[#C9A227] transition-all"
              >{p.label}</button>
            ))}
          </div>
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 text-xs font-semibold shrink-0 px-2.5 py-1.5 rounded-xl border transition-all ${showFilters ? "border-[#C9A227] text-[#C9A227] bg-amber-50" : "border-slate-200 text-slate-500 hover:text-slate-700"}`}
          >
            <Filter className="w-3.5 h-3.5" /> Filtros
          </button>
        </div>

        {/* Datas */}
        <div className="grid grid-cols-2 gap-3">
          <DatePicker label="De" value={dateFrom} onChange={setDateFrom} max={dateTo ?? undefined} />
          <DatePicker label="Até" value={dateTo} onChange={setDateTo} min={dateFrom ?? undefined} />
        </div>

        {/* Filtros avançados */}
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
            <div className="pt-2 flex flex-col gap-3">
              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar descrição ou categoria..."
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                />
                {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-slate-400" /></button>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Tipo */}
                <div className="flex bg-slate-100 p-0.5 rounded-xl">
                  {(["ALL", "INCOME", "EXPENSE"] as const).map(t => (
                    <button key={t} onClick={() => setTypeFilter(t)}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${typeFilter === t ? (t === "INCOME" ? "bg-green-500 text-white shadow-sm" : t === "EXPENSE" ? "bg-red-500 text-white shadow-sm" : "bg-white text-slate-700 shadow-sm") : "text-slate-400"}`}
                    >{t === "ALL" ? "Todos" : t === "INCOME" ? "Entradas" : "Saídas"}</button>
                  ))}
                </div>
                {/* Categoria */}
                <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                >
                  <option value="ALL">Todas as categorias</option>
                  {allCats.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Por categoria ── */}
      {byCat.length > 0 && (
        <div className="mb-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Por categoria</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {byCat.map(([cat, vals]) => {
              const total = vals.income + vals.expense;
              const maxTotal = byCat.reduce((m, [, v]) => Math.max(m, v.income + v.expense), 1);
              return (
                <button key={cat} onClick={() => setCatFilter(catFilter === cat ? "ALL" : cat)}
                  className={`rounded-xl px-3 py-2.5 text-left border transition-all ${catFilter === cat ? "border-[#C9A227] bg-amber-50" : "border-slate-100 bg-white hover:border-slate-200"}`}
                >
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mb-1.5 ${catColor(cat)}`}>{cat}</span>
                  {vals.income > 0 && <p className="text-xs font-black text-green-700">+{fmt(vals.income)}</p>}
                  {vals.expense > 0 && <p className="text-xs font-black text-red-600">−{fmt(vals.expense)}</p>}
                  <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(total / maxTotal) * 100}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full bg-[#C9A227] rounded-full"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Lista de lançamentos ── */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-slate-50">
          <p className="text-sm font-black text-slate-800">Lançamentos</p>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{filtered.length}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-4 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300 px-4 text-center">
            <Tag className="w-10 h-10 mb-3" />
            <p className="text-sm font-medium text-slate-400">Nenhum lançamento no período</p>
            <button onClick={() => openNew()} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A227] text-white text-xs font-bold hover:bg-[#b8911f] transition-colors">
              <Plus className="w-3.5 h-3.5" /> Adicionar primeiro lançamento
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            <AnimatePresence>
              {filtered.map(e => (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-start sm:items-center gap-3 px-4 sm:px-5 py-3.5 hover:bg-slate-50/70 transition-colors group"
                >
                  {/* Ícone */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${e.type === "INCOME" ? "bg-green-100" : "bg-red-100"}`}>
                    {e.type === "INCOME"
                      ? <ArrowDownCircle className="w-4 h-4 text-green-600" />
                      : <ArrowUpCircle className="w-4 h-4 text-red-600" />
                    }
                  </div>

                  {/* Descrição + categoria + data */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800 truncate max-w-[160px] sm:max-w-none">{e.description}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${catColor(e.category)}`}>{e.category}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(e.date)}{e.notes ? ` · ${e.notes}` : ""}</p>
                  </div>

                  {/* Valor + ações — empilha em mobile */}
                  <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2 shrink-0">
                    <p className={`text-sm font-black tabular-nums ${e.type === "INCOME" ? "text-green-700" : "text-red-600"}`}>
                      {e.type === "INCOME" ? "+" : "−"}{fmt(e.amount)}
                    </p>
                    {/* Botões: sempre visíveis em mobile, hover em desktop */}
                    <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(e)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={() => setDeleteEntry(e)} className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── MODAL: Novo / Editar ── */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editEntry ? "Editar Lançamento" : formType === "INCOME" ? "Nova Entrada" : "Nova Saída"}
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button
              variant={formType === "INCOME" ? "success" : "danger"}
              loading={saving}
              onClick={handleSave}
              iconLeft={formType === "INCOME" ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}
            >
              {editEntry ? "Salvar" : formType === "INCOME" ? "Registrar Entrada" : "Registrar Saída"}
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4 p-1">
          {/* Toggle Entrada/Saída */}
          <div className="flex bg-slate-100 p-0.5 rounded-xl">
            {(["INCOME", "EXPENSE"] as const).map(t => (
              <button key={t} onClick={() => { setFormType(t); setFormCat(""); }}
                className={`flex-1 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${formType === t ? (t === "INCOME" ? "bg-green-500 text-white shadow-sm" : "bg-red-500 text-white shadow-sm") : "text-slate-400"}`}
              >
                {t === "INCOME" ? "Entrada" : "Saída"}
              </button>
            ))}
          </div>

          {/* Categoria */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Categoria</p>
            <div className="flex flex-wrap gap-1.5">
              {categories.map(c => (
                <button key={c} onClick={() => setFormCat(c)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${formCat === c ? (formType === "INCOME" ? "bg-green-500 text-white border-green-500" : "bg-red-500 text-white border-red-500") : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"}`}
                >{c}</button>
              ))}
            </div>
          </div>

          <Input label="Descrição" placeholder="Ex: Compra de insumos para o dia" value={formDesc} onChange={e => setFormDesc(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valor (R$)" type="number" placeholder="0,00" value={formAmount} onChange={e => setFormAmount(e.target.value)} />
            <DatePicker label="Data" value={formDate} onChange={v => setFormDate(v || todayISO())} />
          </div>
          <Input label="Observações (opcional)" placeholder="Detalhes adicionais..." value={formNotes} onChange={e => setFormNotes(e.target.value)} />

          {formError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />{formError}
            </div>
          )}
        </div>
      </Modal>

      {/* ── MODAL: Confirmar exclusão ── */}
      <Modal
        isOpen={!!deleteEntry}
        onClose={() => setDeleteEntry(null)}
        title="Excluir Lançamento"
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="ghost" onClick={() => setDeleteEntry(null)}>Cancelar</Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete} iconLeft={<Trash2 className="w-4 h-4" />}>Excluir</Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3 p-1">
          <div className={`rounded-xl p-4 ${deleteEntry?.type === "INCOME" ? "bg-green-50" : "bg-red-50"}`}>
            <p className="text-sm font-bold text-slate-800">{deleteEntry?.description}</p>
            <p className="text-xs text-slate-500 mt-1">{deleteEntry?.category} · {deleteEntry ? fmtDate(deleteEntry.date) : ""}</p>
            <p className={`text-lg font-black mt-2 ${deleteEntry?.type === "INCOME" ? "text-green-700" : "text-red-600"}`}>
              {deleteEntry?.type === "INCOME" ? "+" : "−"}{deleteEntry ? fmt(deleteEntry.amount) : ""}
            </p>
          </div>
          <p className="text-xs text-slate-500 text-center">Esta ação não pode ser desfeita.</p>
        </div>
      </Modal>
    </PageWrapper>
  );
}
