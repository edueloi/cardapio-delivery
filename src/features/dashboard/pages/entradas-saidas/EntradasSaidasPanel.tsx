import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowDownCircle, ArrowUpCircle, Plus, Filter, Download,
  Trash2, Edit2, TrendingUp, TrendingDown, Wallet,
  FileSpreadsheet, FileText, Search, X, CheckCircle2, AlertCircle,
  CalendarDays, RefreshCw, Tag, ChevronDown, Repeat, Clock, Percent, Pause, Play,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  PageWrapper, Modal, ModalFooter, Button, Input, EmptyState,
  useToast,
} from "../../../../components";
import { DatePicker } from "../../../../components/DatePicker";
import { apiFetch } from "../../../../lib/api";
import type { Tenant } from "../../../../types";

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
  recurringEntryId?: string | null;
  dueDate?: string | null;
  status?: "PENDING" | "PAID";
  installmentNumber?: number | null;
  installmentsTotal?: number | null;
  baseAmount?: number | null;
  lateFeeApplied?: number | null;
}

type Frequency = "FIXED" | "VARIABLE";
type LateFeeInterval = "DAILY" | "MONTHLY" | "YEARLY";

interface RecurringEntry {
  id: string;
  tenantId: string;
  type: EntryType;
  category: string;
  description: string;
  frequency: Frequency;
  amount: number | null;
  dueDay: number;
  startDate: string;
  endDate: string | null;
  installmentsTotal: number | null;
  lateFeeEnabled: boolean;
  lateFeeRate: number | null;
  lateFeeInterval: LateFeeInterval | null;
  active: boolean;
  notes?: string | null;
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

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo)   params.set("to",   dateTo);
      const res = await apiFetch(`/api/tenants/${slug}/entries?${params}`);
      setEntries(res.ok ? await res.json() : []);
    } catch { setEntries([]); }
    finally { setLoading(false); }
  }, [slug, dateFrom, dateTo]);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { entries, loading, refetch: fetch_ };
}

