import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowDownCircle, ArrowUpCircle, Plus, Filter, Download,
  Trash2, Edit2, TrendingUp, TrendingDown, Wallet,
  FileSpreadsheet, FileText, Search, X, CheckCircle2, AlertCircle,
  CalendarDays, RefreshCw, Tag, ChevronDown, Repeat, Clock, Percent, Pause, Play, Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard, FormRow, Tabs, Alert, Badge, IconButton, Select, Switch,
  GridTable, usePagination, FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch,
  FilterLineSegmented, FilterLineDateRange, type Column,
  Modal, ModalFooter, Button, Input, EmptyState,
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

type MainTabId = "ALL" | "INCOME" | "EXPENSE" | "recurring";

const REC_TABS = [
  { id: "dados", label: "Dados", icon: Tag },
  { id: "regras", label: "Regras", icon: Percent },
] as const;
type RecTabId = (typeof REC_TABS)[number]["id"];

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
      h1 { font-size: 22px; font-weight: 900; color: #0f172a; }
      .sub { font-size: 13px; color: #64748b; margin-top: 4px; }
      .logo-row { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; border-bottom: 2px solid #2563eb; padding-bottom: 16px; }
      .logo-box { width: 48px; height: 48px; background: #0f172a; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
      .kpis { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin: 20px 0 24px; }
      .kpi { border-radius: 12px; padding: 14px 16px; }
      .kpi-income  { background: #f0fdf4; border: 1px solid #bbf7d0; }
      .kpi-expense { background: #fff1f2; border: 1px solid #fecdd3; }
      .kpi-balance { background: #fefce8; border: 1px solid #fde68a; }
      .kpi-label { font-size: 10px; font-weight: 700; text-transform: ; letter-spacing: 0.1em; color: #94a3b8; }
      .kpi-value { font-size: 20px; font-weight: 900; margin-top: 6px; }
      table { width: 100%; border-collapse: collapse; }
      thead th { background: #0f172a; color: white; padding: 10px 10px; font-size: 11px; font-weight: 700; text-transform: ; letter-spacing: 0.08em; text-align: left; }
      thead th:last-child { text-align: right; }
      tbody tr:nth-child(even) { background: #f8fafc; }
      .footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
      @media print { body { padding: 16px; } }
    </style>
    </head><body>
    <div class="logo-row">
      <div class="logo-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" width="28" height="28">
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
        <div class="kpi-value" style="color:${saldo >= 0 ?"#15803d":"#b91c1c"};">${fmt(saldo)}</div>
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
  const [recTab,             setRecTab]             = useState<RecTabId>("dados");

  const openNewRec = (type: EntryType = "EXPENSE") => {
    setEditRec(null);
    setRecType(type); setRecCat(""); setRecDesc(""); setRecFrequency("FIXED");
    setRecAmount(""); setRecDueDay("5"); setRecStartDate(todayISO());
    setRecHasEndDate(false); setRecEndDate(todayISO());
    setRecHasInstallments(false); setRecInstallments("12");
    setRecLateFeeEnabled(false); setRecLateFeeRate("1"); setRecLateFeeInterval("MONTHLY");
    setRecNotes(""); setRecError(""); setRecTab("dados");
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
    setRecNotes(r.notes || ""); setRecError(""); setRecTab("dados");
    setShowRecModal(true);
  };

  const handleSaveRec = async () => {
    if (!recDesc.trim()) { setRecTab("dados"); setRecError("Informe uma descrição."); return; }
    if (!recCat) { setRecTab("dados"); setRecError("Selecione uma categoria."); return; }
    if (recFrequency === "FIXED") {
      const amount = parseFloat(recAmount);
      if (!amount || amount <= 0) { setRecTab("dados"); setRecError("Informe o valor fixo mensal."); return; }
    }
    const dueDay = parseInt(recDueDay, 10);
    if (!dueDay || dueDay < 1 || dueDay > 28) { setRecTab("dados"); setRecError("Dia de vencimento deve ser entre 1 e 28."); return; }
    if (recLateFeeEnabled) {
      const rate = parseFloat(recLateFeeRate);
      if (!rate || rate <= 0) { setRecTab("regras"); setRecError("Informe a taxa de juros por atraso."); return; }
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

  const typeCounts = useMemo(() => {
    const base = entries.filter(e => {
      if (catFilter !== "ALL" && e.category !== catFilter) return false;
      if (search && !e.description.toLowerCase().includes(search.toLowerCase()) && !e.category.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    return {
      ALL: base.length,
      INCOME: base.filter(e => e.type === "INCOME").length,
      EXPENSE: base.filter(e => e.type === "EXPENSE").length,
    };
  }, [entries, catFilter, search]);
  const activeRecurring = recurring.filter(r => r.active).length;

  const mainTabs = [
    { id: "ALL" as const, label: "Todos", icon: Wallet, badge: typeCounts.ALL },
    { id: "INCOME" as const, label: "Entradas", icon: ArrowDownCircle, badge: typeCounts.INCOME },
    { id: "EXPENSE" as const, label: "Saídas", icon: ArrowUpCircle, badge: typeCounts.EXPENSE },
    { id: "recurring" as const, label: "Recorrências", icon: Repeat, badge: activeRecurring },
  ];
  const mainTabValue: MainTabId = tab === "recurring" ? "recurring" : typeFilter;
  const handleMainTab = (v: MainTabId) => {
    if (v === "recurring") { setTab("recurring"); return; }
    setTab("entries");
    setTypeFilter(v);
  };

  const entriesPag = usePagination(filtered, 15);

  const entryColumns: Column<Entry>[] = [
    {
      header: "Lançamento",
      render: (e) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${e.status === "PENDING" ? "bg-amber-50" : e.type === "INCOME" ? "bg-emerald-50" : "bg-red-50"}`}>
            {e.status === "PENDING"
              ? <Clock size={14} className="text-amber-600" />
              : e.type === "INCOME"
              ? <ArrowDownCircle size={14} className="text-emerald-600" />
              : <ArrowUpCircle size={14} className="text-red-600" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs font-medium text-slate-800 break-words">{e.description}</p>
              {e.recurringEntryId && <Badge size="sm" icon={<Repeat size={10} />}>recorrente</Badge>}
              {e.status === "PENDING" && <Badge size="sm" color="warning">aguardando valor</Badge>}
              {!!e.lateFeeApplied && <Badge size="sm" color="danger" icon={<Percent size={10} />}>+{fmt(e.lateFeeApplied)} juros</Badge>}
            </div>
            {e.notes && <p className="text-[11px] text-slate-500 mt-0.5 break-words">{e.notes}</p>}
          </div>
        </div>
      ),
    },
    { header: "Categoria", render: (e) => <Badge size="sm">{e.category}</Badge> },
    {
      header: "Data",
      render: (e) => (
        <span className="text-xs text-slate-600 whitespace-nowrap">
          {e.status === "PENDING" ? `Venc. ${fmtDate(e.dueDate || e.date)}` : fmtDate(e.date)}
        </span>
      ),
    },
    {
      header: "Valor",
      render: (e) => e.status === "PENDING" ? (
        <Button size="xs" variant="outline" onClick={() => openConfirm(e)} iconLeft={<CheckCircle2 size={14} />}>Preencher valor</Button>
      ) : (
        <span className={`text-xs font-semibold tabular-nums whitespace-nowrap ${e.type === "INCOME" ? "text-emerald-700" : "text-red-600"}`}>
          {e.type === "INCOME" ? "+" : "−"}{fmt(e.amount)}
        </span>
      ),
    },
    {
      header: "",
      render: (e) => (
        <div className="flex items-center gap-1 justify-end">
          <IconButton variant="ghost" size="xs" aria-label="Editar lançamento" onClick={() => openEdit(e)}><Edit2 size={14} /></IconButton>
          <IconButton variant="ghost" size="xs" aria-label="Excluir lançamento" onClick={() => setDeleteEntry(e)}><Trash2 size={14} /></IconButton>
        </div>
      ),
    },
  ];

  return (
    <PageWrapper>
      <div className="space-y-4">
        {/* ── Header ── */}
        <SectionTitle
          title="Entradas e Saídas"
          description="Controle financeiro completo do estabelecimento"
          icon={Wallet}
          action={tab === "entries" ? (
            <>
              <IconButton variant="outline" size="sm" aria-label="Atualizar" onClick={refetch}><RefreshCw size={14} /></IconButton>
              <Button variant="outline" size="sm" onClick={() => exportExcel(filtered, tenant, dateFrom, dateTo)} iconLeft={<FileSpreadsheet size={14} />}>Excel</Button>
              <Button variant="outline" size="sm" onClick={() => exportPDF(filtered, tenant, dateFrom, dateTo)} iconLeft={<FileText size={14} />}>PDF</Button>
              <Button variant="success" size="sm" onClick={() => openNew("INCOME")} iconLeft={<ArrowDownCircle size={14} />}>Entrada</Button>
              <Button variant="danger" size="sm" onClick={() => openNew("EXPENSE")} iconLeft={<ArrowUpCircle size={14} />}>Saída</Button>
            </>
          ) : (
            <>
              <IconButton variant="outline" size="sm" aria-label="Atualizar" onClick={refetchRecurring}><RefreshCw size={14} /></IconButton>
              <Button variant="success" size="sm" onClick={() => openNewRec("INCOME")} iconLeft={<ArrowDownCircle size={14} />}>Receita</Button>
              <Button variant="danger" size="sm" onClick={() => openNewRec("EXPENSE")} iconLeft={<ArrowUpCircle size={14} />}>Despesa</Button>
            </>
          )}
        />

        {/* ── KPIs ── */}
        {tab === "entries" && (
          <StatGrid cols={3}>
            <StatCard title="Total entradas" value={fmt(totalIncome)} icon={ArrowDownCircle} color="success" description={`${filtered.filter(e => e.type === "INCOME").length} lançamentos`} />
            <StatCard title="Total saídas" value={fmt(totalExpense)} icon={ArrowUpCircle} color="danger" description={`${filtered.filter(e => e.type === "EXPENSE").length} lançamentos`} />
            <StatCard title="Saldo" value={fmt(saldo)} icon={Wallet} color={saldo >= 0 ? "info" : "danger"} description={`${filtered.length} lançamentos no período`} />
          </StatGrid>
        )}

        <Tabs<MainTabId> items={mainTabs} value={mainTabValue} onChange={handleMainTab} label="Entradas e saídas">
          {tab === "recurring" ? (
            <RecurringEntriesTab
              recurring={recurring}
              loading={loadingRecurring}
              onEdit={openEditRec}
              onToggleActive={handleToggleActiveRec}
              onDelete={setDeleteRec}
            />
          ) : (
            <div className="space-y-3">
              {/* ── Filtros ── */}
              <FilterLine>
                <FilterLineSection grow>
                  <FilterLineItem grow minWidth={180}>
                    <FilterLineSearch value={search} onChange={setSearch} placeholder="Buscar descrição ou categoria..." aria-label="Buscar lançamentos" className="max-w-[280px]" />
                  </FilterLineItem>
                  <FilterLineItem minWidth={260}>
                    <FilterLineDateRange from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
                  </FilterLineItem>
                </FilterLineSection>
                <FilterLineSection align="right">
                  <FilterLineItem fullOnMobile={false}>
                    <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)} iconLeft={<Filter size={14} />}>
                      Filtros{catFilter !== "ALL" ? " (1)" : ""}
                    </Button>
                  </FilterLineItem>
                </FilterLineSection>
              </FilterLine>

              {showFilters && (
                <FilterLine>
                  <FilterLineSection grow>
                    <FilterLineItem fullOnMobile={false}>
                      <FilterLineSegmented
                        value=""
                        onChange={(v) => setPreset(String(v))}
                        options={[
                          { value: "today", label: "Hoje" },
                          { value: "week", label: "Semana" },
                          { value: "month", label: "Mês" },
                          { value: "last-month", label: "Mês ant." },
                        ]}
                      />
                    </FilterLineItem>
                    <FilterLineItem minWidth={200} fullOnMobile={false}>
                      <Select value={catFilter} onChange={e => setCatFilter(e.target.value)} aria-label="Categoria">
                        <option value="ALL">Todas as categorias</option>
                        {allCats.map(c => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    </FilterLineItem>
                  </FilterLineSection>
                </FilterLine>
              )}

              {/* ── Por categoria ── */}
              {byCat.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-slate-500 mb-2">Por categoria</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
                    {byCat.map(([cat, vals]) => {
                      const total = vals.income + vals.expense;
                      const maxTotal = byCat.reduce((m, [, v]) => Math.max(m, v.income + v.expense), 1);
                      return (
                        <button key={cat} type="button" onClick={() => setCatFilter(catFilter === cat ? "ALL" : cat)}
                          className={`rounded-lg px-3 py-2.5 text-left border transition-all ${catFilter === cat ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                        >
                          <span className="text-[11px] font-medium text-slate-700 block mb-1 truncate">{cat}</span>
                          {vals.income > 0 && <p className="text-xs font-semibold tabular-nums text-emerald-700">+{fmt(vals.income)}</p>}
                          {vals.expense > 0 && <p className="text-xs font-semibold tabular-nums text-red-600">−{fmt(vals.expense)}</p>}
                          <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(total / maxTotal) * 100}%` }}
                              transition={{ duration: 0.5 }}
                              className="h-full bg-blue-600 rounded-full"
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Lista de lançamentos ── */}
              <ContentCard padding="none">
                <GridTable
                  noDesktopCard
                  data={entriesPag.paginatedData}
                  columns={entryColumns}
                  keyExtractor={(e) => e.id}
                  isLoading={loading}
                  emptyMessage={
                    <EmptyState
                      icon={Tag}
                      title="Nenhum lançamento no período"
                      description={search || catFilter !== "ALL" ? "Ajuste a busca ou os filtros." : "Registre a primeira entrada ou saída."}
                      action={<Button size="sm" onClick={() => openNew()} iconLeft={<Plus size={14} />}>Adicionar lançamento</Button>}
                    />
                  }
                  pagination={{
                    total: filtered.length,
                    page: entriesPag.page,
                    pageSize: entriesPag.pageSize,
                    onPageChange: entriesPag.setPage,
                    onPageSizeChange: entriesPag.setPageSize,
                  }}
                />
              </ContentCard>
            </div>
          )}
        </Tabs>
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
              iconLeft={formType === "INCOME" ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
            >
              {editEntry ? "Salvar" : formType === "INCOME" ? "Registrar Entrada" : "Registrar Saída"}
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4 p-1">
          <FilterLineSegmented
            value={formType}
            onChange={(t) => { setFormType(t as EntryType); setFormCat(""); }}
            options={[{ value: "INCOME", label: "Entrada" }, { value: "EXPENSE", label: "Saída" }]}
          />

          {/* Categoria */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">Categoria</p>
            <div className="flex flex-wrap gap-1.5">
              {categories.map(c => (
                <button key={c} type="button" onClick={() => setFormCat(c)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${formCat === c ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"}`}
                >{c}</button>
              ))}
            </div>
          </div>

          <Input label="Descrição" placeholder="Ex: Compra de insumos para o dia" value={formDesc} onChange={e => setFormDesc(e.target.value)} />
          <FormRow cols={2}>
            <Input label="Valor (R$)" type="number" placeholder="0,00" value={formAmount} onChange={e => setFormAmount(e.target.value)} />
            <DatePicker label="Data" value={formDate} onChange={v => setFormDate(v || todayISO())} />
          </FormRow>
          <Input label="Observações (opcional)" placeholder="Detalhes adicionais..." value={formNotes} onChange={e => setFormNotes(e.target.value)} />

          {formError && <Alert variant="error">{formError}</Alert>}
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
            <Button variant="danger" loading={deleting} onClick={handleDelete} iconLeft={<Trash2 size={14} />}>Excluir</Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3 p-1">
          <div className={`rounded-lg p-3 border ${deleteEntry?.type === "INCOME" ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
            <p className="text-[13px] font-medium text-slate-800">{deleteEntry?.description}</p>
            <p className="text-xs text-slate-500 mt-1">{deleteEntry?.category} · {deleteEntry ? fmtDate(deleteEntry.date) : ""}</p>
            <p className={`text-base font-semibold mt-2 ${deleteEntry?.type === "INCOME" ? "text-emerald-700" : "text-red-600"}`}>
              {deleteEntry?.type === "INCOME" ? "+" : "−"}{deleteEntry ? fmt(deleteEntry.amount) : ""}
            </p>
          </div>
          <p className="text-xs text-slate-500 text-center">Esta ação não pode ser desfeita.</p>
        </div>
      </Modal>

      {/* ── MODAL: Confirmar/preencher lançamento pendente (recorrência variável) ── */}
      <Modal
        isOpen={!!confirmEntry}
        onClose={() => setConfirmEntry(null)}
        title="Preencher Valor do Mês"
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="ghost" onClick={() => setConfirmEntry(null)}>Cancelar</Button>
            <Button variant="success" loading={confirming} onClick={handleConfirmPending} iconLeft={<CheckCircle2 size={14} />}>Confirmar</Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4 p-1">
          <Alert variant="warning" title={confirmEntry?.description}>
            {confirmEntry?.category} · Venc. {confirmEntry ? fmtDate(confirmEntry.dueDate || confirmEntry.date) : ""}
          </Alert>
          <Input label="Valor deste mês (R$)" type="number" placeholder="0,00" value={confirmAmount} onChange={e => setConfirmAmount(e.target.value)} />
        </div>
      </Modal>

      {/* ── MODAL: Nova / Editar Recorrência ── */}
      <Modal
        isOpen={showRecModal}
        onClose={() => setShowRecModal(false)}
        title={editRec ? "Editar Recorrência" : recType === "INCOME" ? "Nova Receita Recorrente" : "Nova Despesa Recorrente"}
        size="md"
        footer={
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowRecModal(false)}>Cancelar</Button>
            <Button
              variant={recType === "INCOME" ? "success" : "danger"}
              loading={savingRec}
              onClick={handleSaveRec}
              iconLeft={<Repeat size={14} />}
            >
              {editRec ? "Salvar" : "Criar Recorrência"}
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3 p-1">
          <Tabs<RecTabId> items={REC_TABS} value={recTab} onChange={setRecTab} label="Dados da recorrência">
            {recTab === "dados" && (
              <div className="space-y-4">
                <FilterLineSegmented
                  value={recType}
                  onChange={(t) => { setRecType(t as EntryType); setRecCat(""); }}
                  options={[{ value: "INCOME", label: "Receita" }, { value: "EXPENSE", label: "Despesa" }]}
                />

                {/* Categoria */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Categoria</p>
                  <div className="flex flex-wrap gap-1.5">
                    {recCategories.map(c => (
                      <button key={c} type="button" onClick={() => setRecCat(c)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${recCat === c ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"}`}
                      >{c}</button>
                    ))}
                  </div>
                </div>

                <Input label="Descrição" placeholder="Ex: Conta de energia elétrica" value={recDesc} onChange={e => setRecDesc(e.target.value)} />

                {/* Fixo x Variável */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Tipo de valor</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button type="button" onClick={() => setRecFrequency("FIXED")}
                      className={`text-left rounded-lg border p-3 transition-all ${recFrequency === "FIXED" ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                    >
                      <p className="text-xs font-medium text-slate-800">Fixo</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Mesmo valor todo mês, lançado automaticamente</p>
                    </button>
                    <button type="button" onClick={() => setRecFrequency("VARIABLE")}
                      className={`text-left rounded-lg border p-3 transition-all ${recFrequency === "VARIABLE" ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                    >
                      <p className="text-xs font-medium text-slate-800">Variável</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Você preenche o valor todo mês (ex: conta de luz)</p>
                    </button>
                  </div>
                </div>

                <FormRow cols={2}>
                  {recFrequency === "FIXED" && (
                    <Input label="Valor fixo (R$)" type="number" placeholder="0,00" value={recAmount} onChange={e => setRecAmount(e.target.value)} />
                  )}
                  <Input label="Dia do vencimento" type="number" min={1} max={28} placeholder="Ex: 5" value={recDueDay} onChange={e => setRecDueDay(e.target.value)}
                    wrapperClassName={recFrequency === "VARIABLE" ? "col-span-2" : undefined}
                  />
                </FormRow>

                <DatePicker label="Começa em" value={recStartDate} onChange={v => setRecStartDate(v || todayISO())} />
              </div>
            )}

            {recTab === "regras" && (
              <div className="space-y-3">
                {/* Parcelas */}
                <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                  <Switch checked={recHasInstallments} onCheckedChange={setRecHasInstallments} label="Tem número de parcelas definido" />
                  {recHasInstallments && (
                    <div>
                      <Input label="Total de parcelas" type="number" min={1} placeholder="Ex: 12" value={recInstallments} onChange={e => setRecInstallments(e.target.value)} />
                      <p className="text-[11px] text-slate-500 mt-1">A recorrência para de gerar lançamentos automaticamente após a última parcela.</p>
                    </div>
                  )}
                </div>

                {/* Data de término opcional (independente de parcelas) */}
                <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                  <Switch checked={recHasEndDate} onCheckedChange={setRecHasEndDate} label="Definir data final" />
                  {recHasEndDate && (
                    <DatePicker label="Termina em" value={recEndDate} onChange={v => setRecEndDate(v || todayISO())} min={recStartDate} />
                  )}
                </div>

                {/* Juros por atraso */}
                <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                  <Switch checked={recLateFeeEnabled} onCheckedChange={setRecLateFeeEnabled} label="Aplicar juros se atrasar o pagamento" />
                  {recLateFeeEnabled && (
                    <FormRow cols={2}>
                      <Input label="Taxa de juros (%)" type="number" step="0.01" placeholder="Ex: 1" value={recLateFeeRate} onChange={e => setRecLateFeeRate(e.target.value)} />
                      <Select label="Periodicidade" value={recLateFeeInterval} onChange={e => setRecLateFeeInterval(e.target.value as LateFeeInterval)}>
                        <option value="DAILY">Ao dia</option>
                        <option value="MONTHLY">Ao mês</option>
                        <option value="YEARLY">Ao ano</option>
                      </Select>
                      <p className="col-span-2 text-[11px] text-slate-500">O juros é calculado sobre o valor do lançamento a partir do dia seguinte ao vencimento, e somado automaticamente.</p>
                    </FormRow>
                  )}
                </div>

                <Input label="Observações (opcional)" placeholder="Detalhes adicionais..." value={recNotes} onChange={e => setRecNotes(e.target.value)} />
              </div>
            )}
          </Tabs>

          {recError && <Alert variant="error">{recError}</Alert>}
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
            <Button variant="danger" loading={deletingRec} onClick={handleDeleteRec} iconLeft={<Trash2 size={14} />}>Excluir</Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3 p-1">
          <div className={`rounded-lg p-3 border ${deleteRec?.type === "INCOME" ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
            <p className="text-[13px] font-medium text-slate-800">{deleteRec?.description}</p>
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
      <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" />Carregando recorrências…
      </div>
    );
  }

  if (recurring.length === 0) {
    return (
      <ContentCard>
        <EmptyState
          icon={Repeat}
          title="Nenhuma recorrência cadastrada"
          description="Cadastre gastos e receitas que se repetem todo mês, como água, luz, aluguel ou assinaturas de sistema."
        />
      </ContentCard>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {recurring.map(r => (
        <ContentCard key={r.id} padding="md" className={r.active ? "" : "opacity-60"}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${r.type === "INCOME" ? "bg-emerald-50" : "bg-red-50"}`}>
                {r.type === "INCOME"
                  ? <ArrowDownCircle size={14} className="text-emerald-600" />
                  : <ArrowUpCircle size={14} className="text-red-600" />
                }
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-800 truncate">{r.description}</p>
                <Badge size="sm">{r.category}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <IconButton variant="ghost" size="xs" aria-label={r.active ? "Pausar recorrência" : "Reativar recorrência"} title={r.active ? "Pausar" : "Reativar"} onClick={() => onToggleActive(r)}>
                {r.active ? <Pause size={14} /> : <Play size={14} />}
              </IconButton>
              <IconButton variant="ghost" size="xs" aria-label="Editar recorrência" onClick={() => onEdit(r)}><Edit2 size={14} /></IconButton>
              <IconButton variant="ghost" size="xs" aria-label="Excluir recorrência" onClick={() => onDelete(r)}><Trash2 size={14} /></IconButton>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge size="sm" color={r.frequency === "FIXED" ? "primary" : "warning"}>
              {r.frequency === "FIXED" ? `Fixo · ${fmt(r.amount || 0)}` : "Variável"}
            </Badge>
            <Badge size="sm" icon={<CalendarDays size={10} />}>Todo dia {r.dueDay}</Badge>
            {r.installmentsTotal && <Badge size="sm" color="purple">{r.installmentsTotal}x parcelas</Badge>}
            {r.lateFeeEnabled && r.lateFeeRate && (
              <Badge size="sm" color="danger" icon={<Percent size={10} />}>
                {r.lateFeeRate}% {LATE_FEE_INTERVAL_LABELS[r.lateFeeInterval || "MONTHLY"]}
              </Badge>
            )}
            {!r.active && <Badge size="sm">Pausada</Badge>}
          </div>
        </ContentCard>
      ))}
    </div>
  );
}