function useRecurringEntries(slug: string) {
  const [recurring, setRecurring] = useState<RecurringEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/tenants/${slug}/recurring-entries`);
      setRecurring(res.ok ? await res.json() : []);
    } catch { setRecurring([]); }
    finally { setLoading(false); }
  }, [slug]);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { recurring, loading, refetch: fetch_ };
}

const LATE_FEE_INTERVAL_LABELS: Record<LateFeeInterval, string> = {
  DAILY: "ao dia", MONTHLY: "ao mês", YEARLY: "ao ano",
};

// tenant.address é salvo como JSON estruturado ({cep, street, number, ...}), não texto livre —
// sem isso, relatórios acabam imprimindo o JSON cru no cabeçalho.
function formatTenantAddress(raw?: string | null): string {
  if (!raw) return "";
  try {
    const addr = JSON.parse(raw);
    const parts: string[] = [];
    if (addr.street) parts.push(`${addr.street}${addr.number ? `, ${addr.number}` : ""}`);
    if (addr.complement) parts.push(addr.complement);
    if (addr.neighborhood) parts.push(addr.neighborhood);
    if (addr.city) parts.push(`${addr.city}${addr.state ? ` - ${addr.state}` : ""}`);
    if (addr.cep) parts.push(`CEP ${addr.cep}`);
    return parts.join(" · ");
  } catch {
    return raw;
  }
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
        ${formatTenantAddress(tenant.address) ? `<p class="sub" style="font-size:11px;margin-top:2px;">${formatTenantAddress(tenant.address)}</p>` : ""}
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
  const [tab, setTab] = useState<"entries" | "recurring">("entries");
  const [dateFrom, setDateFrom] = useState<string | null>(firstOfMonthISO());
  const [dateTo,   setDateTo]   = useState<string | null>(todayISO());
  const { entries, loading, refetch } = useEntries(slug, dateFrom, dateTo);
  const { recurring, loading: loadingRecurring, refetch: refetchRecurring } = useRecurringEntries(slug);

  // Confirmar lançamento pendente (recorrência variável) — preencher valor real do mês
  const [confirmEntry, setConfirmEntry] = useState<Entry | null>(null);
  const [confirmAmount, setConfirmAmount] = useState("");
  const [confirming, setConfirming] = useState(false);

  const openConfirm = (e: Entry) => {
    setConfirmEntry(e);
    setConfirmAmount("");
  };

  const handleConfirmPending = async () => {
    if (!confirmEntry) return;
    const amount = parseFloat(confirmAmount);
    if (!amount || amount <= 0) { toast.error("Informe um valor válido."); return; }
    setConfirming(true);
    try {
      await apiFetch(`/api/tenants/${slug}/entries/${confirmEntry.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      setConfirmEntry(null);
      refetch();
    } catch { toast.error("Erro ao confirmar lançamento."); }
    finally { setConfirming(false); }
  };

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
        await apiFetch(`/api/tenants/${slug}/entries/${editEntry.id}`, { method: "PATCH", body });
      } else {
        await apiFetch(`/api/tenants/${slug}/entries`, { method: "POST", body });
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
      await apiFetch(`/api/tenants/${slug}/entries/${deleteEntry.id}`, { method: "DELETE" });
      setDeleteEntry(null);
      refetch();
    } catch { toast.error("Erro ao excluir."); }
    finally { setDeleting(false); }
  };

  // ─── Recorrências ────────────────────────────────────────────────────────────
  const [showRecModal, setShowRecModal] = useState(false);
  const [editRec,      setEditRec]      = useState<RecurringEntry | null>(null);
  const [deleteRec,    setDeleteRec]    = useState<RecurringEntry | null>(null);
  const [savingRec,    setSavingRec]    = useState(false);
  const [deletingRec,  setDeletingRec]  = useState(false);

  const [recType,        setRecType]        = useState<EntryType>("EXPENSE");
  const [recCat,         setRecCat]         = useState("");
  const [recDesc,        setRecDesc]        = useState("");
  const [recFrequency,   setRecFrequency]   = useState<Frequency>("FIXED");
  const [recAmount,      setRecAmount]      = useState("");
  const [recDueDay,      setRecDueDay]      = useState("5");
  const [recStartDate,   setRecStartDate]   = useState(todayISO());
  const [recHasEndDate,  setRecHasEndDate]  = useState(false);
  const [recEndDate,     setRecEndDate]     = useState(todayISO());
  const [recHasInstallments, setRecHasInstallments] = useState(false);
  const [recInstallments,    setRecInstallments]    = useState("12");
  const [recLateFeeEnabled,  setRecLateFeeEnabled]  = useState(false);
  const [recLateFeeRate,     setRecLateFeeRate]     = useState("1");
  const [recLateFeeInterval, setRecLateFeeInterval] = useState<LateFeeInterval>("MONTHLY");
  const [recNotes,           setRecNotes]           = useState("");
  const [recError,           setRecError]           = useState("");

  const openNewRec = (type: EntryType = "EXPENSE") => {
    setEditRec(null);
    setRecType(type); setRecCat(""); setRecDesc(""); setRecFrequency("FIXED");
    setRecAmount(""); setRecDueDay("5"); setRecStartDate(todayISO());
    setRecHasEndDate(false); setRecEndDate(todayISO());
    setRecHasInstallments(false); setRecInstallments("12");
    setRecLateFeeEnabled(false); setRecLateFeeRate("1"); setRecLateFeeInterval("MONTHLY");
    setRecNotes(""); setRecError("");
    setShowRecModal(true);
  };

  const openEditRec = (r: RecurringEntry) => {
    setEditRec(r);
    setRecType(r.type); setRecCat(r.category); setRecDesc(r.description); setRecFrequency(r.frequency);
    setRecAmount(r.amount != null ? String(r.amount) : ""); setRecDueDay(String(r.dueDay));
    setRecStartDate(r.startDate);
    setRecHasEndDate(!!r.endDate); setRecEndDate(r.endDate || todayISO());
    setRecHasInstallments(!!r.installmentsTotal); setRecInstallments(r.installmentsTotal ? String(r.installmentsTotal) : "12");
    setRecLateFeeEnabled(r.lateFeeEnabled); setRecLateFeeRate(r.lateFeeRate != null ? String(r.lateFeeRate) : "1");
    setRecLateFeeInterval(r.lateFeeInterval || "MONTHLY");
    setRecNotes(r.notes || ""); setRecError("");
    setShowRecModal(true);
  };

  const handleSaveRec = async () => {
    if (!recDesc.trim()) { setRecError("Informe uma descrição."); return; }
    if (!recCat) { setRecError("Selecione uma categoria."); return; }
    if (recFrequency === "FIXED") {
      const amount = parseFloat(recAmount);
      if (!amount || amount <= 0) { setRecError("Informe o valor fixo mensal."); return; }
    }
    const dueDay = parseInt(recDueDay, 10);
    if (!dueDay || dueDay < 1 || dueDay > 28) { setRecError("Dia de vencimento deve ser entre 1 e 28."); return; }
    if (recLateFeeEnabled) {
      const rate = parseFloat(recLateFeeRate);
      if (!rate || rate <= 0) { setRecError("Informe a taxa de juros por atraso."); return; }
    }

    setSavingRec(true);
    setRecError("");
    try {
      const body = JSON.stringify({
        type: recType, category: recCat, description: recDesc.trim(),
        frequency: recFrequency,
        amount: recFrequency === "FIXED" ? parseFloat(recAmount) : null,
        dueDay,
        startDate: recStartDate,
        endDate: recHasEndDate ? recEndDate : null,
        installmentsTotal: recHasInstallments ? parseInt(recInstallments, 10) : null,
        lateFeeEnabled: recLateFeeEnabled,
        lateFeeRate: recLateFeeEnabled ? parseFloat(recLateFeeRate) : null,
        lateFeeInterval: recLateFeeEnabled ? recLateFeeInterval : null,
        notes: recNotes || null,
      });
      if (editRec) {
        await apiFetch(`/api/tenants/${slug}/recurring-entries/${editRec.id}`, { method: "PATCH", body });
      } else {
        await apiFetch(`/api/tenants/${slug}/recurring-entries`, { method: "POST", body });
      }
      setShowRecModal(false);
      refetchRecurring();
      refetch();
    } catch { setRecError("Erro ao salvar. Tente novamente."); }
    finally { setSavingRec(false); }
  };

  const handleToggleActiveRec = async (r: RecurringEntry) => {
    try {
      await apiFetch(`/api/tenants/${slug}/recurring-entries/${r.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !r.active }),
      });
      refetchRecurring();
    } catch { toast.error("Erro ao atualizar recorrência."); }
  };

  const handleDeleteRec = async () => {
    if (!deleteRec) return;
    setDeletingRec(true);
    try {
      await apiFetch(`/api/tenants/${slug}/recurring-entries/${deleteRec.id}`, { method: "DELETE" });
      setDeleteRec(null);
      refetchRecurring();
    } catch { toast.error("Erro ao excluir recorrência."); }
    finally { setDeletingRec(false); }
  };

  const recCategories = recType === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h2 className="text-xl font-black text-slate-800">Entradas e Saídas</h2>
          <p className="text-xs text-slate-400 mt-0.5">Controle financeiro completo do estabelecimento</p>
        </div>
        {tab === "entries" ? (
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
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={refetchRecurring} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors shrink-0">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => openNewRec("INCOME")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-colors shadow-sm">
              <ArrowDownCircle className="w-3.5 h-3.5" /> <span>Receita</span>
            </button>
            <button onClick={() => openNewRec("EXPENSE")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors shadow-sm">
              <ArrowUpCircle className="w-3.5 h-3.5" /> <span>Despesa</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Abas ── */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-5 w-full sm:w-auto sm:inline-flex">
        <button onClick={() => setTab("entries")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all ${tab === "entries" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400"}`}
        >
          <Wallet className="w-3.5 h-3.5" /> Lançamentos
        </button>
        <button onClick={() => setTab("recurring")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all ${tab === "recurring" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400"}`}
        >
          <Repeat className="w-3.5 h-3.5" /> Recorrências
          {recurring.filter(r => r.active).length > 0 && (
            <span className="ml-1 bg-[#C9A227] text-white text-[9px] font-black rounded-full px-1.5 py-0.5">{recurring.filter(r => r.active).length}</span>
          )}
        </button>
      </div>

      {tab === "recurring" ? (
        <RecurringEntriesTab
          recurring={recurring}
          loading={loadingRecurring}
          onEdit={openEditRec}
          onToggleActive={handleToggleActiveRec}
          onDelete={setDeleteRec}
        />
      ) : (
      <>
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
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${e.status === "PENDING" ? "bg-amber-100" : e.type === "INCOME" ? "bg-green-100" : "bg-red-100"}`}>
                    {e.status === "PENDING"
                      ? <Clock className="w-4 h-4 text-amber-600" />
                      : e.type === "INCOME"
                      ? <ArrowDownCircle className="w-4 h-4 text-green-600" />
                      : <ArrowUpCircle className="w-4 h-4 text-red-600" />
                    }
                  </div>

                  {/* Descrição + categoria + data */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800 truncate max-w-[160px] sm:max-w-none">{e.description}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${catColor(e.category)}`}>{e.category}</span>
                      {e.recurringEntryId && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 bg-slate-100 text-slate-500 flex items-center gap-0.5">
                          <Repeat className="w-2.5 h-2.5" /> recorrente
                        </span>
                      )}
                      {e.status === "PENDING" && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 bg-amber-100 text-amber-700">aguardando valor</span>
                      )}
                      {!!e.lateFeeApplied && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 bg-red-100 text-red-700 flex items-center gap-0.5">
                          <Percent className="w-2.5 h-2.5" /> +{fmt(e.lateFeeApplied)} juros
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {e.status === "PENDING" ? `Venc. ${fmtDate(e.dueDate || e.date)}` : fmtDate(e.date)}
                      {e.notes ? ` · ${e.notes}` : ""}
                    </p>
                  </div>

                  {/* Valor + ações — empilha em mobile */}
                  <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2 shrink-0">
                    {e.status === "PENDING" ? (
                      <button onClick={() => openConfirm(e)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold transition-colors shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Preencher valor
                      </button>
                    ) : (
                      <p className={`text-sm font-black tabular-nums ${e.type === "INCOME" ? "text-green-700" : "text-red-600"}`}>
                        {e.type === "INCOME" ? "+" : "−"}{fmt(e.amount)}
                      </p>
                    )}
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
      </>
      )}

      {/* ── MODAL: Confirmar/preencher lançamento pendente (recorrência variável) ── */}
      <Modal
        isOpen={!!confirmEntry}
        onClose={() => setConfirmEntry(null)}
        title="Preencher Valor do Mês"
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="ghost" onClick={() => setConfirmEntry(null)}>Cancelar</Button>
            <Button variant="success" loading={confirming} onClick={handleConfirmPending} iconLeft={<CheckCircle2 className="w-4 h-4" />}>Confirmar</Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4 p-1">
          <div className="rounded-xl p-4 bg-amber-50 border border-amber-100">
            <p className="text-sm font-bold text-slate-800">{confirmEntry?.description}</p>
            <p className="text-xs text-slate-500 mt-1">{confirmEntry?.category} · Venc. {confirmEntry ? fmtDate(confirmEntry.dueDate || confirmEntry.date) : ""}</p>
          </div>
          <Input label="Valor deste mês (R$)" type="number" placeholder="0,00" value={confirmAmount} onChange={e => setConfirmAmount(e.target.value)} />
        </div>
      </Modal>

      {/* ── MODAL: Nova / Editar Recorrência ── */}
      <Modal
        isOpen={showRecModal}
        onClose={() => setShowRecModal(false)}
        title={editRec ? "Editar Recorrência" : recType === "INCOME" ? "Nova Receita Recorrente" : "Nova Despesa Recorrente"}
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowRecModal(false)}>Cancelar</Button>
            <Button
              variant={recType === "INCOME" ? "success" : "danger"}
              loading={savingRec}
              onClick={handleSaveRec}
              iconLeft={<Repeat className="w-4 h-4" />}
            >
              {editRec ? "Salvar" : "Criar Recorrência"}
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4 p-1">
          {/* Toggle Receita/Despesa */}
          <div className="flex bg-slate-100 p-0.5 rounded-xl">
            {(["INCOME", "EXPENSE"] as const).map(t => (
              <button key={t} onClick={() => { setRecType(t); setRecCat(""); }}
                className={`flex-1 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${recType === t ? (t === "INCOME" ? "bg-green-500 text-white shadow-sm" : "bg-red-500 text-white shadow-sm") : "text-slate-400"}`}
              >
                {t === "INCOME" ? "Receita" : "Despesa"}
              </button>
            ))}
          </div>

          {/* Categoria */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Categoria</p>
            <div className="flex flex-wrap gap-1.5">
              {recCategories.map(c => (
                <button key={c} onClick={() => setRecCat(c)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${recCat === c ? (recType === "INCOME" ? "bg-green-500 text-white border-green-500" : "bg-red-500 text-white border-red-500") : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"}`}
                >{c}</button>
              ))}
            </div>
          </div>

          <Input label="Descrição" placeholder="Ex: Conta de energia elétrica" value={recDesc} onChange={e => setRecDesc(e.target.value)} />

          {/* Fixo x Variável */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Tipo de valor</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setRecFrequency("FIXED")}
                className={`text-left rounded-xl border p-3 transition-all ${recFrequency === "FIXED" ? "border-[#C9A227] bg-amber-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
              >
                <p className="text-xs font-black text-slate-800">Fixo</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Mesmo valor todo mês, lançado automaticamente</p>
              </button>
              <button onClick={() => setRecFrequency("VARIABLE")}
                className={`text-left rounded-xl border p-3 transition-all ${recFrequency === "VARIABLE" ? "border-[#C9A227] bg-amber-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
              >
                <p className="text-xs font-black text-slate-800">Variável</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Você preenche o valor todo mês (ex: conta de luz)</p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {recFrequency === "FIXED" && (
              <Input label="Valor fixo (R$)" type="number" placeholder="0,00" value={recAmount} onChange={e => setRecAmount(e.target.value)} />
            )}
            <Input label="Dia do vencimento" type="number" min={1} max={28} placeholder="Ex: 5" value={recDueDay} onChange={e => setRecDueDay(e.target.value)}
              className={recFrequency === "VARIABLE" ? "col-span-2" : undefined}
            />
          </div>

          <DatePicker label="Começa em" value={recStartDate} onChange={v => setRecStartDate(v || todayISO())} />

          {/* Parcelas */}
          <div className="rounded-xl border border-slate-200 p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={recHasInstallments} onChange={e => setRecHasInstallments(e.target.checked)} className="w-4 h-4 rounded accent-[#C9A227]" />
              <span className="text-xs font-bold text-slate-700">Tem número de parcelas definido</span>
            </label>
            {recHasInstallments && (
              <div className="mt-3">
                <Input label="Total de parcelas" type="number" min={1} placeholder="Ex: 12" value={recInstallments} onChange={e => setRecInstallments(e.target.value)} />
                <p className="text-[10px] text-slate-400 mt-1">A recorrência para de gerar lançamentos automaticamente após a última parcela.</p>
              </div>
            )}
          </div>

          {/* Data de término opcional (independente de parcelas) */}
          <div className="rounded-xl border border-slate-200 p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={recHasEndDate} onChange={e => setRecHasEndDate(e.target.checked)} className="w-4 h-4 rounded accent-[#C9A227]" />
              <span className="text-xs font-bold text-slate-700">Definir data final</span>
            </label>
            {recHasEndDate && (
              <div className="mt-3">
                <DatePicker label="Termina em" value={recEndDate} onChange={v => setRecEndDate(v || todayISO())} min={recStartDate} />
              </div>
            )}
          </div>

          {/* Juros por atraso */}
          <div className="rounded-xl border border-slate-200 p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={recLateFeeEnabled} onChange={e => setRecLateFeeEnabled(e.target.checked)} className="w-4 h-4 rounded accent-[#C9A227]" />
              <span className="text-xs font-bold text-slate-700">Aplicar juros se atrasar o pagamento</span>
            </label>
            {recLateFeeEnabled && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Input label="Taxa de juros (%)" type="number" step="0.01" placeholder="Ex: 1" value={recLateFeeRate} onChange={e => setRecLateFeeRate(e.target.value)} />
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-1.5">Periodicidade</p>
                  <select value={recLateFeeInterval} onChange={e => setRecLateFeeInterval(e.target.value as LateFeeInterval)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                  >
                    <option value="DAILY">Ao dia</option>
                    <option value="MONTHLY">Ao mês</option>
                    <option value="YEARLY">Ao ano</option>
                  </select>
                </div>
                <p className="col-span-2 text-[10px] text-slate-400">O juros é calculado sobre o valor do lançamento a partir do dia seguinte ao vencimento, e somado automaticamente.</p>
              </div>
            )}
          </div>

          <Input label="Observações (opcional)" placeholder="Detalhes adicionais..." value={recNotes} onChange={e => setRecNotes(e.target.value)} />

          {recError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />{recError}
            </div>
          )}
        </div>
      </Modal>

      {/* ── MODAL: Excluir recorrência ── */}
      <Modal
        isOpen={!!deleteRec}
        onClose={() => setDeleteRec(null)}
        title="Excluir Recorrência"
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="ghost" onClick={() => setDeleteRec(null)}>Cancelar</Button>
            <Button variant="danger" loading={deletingRec} onClick={handleDeleteRec} iconLeft={<Trash2 className="w-4 h-4" />}>Excluir</Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3 p-1">
          <div className={`rounded-xl p-4 ${deleteRec?.type === "INCOME" ? "bg-green-50" : "bg-red-50"}`}>
            <p className="text-sm font-bold text-slate-800">{deleteRec?.description}</p>
            <p className="text-xs text-slate-500 mt-1">{deleteRec?.category}</p>
          </div>
          <p className="text-xs text-slate-500 text-center">Os lançamentos já gerados por esta recorrência permanecem no histórico. Apenas a regra de recorrência é excluída.</p>
        </div>
      </Modal>
    </PageWrapper>
  );
}

// ─── Aba de Recorrências ───────────────────────────────────────────────────────
interface RecurringEntriesTabProps {
  recurring: RecurringEntry[];
  loading: boolean;
  onEdit: (r: RecurringEntry) => void;
  onToggleActive: (r: RecurringEntry) => void;
  onDelete: (r: RecurringEntry) => void;
}

function RecurringEntriesTab({ recurring, loading, onEdit, onToggleActive, onDelete }: RecurringEntriesTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-4 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (recurring.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center py-16 text-slate-300 px-4 text-center">
        <Repeat className="w-10 h-10 mb-3" />
        <p className="text-sm font-medium text-slate-400">Nenhuma recorrência cadastrada</p>
        <p className="text-xs text-slate-300 mt-1 max-w-xs">Cadastre gastos e receitas que se repetem todo mês, como água, luz, aluguel ou assinaturas de sistema.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {recurring.map(r => (
        <div key={r.id} className={`bg-white rounded-2xl border p-4 ${r.active ? "border-slate-100" : "border-slate-100 opacity-60"}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${r.type === "INCOME" ? "bg-green-100" : "bg-red-100"}`}>
                {r.type === "INCOME"
                  ? <ArrowDownCircle className="w-4 h-4 text-green-600" />
                  : <ArrowUpCircle className="w-4 h-4 text-red-600" />
                }
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{r.description}</p>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block ${catColor(r.category)}`}>{r.category}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => onToggleActive(r)} title={r.active ? "Pausar" : "Reativar"} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
                {r.active ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
              <button onClick={() => onEdit(r)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
                <Edit2 className="w-3 h-3" />
              </button>
              <button onClick={() => onDelete(r)} className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${r.frequency === "FIXED" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
              {r.frequency === "FIXED" ? `Fixo · ${fmt(r.amount || 0)}` : "Variável"}
            </span>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-500 flex items-center gap-1">
              <CalendarDays className="w-2.5 h-2.5" /> Todo dia {r.dueDay}
            </span>
            {r.installmentsTotal && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-purple-100 text-purple-700">{r.installmentsTotal}x parcelas</span>
            )}
            {r.lateFeeEnabled && r.lateFeeRate && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                <Percent className="w-2.5 h-2.5" /> {r.lateFeeRate}% {LATE_FEE_INTERVAL_LABELS[r.lateFeeInterval || "MONTHLY"]}
              </span>
            )}
            {!r.active && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-200 text-slate-600">Pausada</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
