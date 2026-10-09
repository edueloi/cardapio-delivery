import React, { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import {
  Wallet, CheckCircle2, Clock, Loader2, User, Calendar, ChevronRight, ChevronLeft, Printer, AlertTriangle,
  Download, FileSpreadsheet, FileText, PieChart as PieChartIcon, ListOrdered, BarChart3, DollarSign,
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Button, IconButton, Modal, ModalFooter, StatGrid, StatCard, Tabs, PanelCard, ContentCard, Badge, EmptyState,
  GridTable, usePagination, FilterLine, FilterLineSection, FilterLineItem, FilterLineSearch,
  FilterLineSegmented, FilterLineDateRange, type Column,
} from "../../../../components";
import { apiFetch } from "../../../../lib/api";
import { cn } from "../../../../lib/utils";
import type { CashRegister, CashMovement, Tenant } from "../../../../types";

// Mesmo padrão de filtro de período usado no resto do Financeiro — navegador de
// mês/ano com atalho pra período livre.
type PeriodPreset = "today" | "week" | "month" | "year" | "custom" | "all";
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayRange(): { from: string; to: string } {
  const today = toISODate(new Date());
  return { from: today, to: today };
}
function weekRange(): { from: string; to: string } {
  // Semana corrente de domingo a sábado, igual ao calendário — evita confusão
  // sobre "quando começa a semana" pra quem só quer ver "essa semana".
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { from: toISODate(start), to: toISODate(end) };
}
function monthRange(year: number, month: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, month + 1, 0).getDate();
  return { from: `${year}-${pad(month + 1)}-01`, to: `${year}-${pad(month + 1)}-${pad(lastDay)}` };
}
function yearRange(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

// Cada CashMovement de venda já nasce separado por método real (PAYMENT_CASH,
// PAYMENT_PIX, PAYMENT_CREDIT, PAYMENT_DEBIT, PAYMENT_VR) — ao contrário do
// store-stock, que guarda um payment_method composto e precisa decompor na
// leitura. Aqui não há esse parsing: o valor de cada CashMovement já é líquido
// (nunca inclui o troco devolvido ao cliente), então não existe o bug de
// "dinheiro inflado pelo troco" que esse componente corrigia no outro projeto.
const PM_LABEL: Record<string, string> = {
  CASH: "Dinheiro", PIX: "PIX", DEBIT: "Débito", CREDIT: "Crédito", VR: "Vale Refeição", SPLIT: "Dividido",
};
const PM_COLOR: Record<string, string> = {
  CASH: "#059669", PIX: "#7C3AED", DEBIT: "#2563EB", CREDIT: "#D97706", VR: "#0D9488", SPLIT: "#DC2626",
};
const PM_ICON_BG: Record<string, string> = {
  CASH: "bg-emerald-50 text-emerald-600", PIX: "bg-violet-50 text-violet-600",
  DEBIT: "bg-blue-50 text-blue-600", CREDIT: "bg-amber-50 text-amber-600",
  VR: "bg-teal-50 text-teal-600", SPLIT: "bg-rose-50 text-rose-600",
};
function methodLabel(method: string): string {
  if (method.startsWith("STONE_")) return `Maquininha (${method.replace("STONE_", "")})`;
  return PM_LABEL[method] ?? method;
}

const money = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Session = CashRegister & { movements?: CashMovement[] };

const HISTORY_TABS = [
  { id: "sessions", label: "Sessões", icon: Wallet },
  { id: "report", label: "Relatório", icon: BarChart3 },
] as const;

export default function CashHistoryPanel({ tenant }: { tenant: Tenant }) {
  const slug = tenant.slug;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [detail, setDetail] = useState<Session | null>(null);
  const [mainTab, setMainTab] = useState<"sessions" | "report">("sessions");
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filtro de período da aba Relatório — default "Mês" (o balanço só faz
  // sentido com um recorte de tempo, diferente da aba Sessões que lista tudo).
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("month");
  const nowRef = useState(() => new Date())[0];
  const [navYear, setNavYear] = useState(nowRef.getFullYear());
  const [navMonth, setNavMonth] = useState(nowRef.getMonth());
  const [dateFrom, setDateFrom] = useState(() => monthRange(nowRef.getFullYear(), nowRef.getMonth()).from);
  const [dateTo, setDateTo] = useState(() => monthRange(nowRef.getFullYear(), nowRef.getMonth()).to);

  const applyPeriodPreset = (p: PeriodPreset) => {
    setPeriodPreset(p);
    if (p === "today") { const r = todayRange(); setDateFrom(r.from); setDateTo(r.to); }
    else if (p === "week") { const r = weekRange(); setDateFrom(r.from); setDateTo(r.to); }
    else if (p === "month") { const r = monthRange(navYear, navMonth); setDateFrom(r.from); setDateTo(r.to); }
    else if (p === "year") { const r = yearRange(navYear); setDateFrom(r.from); setDateTo(r.to); }
  };

  // Período próprio do modal de exportação — desacoplado do filtro da tela.
  const [exportPreset, setExportPreset] = useState<PeriodPreset>("month");
  const [exportFrom, setExportFrom] = useState(dateFrom);
  const [exportTo, setExportTo] = useState(dateTo);
  const [exportNavYear, setExportNavYear] = useState(navYear);
  const [exportNavMonth, setExportNavMonth] = useState(navMonth);

  const applyExportPreset = (p: PeriodPreset) => {
    setExportPreset(p);
    if (p === "month") { const r = monthRange(exportNavYear, exportNavMonth); setExportFrom(r.from); setExportTo(r.to); }
    else if (p === "year") { const r = yearRange(exportNavYear); setExportFrom(r.from); setExportTo(r.to); }
    else if (p === "all") { setExportFrom(""); setExportTo(""); }
  };

  const navigateExportPeriod = (delta: number) => {
    if (exportPreset === "year") {
      const y = exportNavYear + delta;
      setExportNavYear(y); setExportPreset("year");
      const r = yearRange(y); setExportFrom(r.from); setExportTo(r.to);
      return;
    }
    let m = exportNavMonth + delta; let y = exportNavYear;
    if (m > 11) { m = 0; y++; } if (m < 0) { m = 11; y--; }
    setExportNavMonth(m); setExportNavYear(y); setExportPreset("month");
    const r = monthRange(y, m); setExportFrom(r.from); setExportTo(r.to);
  };

  const openExportModal = () => {
    setExportPreset(periodPreset === "all" ? "month" : periodPreset);
    setExportFrom(dateFrom);
    setExportTo(dateTo);
    setExportNavYear(navYear);
    setExportNavMonth(navMonth);
    setShowExportModal(true);
  };

  const navigatePeriod = (delta: number) => {
    if (periodPreset === "year") {
      const y = navYear + delta;
      setNavYear(y); setPeriodPreset("year");
      const r = yearRange(y); setDateFrom(r.from); setDateTo(r.to);
      return;
    }
    let m = navMonth + delta; let y = navYear;
    if (m > 11) { m = 0; y++; } if (m < 0) { m = 11; y--; }
    setNavMonth(m); setNavYear(y); setPeriodPreset("month");
    const r = monthRange(y, m); setDateFrom(r.from); setDateTo(r.to);
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/tenants/${slug}/cash/history?from=2000-01-01&to=2100-12-31`);
      const data = res.ok ? await res.json() : [];
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, [slug]);

  // Aba Sessões — lista tudo, sem filtro de período (só busca por operador e status).
  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (statusFilter !== "all" && s.status.toLowerCase() !== statusFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const haystack = `${s.openedByName || s.operatorName || ""} ${s.closedByName || ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [sessions, statusFilter, searchTerm]);

  // Aba Relatório — sempre recortada pelo filtro de período (Mês/Ano/Livre).
  const sessionsForReport = useMemo(() => {
    return sessions.filter((s) => {
      if (periodPreset === "all") return true;
      const opened = s.openedAt.substring(0, 10);
      return opened >= dateFrom && opened <= dateTo;
    });
  }, [sessions, periodPreset, dateFrom, dateTo]);

  // Diferente do store-stock (que busca pedidos sob demanda por sessão), o
  // /cash/history já devolve os movements com o pedido anexado — não precisa
  // de um segundo fetch por sessão.
  const allMovements = useMemo(
    () => sessionsForReport.flatMap((s) => s.movements || []),
    [sessionsForReport]
  );
  const paymentMovements = useMemo(
    () => allMovements.filter((m) => m.type.startsWith("PAYMENT_")),
    [allMovements]
  );

  function computeFinanceTotals(movements: CashMovement[]) {
    // Um pedido dividido (Pix + Dinheiro, ex.) gera um CashMovement por forma de
    // pagamento, mas grossTotal/discount/fee/total pertencem ao PEDIDO, não a cada
    // movimento — somar por movimento inflava esses totais proporcionalmente ao
    // número de splits (um pedido de R$50 dividido em 2 parcelas contava R$100).
    const seenOrderIds = new Set<string>();
    return movements.reduce((acc, m) => {
      const order = m.order;
      if (!order) { acc.net += m.amount; return acc; }
      if (seenOrderIds.has(order.id)) return acc;
      seenOrderIds.add(order.id);
      acc.gross += order.grossTotal;
      acc.discount += order.discount || 0;
      acc.fee += (order.feeAmount || 0) + (order.serviceFeeAmount || 0);
      acc.net += order.total;
      return acc;
    }, { gross: 0, discount: 0, fee: 0, net: 0 });
  }
  const financeTotals = useMemo(() => computeFinanceTotals(paymentMovements), [paymentMovements]);

  function computePaymentByMethod(movements: CashMovement[]) {
    const totals: Record<string, number> = {};
    for (const m of movements) {
      const method = m.type.replace("PAYMENT_", "");
      totals[method] = (totals[method] || 0) + m.amount;
    }
    return Object.entries(totals)
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  function computeSoldItems(movements: CashMovement[]) {
    // Um pedido pode ter sido dividido em mais de um CashMovement (Dividir
    // Pagamento) — sem deduplicar por orderId, os itens vendidos apareceriam
    // repetidos uma vez por forma de pagamento usada na mesma venda.
    const seenOrderIds = new Set<string>();
    return movements.flatMap((m) => {
      const order = m.order;
      if (!order || seenOrderIds.has(order.id)) return [];
      seenOrderIds.add(order.id);
      const methods = movements.filter((mm) => mm.order?.id === order.id).map((mm) => mm.type.replace("PAYMENT_", ""));
      return order.items.map((it) => ({
        orderId: order.id,
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.price,
        total: it.price * it.quantity,
        createdAt: m.createdAt,
        sellerName: m.operatorName || "—",
        paymentLabel: Array.from(new Set(methods)).map(methodLabel).join(" + "),
        paymentMethods: Array.from(new Set(methods)),
      }));
    });
  }

  const paymentByMethod = useMemo(() => computePaymentByMethod(paymentMovements), [paymentMovements]);
  const soldItems = useMemo(() => computeSoldItems(paymentMovements), [paymentMovements]);

  // Filtro por forma de pagamento na tabela de Itens Vendidos.
  const [itemsPaymentFilter, setItemsPaymentFilter] = useState<"all" | string>("all");
  const filteredSoldItems = useMemo(() => {
    if (itemsPaymentFilter === "all") return soldItems;
    return soldItems.filter((it) => it.paymentMethods.includes(itemsPaymentFilter));
  }, [soldItems, itemsPaymentFilter]);
  const availablePaymentMethods = useMemo(() => {
    const set = new Set<string>();
    soldItems.forEach((it) => it.paymentMethods.forEach((m) => set.add(m)));
    return Array.from(set);
  }, [soldItems]);

  // Vendas por dia — pro gráfico de evolução da aba Relatório.
  const salesByDay = useMemo(() => {
    const totals: Record<string, number> = {};
    const seenOrderIds = new Set<string>();
    for (const m of paymentMovements) {
      const order = m.order;
      if (!order || seenOrderIds.has(order.id)) continue;
      seenOrderIds.add(order.id);
      const day = m.createdAt.substring(0, 10);
      totals[day] = (totals[day] ?? 0) + order.total;
    }
    return Object.entries(totals).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total }));
  }, [paymentMovements]);

  const counts = useMemo(() => ({
    total: sessions.length,
    open: sessions.filter((s) => s.status === "OPEN").length,
    closed: sessions.filter((s) => s.status === "CLOSED").length,
    withDifference: sessions.filter((s) => {
      if (s.status !== "CLOSED" || s.closingBalance == null || s.expectedBalance == null) return false;
      return Math.abs(s.closingBalance - s.expectedBalance) >= 0.01;
    }).length,
  }), [sessions]);

  const goToReportForSession = (session: Session) => {
    const from = session.openedAt.substring(0, 10);
    const to = (session.closedAt ?? new Date().toISOString()).substring(0, 10);
    setDateFrom(from);
    setDateTo(to);
    setPeriodPreset("custom");
    setMainTab("report");
    setDetail(null);
  };

  const printSessionReceipt = (session: Session) => {
    const W = 42;
    const rule = "=".repeat(W);
    const thin = "-".repeat(W);
    const money2 = (v: number) => v.toFixed(2).replace(".", ",");
    const truncate = (v: string, max = W) => String(v || "").slice(0, max);
    const center = (v: string) => {
      const text = truncate(v);
      return " ".repeat(Math.max(0, Math.floor((W - text.length) / 2))) + text;
    };
    const row = (left: string, right = "") => {
      const rightText = truncate(right, 15);
      const leftText = truncate(left, W - rightText.length - 1);
      return `${leftText}${" ".repeat(Math.max(1, W - leftText.length - rightText.length))}${rightText}`;
    };

    let receipt = "\n";
    receipt += `${rule}\n${center("FECHAMENTO DE CAIXA")}\n${thin}\n`;
    receipt += row("Aberto por", session.openedByName || session.operatorName || "—") + "\n";
    receipt += row("Fechado por", session.closedByName ?? "-") + "\n";
    receipt += row("Abertura", new Date(session.openedAt).toLocaleString("pt-BR")) + "\n";
    if (session.closedAt) receipt += row("Fechamento", new Date(session.closedAt).toLocaleString("pt-BR")) + "\n";
    receipt += `${thin}\n`;
    receipt += row("Valor de abertura", `R$ ${money2(session.openingBalance)}`) + "\n";
    if (session.paymentBreakdown) {
      receipt += `${thin}\n${center("POR FORMA DE PAGAMENTO")}\n${thin}\n`;
      Object.entries(session.paymentBreakdown).forEach(([method, entry]) => {
        receipt += row(PM_LABEL[method] ?? method, `R$ ${money2(entry.expected)}`) + "\n";
        if (method === "CASH") {
          const salesOnly = Math.round((entry.expected - session.openingBalance) * 100) / 100;
          receipt += row("  Fundo de abertura", `R$ ${money2(session.openingBalance)}`) + "\n";
          receipt += row("  + Vendas em dinheiro", `R$ ${money2(salesOnly)}`) + "\n";
        }
        if (entry.fee) {
          receipt += row("  Taxa maquininha", `R$ -${money2(entry.fee)}`) + "\n";
          receipt += row("  Líquido", `R$ ${money2(entry.net ?? entry.expected - entry.fee)}`) + "\n";
        }
        if (entry.counted !== undefined) receipt += row("  Contado", `R$ ${money2(entry.counted)}`) + "\n";
        if (entry.difference !== undefined && entry.difference !== 0) {
          receipt += row("  Diferença", `${entry.difference > 0 ? "+" : ""}R$ ${money2(entry.difference)}`) + "\n";
        }
      });
    }
    receipt += `${rule}\n`;
    receipt += row("TOTAL ESPERADO", `R$ ${money2(session.expectedBalance ?? 0)}`) + "\n";
    receipt += row("TOTAL CONTADO", `R$ ${money2(session.closingBalance ?? 0)}`) + "\n";
    const diff = (session.closingBalance ?? 0) - (session.expectedBalance ?? 0);
    receipt += row(Math.abs(diff) < 0.01 ? "CAIXA CONFERE" : diff > 0 ? "SOBRA" : "FALTA", `R$ ${money2(Math.abs(diff))}`) + "\n";
    receipt += `${rule}\n\n\n`;

    const desktop = (window as any).pdvDesktop;
    if (desktop?.printReceipt) {
      desktop.printReceipt(receipt).catch(() => {});
      return;
    }
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "none" });
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<pre style="font-family:'Courier New',monospace;font-size:12px;white-space:pre-wrap">${receipt}</pre>`);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1500);
    }, 400);
  };

  const grandTotal = paymentByMethod.reduce((a, v) => a + v.amount, 0);

  function sessionsAndMovementsForPeriod(from: string, to: string) {
    const sessionsInPeriod = sessions.filter((s) => {
      if (!from && !to) return true;
      const opened = s.openedAt.substring(0, 10);
      if (from && opened < from) return false;
      if (to && opened > to) return false;
      return true;
    });
    const movements = sessionsInPeriod.flatMap((s) => s.movements || []).filter((m) => m.type.startsWith("PAYMENT_"));
    return { sessionsInPeriod, movements };
  }

  async function exportSessionsToExcel() {
    setExporting(true);
    try {
      const { sessionsInPeriod: filtered, movements } = sessionsAndMovementsForPeriod(exportFrom, exportTo);
      const paymentByMethod = computePaymentByMethod(movements);
      const soldItems = computeSoldItems(movements);
      const financeTotals = computeFinanceTotals(movements);
      const grandTotal = paymentByMethod.reduce((a, v) => a + v.amount, 0);
      const periodPreset = exportPreset;
      const navYear = exportNavYear;
      const navMonth = exportNavMonth;
      const dateFrom = exportFrom;
      const dateTo = exportTo;

      function drawPaymentPieChart(): string | null {
        const entries = paymentByMethod.filter((v) => v.amount > 0);
        if (entries.length === 0) return null;
        const canvas = document.createElement("canvas");
        canvas.width = 460; canvas.height = 300;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const cx = 140, cy = 150, r = 100;
        const total = entries.reduce((a, v) => a + v.amount, 0);
        let start = -Math.PI / 2;
        entries.forEach((seg) => {
          const angle = (seg.amount / total) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, r, start, start + angle);
          ctx.closePath();
          ctx.fillStyle = PM_COLOR[seg.method] ?? "#64748B";
          ctx.fill();
          start += angle;
        });
        ctx.font = "bold 12px Arial";
        let ly = 30;
        entries.forEach((seg) => {
          ctx.fillStyle = PM_COLOR[seg.method] ?? "#64748B";
          ctx.fillRect(300, ly, 14, 14);
          ctx.fillStyle = "#1E293B";
          const pct = total > 0 ? Math.round((seg.amount / total) * 100) : 0;
          ctx.fillText(`${methodLabel(seg.method)} · ${pct}%`, 320, ly + 12);
          ly += 24;
        });
        return canvas.toDataURL("image/png").split(",")[1];
      }

      const wb = new ExcelJS.Workbook();
      wb.creator = "Box Sys";
      wb.created = new Date();

      const font = (opts: { bold?: boolean; italic?: boolean; size?: number; color?: string }): Partial<ExcelJS.Font> => ({
        name: "Calibri", size: opts.size ?? 11, bold: !!opts.bold, italic: !!opts.italic,
        color: { argb: `FF${opts.color ?? "1E293B"}` },
      });
      const fill = (hex: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: `FF${hex}` } });
      const border = (): Partial<ExcelJS.Borders> => ({
        top: { style: "thin", color: { argb: "FFE2E8F0" } }, bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } }, right: { style: "thin", color: { argb: "FFE2E8F0" } },
      });

      const periodLabel = periodPreset === "month" ? `${MONTHS[navMonth]} ${navYear}`
        : periodPreset === "year" ? String(navYear)
        : periodPreset === "custom" ? `${dateFrom} a ${dateTo}`
        : "Todo o período";

      // ── Aba 1: Resumo ──
      const wsResumo = wb.addWorksheet("Resumo", { pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true } });
      wsResumo.columns = [{ key: "a", width: 26 }, { key: "b", width: 20 }];
      wsResumo.getRow(1).getCell(1).value = "Histórico de Caixa — Resumo";
      wsResumo.getRow(1).getCell(1).font = font({ bold: true, size: 16, color: "1E3A5F" });
      wsResumo.getRow(2).getCell(1).value = `Período: ${periodLabel}  ·  Gerado em: ${new Date().toLocaleString("pt-BR")}`;
      wsResumo.getRow(2).getCell(1).font = font({ size: 9, italic: true, color: "94A3B8" });
      wsResumo.getRow(3).height = 4;

      wsResumo.getRow(4).getCell(1).value = "TOTAIS FINANCEIROS";
      wsResumo.getRow(4).getCell(1).font = font({ bold: true, size: 11, color: "1E3A5F" });
      const finRows: [string, number][] = [
        ["Valor Bruto", financeTotals.gross],
        ["Descontos", -financeTotals.discount],
        ["Acréscimos/Taxas", financeTotals.fee],
        ["Valor Líquido", financeTotals.net],
      ];
      finRows.forEach(([label, val], i) => {
        const row = wsResumo.getRow(5 + i);
        row.getCell(1).value = label; row.getCell(1).font = font({ size: 10, bold: label === "Valor Líquido" });
        row.getCell(2).value = val; row.getCell(2).numFmt = '"R$" #,##0.00';
        row.getCell(2).alignment = { horizontal: "right" };
        row.getCell(2).font = font({ size: 10, bold: label === "Valor Líquido" });
        [1, 2].forEach((c) => { row.getCell(c).border = border(); row.getCell(c).fill = fill(label === "Valor Líquido" ? "F1F5F9" : "FFFFFF"); });
      });

      let r = 5 + finRows.length + 1;
      wsResumo.getRow(r).getCell(1).value = "POR FORMA DE PAGAMENTO";
      wsResumo.getRow(r).getCell(1).font = font({ bold: true, size: 11, color: "1E3A5F" });
      r += 1;

      const HEADERS_R = ["Forma de Pagamento", "Total (R$)"];
      HEADERS_R.forEach((h, i) => {
        const cell = wsResumo.getRow(r).getCell(i + 1);
        cell.value = h; cell.font = font({ bold: true, size: 10, color: "FFFFFF" });
        cell.fill = fill("1E3A5F"); cell.border = border();
        cell.alignment = { horizontal: i === 1 ? "right" : "left", vertical: "middle" };
      });
      const paymentHeaderRow = r;
      wsResumo.getRow(r).height = 20;
      r += 1;

      paymentByMethod.forEach((seg, i) => {
        const row = wsResumo.getRow(r + i);
        const altBg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
        row.getCell(1).value = methodLabel(seg.method);
        row.getCell(2).value = seg.amount;
        row.getCell(2).numFmt = '"R$" #,##0.00';
        row.getCell(2).alignment = { horizontal: "right" };
        [1, 2].forEach((c) => { row.getCell(c).fill = fill(altBg); row.getCell(c).border = border(); row.getCell(c).font = font({ size: 10 }); });
      });
      const totalRowIdx = r + paymentByMethod.length;
      wsResumo.getRow(totalRowIdx).getCell(1).value = "TOTAL GERAL";
      wsResumo.getRow(totalRowIdx).getCell(1).font = font({ bold: true, size: 11 });
      wsResumo.getRow(totalRowIdx).getCell(2).value = grandTotal;
      wsResumo.getRow(totalRowIdx).getCell(2).numFmt = '"R$" #,##0.00';
      wsResumo.getRow(totalRowIdx).getCell(2).alignment = { horizontal: "right" };
      wsResumo.getRow(totalRowIdx).getCell(2).font = font({ bold: true, size: 11 });
      [1, 2].forEach((c) => { wsResumo.getRow(totalRowIdx).getCell(c).fill = fill("F1F5F9"); wsResumo.getRow(totalRowIdx).getCell(c).border = border(); });
      wsResumo.autoFilter = { from: { row: paymentHeaderRow, column: 1 }, to: { row: totalRowIdx - 1, column: 2 } };

      const chartBase64 = drawPaymentPieChart();
      if (chartBase64) {
        const imageId = wb.addImage({ base64: chartBase64, extension: "png" });
        wsResumo.addImage(imageId, { tl: { col: 0, row: totalRowIdx + 2 }, ext: { width: 460, height: 300 } });
      }

      // ── Aba 2: Sessões ──
      const wsSessions = wb.addWorksheet("Sessões de Caixa", { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true } });
      wsSessions.columns = [
        { key: "opened_by", width: 20 }, { key: "closed_by", width: 20 },
        { key: "opened_at", width: 18 }, { key: "closed_at", width: 18 }, { key: "status", width: 12 },
        { key: "opening", width: 14 }, { key: "expected", width: 14 }, { key: "counted", width: 14 }, { key: "diff", width: 14 },
      ];
      wsSessions.getRow(1).getCell(1).value = "Sessões de Caixa";
      wsSessions.getRow(1).getCell(1).font = font({ bold: true, size: 14, color: "1E3A5F" });
      wsSessions.getRow(2).getCell(1).value = `Período: ${periodLabel} · ${filtered.length} sessão(ões)`;
      wsSessions.getRow(2).getCell(1).font = font({ size: 9, italic: true, color: "94A3B8" });
      wsSessions.getRow(3).height = 4;

      const HEADERS_S = ["Aberto por", "Fechado por", "Abertura", "Fechamento", "Status", "Valor Inicial", "Esperado", "Contado", "Diferença"];
      HEADERS_S.forEach((h, i) => {
        const cell = wsSessions.getRow(4).getCell(i + 1);
        cell.value = h; cell.font = font({ bold: true, size: 10, color: "FFFFFF" });
        cell.fill = fill("1E3A5F"); cell.border = border();
        cell.alignment = { horizontal: i >= 5 ? "right" : "left", vertical: "middle" };
      });
      wsSessions.getRow(4).height = 20;

      filtered.forEach((s, i) => {
        const row = wsSessions.getRow(5 + i);
        const altBg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
        const diff = (s.closingBalance ?? 0) - (s.expectedBalance ?? 0);
        const cells = [
          s.openedByName || s.operatorName || "—", s.closedByName ?? "—",
          new Date(s.openedAt).toLocaleString("pt-BR"),
          s.closedAt ? new Date(s.closedAt).toLocaleString("pt-BR") : "—",
          s.status === "OPEN" ? "Aberto" : "Fechado",
          s.openingBalance, s.expectedBalance ?? 0, s.closingBalance ?? 0, s.status === "CLOSED" ? diff : 0,
        ];
        cells.forEach((val, ci) => {
          const cell = row.getCell(ci + 1);
          cell.value = val;
          cell.fill = fill(altBg); cell.border = border(); cell.font = font({ size: 10 });
          if (ci >= 5) { cell.numFmt = '"R$" #,##0.00'; cell.alignment = { horizontal: "right" }; }
        });
      });
      if (filtered.length > 0) {
        wsSessions.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + filtered.length, column: 9 } };
      }

      // ── Aba 3: Itens Vendidos ──
      const wsItems = wb.addWorksheet("Itens Vendidos", { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true } });
      wsItems.columns = [
        { key: "order", width: 12 }, { key: "product", width: 30 }, { key: "qty", width: 8 },
        { key: "unit", width: 12 }, { key: "total", width: 14 }, { key: "date", width: 18 },
        { key: "seller", width: 18 }, { key: "payment", width: 22 },
      ];
      wsItems.getRow(1).getCell(1).value = "Itens Vendidos";
      wsItems.getRow(1).getCell(1).font = font({ bold: true, size: 14, color: "1E3A5F" });
      wsItems.getRow(2).getCell(1).value = `Período: ${periodLabel} · ${soldItems.length} item(ns)`;
      wsItems.getRow(2).getCell(1).font = font({ size: 9, italic: true, color: "94A3B8" });
      wsItems.getRow(3).height = 4;

      const HEADERS_I = ["Pedido", "Produto", "Qtd", "Unitário", "Total", "Data/Hora", "Operador", "Pagamento"];
      HEADERS_I.forEach((h, i) => {
        const cell = wsItems.getRow(4).getCell(i + 1);
        cell.value = h; cell.font = font({ bold: true, size: 10, color: "FFFFFF" });
        cell.fill = fill("1E3A5F"); cell.border = border();
        cell.alignment = { horizontal: [2, 3].includes(i) ? "right" : "left", vertical: "middle" };
      });
      wsItems.getRow(4).height = 20;

      soldItems.forEach((it, i) => {
        const row = wsItems.getRow(5 + i);
        const altBg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
        const cells = [
          `#${it.orderId.slice(-6).toUpperCase()}`, it.productName, it.quantity,
          it.unitPrice, it.total, new Date(it.createdAt).toLocaleString("pt-BR"),
          it.sellerName, it.paymentLabel,
        ];
        cells.forEach((val, ci) => {
          const cell = row.getCell(ci + 1);
          cell.value = val;
          cell.fill = fill(altBg); cell.border = border(); cell.font = font({ size: 10 });
          if (ci === 3 || ci === 4) { cell.numFmt = '"R$" #,##0.00'; cell.alignment = { horizontal: "right" }; }
          if (ci === 2) cell.alignment = { horizontal: "right" };
        });
      });
      if (soldItems.length > 0) {
        wsItems.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + soldItems.length, column: 8 } };
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `historico-caixa-${new Date().toISOString().substring(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
      setShowExportModal(false);
    }
  }

  async function exportSessionsToPDF() {
    setExporting(true);
    const { sessionsInPeriod: filtered, movements } = sessionsAndMovementsForPeriod(exportFrom, exportTo);
    const paymentByMethod = computePaymentByMethod(movements);
    const soldItems = computeSoldItems(movements);
    const financeTotals = computeFinanceTotals(movements);
    const grandTotal = paymentByMethod.reduce((a, v) => a + v.amount, 0);
    const periodPreset = exportPreset;
    const navYear = exportNavYear;
    const navMonth = exportNavMonth;
    const dateFrom = exportFrom;
    const dateTo = exportTo;
    setExporting(false);

    const periodLabel = periodPreset === "month" ? `${MONTHS[navMonth]} ${navYear}`
      : periodPreset === "year" ? String(navYear)
      : periodPreset === "custom" ? `${dateFrom} a ${dateTo}`
      : "Todo o período";

    const paymentRows = paymentByMethod.map((seg) => `
      <tr><td>${methodLabel(seg.method)}</td><td style="text-align:right;font-weight:700">${money(seg.amount)}</td></tr>`).join("");

    const sessionRows = filtered.map((s) => {
      const diff = (s.closingBalance ?? 0) - (s.expectedBalance ?? 0);
      return `
      <tr>
        <td>${s.openedByName || s.operatorName || "—"}</td>
        <td>${s.closedByName ?? "—"}</td>
        <td style="text-align:center">${new Date(s.openedAt).toLocaleString("pt-BR")}</td>
        <td style="text-align:center">${s.closedAt ? new Date(s.closedAt).toLocaleString("pt-BR") : "—"}</td>
        <td style="text-align:center">${s.status === "OPEN" ? "Aberto" : "Fechado"}</td>
        <td style="text-align:right">${money(s.expectedBalance)}</td>
        <td style="text-align:right;font-weight:700">${money(s.closingBalance)}</td>
      </tr>`;
    }).join("");

    const itemRows = soldItems.map((it) => `
      <tr>
        <td>#${it.orderId.slice(-6).toUpperCase()}</td>
        <td>${it.productName}</td>
        <td style="text-align:center">${it.quantity}</td>
        <td style="text-align:right">${money(it.total)}</td>
        <td style="text-align:center">${new Date(it.createdAt).toLocaleString("pt-BR")}</td>
        <td>${it.sellerName}</td>
        <td>${it.paymentLabel}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/><title>Histórico de Caixa</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 32px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 3px solid #1e3a5f; padding-bottom: 16px; }
  .header h1 { font-size: 20px; font-weight: 900; text-transform: ; letter-spacing: 0.1em; }
  .meta { text-align: right; font-size: 10px; color: #64748b; }
  .summary-title { font-size: 13px; font-weight: 800; text-transform: ; letter-spacing: 0.08em; margin: 20px 0 10px; color: #1e3a5f; }
  .fin-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
  .fin-card { padding: 12px 14px; border-radius: 10px; border: 1px solid #e2e8f0; }
  .fin-card label { font-size: 9px; font-weight: 700; text-transform: ; letter-spacing: 0.1em; display: block; margin-bottom: 4px; color: #94a3b8; }
  .fin-card .val { font-size: 16px; font-weight: 900; font-family: monospace; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 10px 12px; text-align: left; font-size: 9px; font-weight: 700; text-transform: ; letter-spacing: 0.1em; color: #94a3b8; }
  td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  .total-row td { font-weight: 900; background: #f1f5f9; border-top: 2px solid #1e3a5f; }
  @media print { body { padding: 16px; } table { page-break-inside: auto; } tr { page-break-inside: avoid; } }
</style></head>
<body>
<div class="header">
  <div><h1>Histórico de Caixa</h1></div>
  <div class="meta"><strong>Período: ${periodLabel}</strong><br/>Gerado em: ${new Date().toLocaleString("pt-BR")}</div>
</div>

<p class="summary-title">Totais Financeiros</p>
<div class="fin-summary">
  <div class="fin-card"><label>Bruto</label><div class="val">${money(financeTotals.gross)}</div></div>
  <div class="fin-card"><label>Descontos</label><div class="val">- ${money(financeTotals.discount)}</div></div>
  <div class="fin-card"><label>Acréscimos/Taxas</label><div class="val">+ ${money(financeTotals.fee)}</div></div>
  <div class="fin-card"><label>Líquido</label><div class="val">${money(financeTotals.net)}</div></div>
</div>

<p class="summary-title">Balanço por Forma de Pagamento</p>
<table>
  <thead><tr><th>Forma de Pagamento</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>${paymentRows}
  <tr class="total-row"><td>TOTAL GERAL</td><td style="text-align:right">${money(grandTotal)}</td></tr>
  </tbody>
</table>

<p class="summary-title">Sessões de Caixa (${filtered.length})</p>
<table>
  <thead><tr><th>Aberto por</th><th>Fechado por</th><th style="text-align:center">Abertura</th><th style="text-align:center">Fechamento</th><th style="text-align:center">Status</th><th style="text-align:right">Esperado</th><th style="text-align:right">Contado</th></tr></thead>
  <tbody>${sessionRows}</tbody>
</table>

<p class="summary-title">Itens Vendidos (${soldItems.length})</p>
<table>
  <thead><tr><th>Pedido</th><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:right">Total</th><th style="text-align:center">Data</th><th>Operador</th><th>Pagamento</th></tr></thead>
  <tbody>${itemRows}</tbody>
</table>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
    setShowExportModal(false);
  }

  const sessionPag = usePagination(filtered, 15);
  const itemsPag = usePagination(filteredSoldItems, 15);

  const sessionColumns: Column<Session>[] = [
    { header: "Abertura", render: (s) => <span className="text-xs text-slate-600 whitespace-nowrap">{new Date(s.openedAt).toLocaleString("pt-BR")}</span> },
    {
      header: "Aberto por",
      render: (s) => (
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <User size={12} className="text-slate-400 shrink-0" /> {s.openedByName || s.operatorName || "—"}
        </span>
      ),
    },
    { header: "Fechado por", render: (s) => <span className="text-xs text-slate-500">{s.closedByName ?? "—"}</span> },
    {
      header: "Status",
      render: (s) => s.status === "OPEN"
        ? <Badge color="info" size="sm" icon={<Clock size={12} />}>Aberto</Badge>
        : <Badge color="success" size="sm" icon={<CheckCircle2 size={12} />}>Fechado</Badge>,
    },
    { header: "Valor inicial", render: (s) => <span className="text-xs tabular-nums text-slate-600 whitespace-nowrap">{money(s.openingBalance)}</span> },
    { header: "Contado", render: (s) => <span className="text-xs tabular-nums text-slate-600 whitespace-nowrap">{s.closingBalance != null ? money(s.closingBalance) : "—"}</span> },
    {
      header: "Diferença",
      render: (s) => {
        const diff = s.closingBalance != null && s.expectedBalance != null ? s.closingBalance - s.expectedBalance : null;
        return diff !== null ? (
          <span className={cn("text-xs font-semibold tabular-nums whitespace-nowrap", Math.abs(diff) < 0.01 ? "text-slate-400" : diff > 0 ? "text-emerald-700" : "text-red-600")}>
            {diff > 0 ? "+" : ""}{money(diff)}
          </span>
        ) : <span className="text-xs text-slate-400">—</span>;
      },
    },
    { header: "", render: () => <ChevronRight size={14} className="text-slate-300" /> },
  ];

  const itemColumns: Column<ReturnType<typeof computeSoldItems>[number]>[] = [
    { header: "Pedido", render: (it) => <span className="text-xs font-mono text-slate-500 whitespace-nowrap">#{it.orderId.slice(-6).toUpperCase()}</span> },
    { header: "Produto", render: (it) => <span className="text-xs font-medium text-slate-700">{it.productName}</span> },
    { header: "Qtd", render: (it) => <span className="text-xs text-slate-600">{it.quantity}</span> },
    { header: "Total", render: (it) => <span className="text-xs font-semibold tabular-nums text-slate-800 whitespace-nowrap">{money(it.total)}</span> },
    { header: "Data", render: (it) => <span className="text-xs text-slate-500 whitespace-nowrap">{new Date(it.createdAt).toLocaleString("pt-BR")}</span> },
    { header: "Operador", render: (it) => <span className="text-xs text-slate-500 whitespace-nowrap">{it.sellerName}</span> },
    { header: "Pagamento", render: (it) => <span className="text-xs text-slate-500 whitespace-nowrap">{it.paymentLabel}</span> },
  ];

  const periodOptions = [
    { value: "today", label: "Hoje" },
    { value: "week", label: "Semana" },
    { value: "month", label: "Mês" },
    { value: "year", label: "Ano" },
    { value: "all", label: "Tudo" },
    { value: "custom", label: "Livre", icon: <Calendar size={12} /> },
  ];

  const sessionDiff = detail ? (detail.closingBalance ?? 0) - (detail.expectedBalance ?? 0) : 0;

  return (
    <div className="space-y-4">
      <StatGrid cols={4}>
        <StatCard title="Total de sessões" value={counts.total} icon={Wallet} color="default" />
        <StatCard title="Caixas abertos" value={counts.open} icon={Clock} color="info" />
        <StatCard title="Caixas fechados" value={counts.closed} icon={CheckCircle2} color="success" />
        <StatCard title="Com diferença" value={counts.withDifference} icon={AlertTriangle} color="danger" />
      </StatGrid>

      <Tabs<"sessions" | "report"> items={HISTORY_TABS} value={mainTab} onChange={setMainTab} label="Histórico de caixa">
        {mainTab === "sessions" && (
          <div className="space-y-3">
            <FilterLine>
              <FilterLineSection grow>
                <FilterLineItem grow minWidth={180}>
                  <FilterLineSearch value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por operador..." aria-label="Buscar por operador" className="max-w-[280px]" />
                </FilterLineItem>
                <FilterLineItem fullOnMobile={false}>
                  <FilterLineSegmented
                    value={statusFilter}
                    onChange={(v) => setStatusFilter(v as "all" | "open" | "closed")}
                    options={[
                      { value: "all", label: "Todos" },
                      { value: "open", label: "Abertos" },
                      { value: "closed", label: "Fechados" },
                    ]}
                  />
                </FilterLineItem>
                <span className="text-xs text-slate-500">{filtered.length} sess{filtered.length === 1 ? "ão" : "ões"}</span>
              </FilterLineSection>
              <FilterLineSection align="right">
                <FilterLineItem fullOnMobile={false}>
                  <Button variant="outline" size="sm" iconLeft={<Download size={14} />} onClick={openExportModal}>Exportar</Button>
                </FilterLineItem>
              </FilterLineSection>
            </FilterLine>

            <ContentCard padding="none">
              <GridTable
                noDesktopCard
                data={sessionPag.paginatedData}
                columns={sessionColumns}
                keyExtractor={(s) => s.id}
                isLoading={loading}
                onRowClick={(s) => setDetail(s)}
                emptyMessage={<EmptyState icon={Wallet} title="Nenhuma sessão de caixa encontrada" description="Ajuste a busca ou o status para ver outras sessões." />}
                pagination={{
                  total: filtered.length,
                  page: sessionPag.page,
                  pageSize: sessionPag.pageSize,
                  onPageChange: sessionPag.setPage,
                  onPageSizeChange: sessionPag.setPageSize,
                }}
              />
            </ContentCard>
          </div>
        )}

        {mainTab === "report" && (
          <div className="space-y-3">
            {/* Filtro de período */}
            <FilterLine>
              <FilterLineSection grow>
                <FilterLineItem fullOnMobile={false}>
                  <FilterLineSegmented
                    value={periodPreset}
                    onChange={(v) => (v === "custom" ? setPeriodPreset("custom") : applyPeriodPreset(v as PeriodPreset))}
                    options={periodOptions}
                  />
                </FilterLineItem>
                {(periodPreset === "month" || periodPreset === "year") && (
                  <FilterLineItem fullOnMobile={false}>
                    <div className="flex items-center gap-1">
                      <IconButton variant="outline" size="sm" aria-label="Período anterior" onClick={() => navigatePeriod(-1)}><ChevronLeft size={14} /></IconButton>
                      <span className="min-w-[130px] text-center text-xs font-medium text-slate-700">
                        {periodPreset === "year" ? navYear : `${MONTHS[navMonth]} ${navYear}`}
                      </span>
                      <IconButton variant="outline" size="sm" aria-label="Próximo período" onClick={() => navigatePeriod(1)}><ChevronRight size={14} /></IconButton>
                    </div>
                  </FilterLineItem>
                )}
                {periodPreset === "custom" && (
                  <FilterLineItem minWidth={260}>
                    <FilterLineDateRange from={dateFrom || null} to={dateTo || null} onFromChange={(v) => setDateFrom(v ?? "")} onToChange={(v) => setDateTo(v ?? "")} />
                  </FilterLineItem>
                )}
                {loading && <Loader2 size={16} className="animate-spin text-slate-400 shrink-0" />}
              </FilterLineSection>
              <FilterLineSection align="right">
                <FilterLineItem fullOnMobile={false}>
                  <Button variant="outline" size="sm" iconLeft={<Download size={14} />} onClick={openExportModal}>Exportar</Button>
                </FilterLineItem>
              </FilterLineSection>
            </FilterLine>

            {sessionsForReport.length === 0 ? (
              <ContentCard>
                <EmptyState icon={Wallet} title="Nenhuma sessão de caixa nesse período" description="Escolha outro período para ver o balanço." />
              </ContentCard>
            ) : (
              <>
                {/* Cards por forma de pagamento */}
                <StatGrid cols={4}>
                  {paymentByMethod.map((seg) => (
                    <StatCard key={seg.method} title={methodLabel(seg.method)} value={money(seg.amount)} icon={Wallet} color="default" />
                  ))}
                  <StatCard title="Total do período" value={money(grandTotal)} icon={DollarSign} color="info" />
                </StatGrid>

                {/* Gráficos */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <PanelCard title="Por forma de pagamento" icon={PieChartIcon}>
                    <div className="p-3">
                      {paymentByMethod.length > 0 ? (
                        <div className="h-64 min-w-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={paymentByMethod.map((s) => ({ name: methodLabel(s.method), value: s.amount, method: s.method }))}
                                dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}
                              >
                                {paymentByMethod.map((s, i) => (
                                  <Cell key={i} fill={PM_COLOR[s.method] ?? "#64748B"} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: number) => money(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 11 }} />
                              <Legend iconType="circle" iconSize={7} formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-center text-xs text-slate-500 py-16">Sem vendas no período</p>
                      )}
                    </div>
                  </PanelCard>

                  <PanelCard title="Evolução diária" icon={BarChart3}>
                    <div className="p-3">
                      {salesByDay.length > 0 ? (
                        <div className="h-64 min-w-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={salesByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                              <CartesianGrid vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} interval="preserveStartEnd"
                                tickFormatter={(v: string) => new Date(v + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} width={48} />
                              <Tooltip
                                cursor={{ fill: "#f1f5f9" }}
                                formatter={(v: number) => money(v)}
                                labelFormatter={(v: string) => new Date(v + "T00:00:00").toLocaleDateString("pt-BR")}
                                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 11 }}
                              />
                              <Bar dataKey="total" radius={[3, 3, 0, 0]} fill="#2563eb" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-center text-xs text-slate-500 py-16">Sem vendas no período</p>
                      )}
                    </div>
                  </PanelCard>
                </div>

                {/* Tabela de itens vendidos */}
                <PanelCard
                  title={`Itens vendidos (${filteredSoldItems.length})`}
                  icon={ListOrdered}
                  action={availablePaymentMethods.length > 0 ? (
                    <FilterLineSegmented
                      size="sm"
                      value={itemsPaymentFilter}
                      onChange={(v) => setItemsPaymentFilter(String(v))}
                      options={[
                        { value: "all", label: "Todos" },
                        ...availablePaymentMethods.map((m) => ({ value: m, label: PM_LABEL[m] ?? m })),
                      ]}
                    />
                  ) : undefined}
                >
                  <GridTable
                    noDesktopCard
                    data={itemsPag.paginatedData}
                    columns={itemColumns}
                    keyExtractor={(it) => `${it.orderId}-${it.productName}-${it.createdAt}-${it.total}`}
                    emptyMessage={<EmptyState icon={ListOrdered} title="Nenhum item vendido no período" />}
                    pagination={{
                      total: filteredSoldItems.length,
                      page: itemsPag.page,
                      pageSize: itemsPag.pageSize,
                      onPageChange: itemsPag.setPage,
                      onPageSizeChange: itemsPag.setPageSize,
                    }}
                  />
                </PanelCard>
              </>
            )}
          </div>
        )}
      </Tabs>

      {/* Modal de exportação */}
      <Modal
        isOpen={showExportModal}
        onClose={() => { if (!exporting) setShowExportModal(false); }}
        title="Exportar Relatório"
        size="sm"
        footer={
          <ModalFooter>
            <Button
              variant="outline"
              loading={exporting}
              iconLeft={<FileSpreadsheet size={14} className="text-emerald-600" />}
              onClick={exportSessionsToExcel}
              disabled={exporting}
            >
              Excel (.xlsx)
            </Button>
            <Button
              variant="outline"
              loading={exporting}
              iconLeft={<FileText size={14} className="text-red-600" />}
              onClick={exportSessionsToPDF}
              disabled={exporting}
            >
              PDF
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4 p-1">
          <p className="text-[11px] text-slate-500">Escolha o período que deseja exportar.</p>

          <FilterLineSegmented
            value={exportPreset === "custom" ? "custom" : exportPreset}
            onChange={(v) => applyExportPreset(v as PeriodPreset)}
            options={[
              { value: "all", label: "Tudo" },
              { value: "month", label: "Mês" },
              { value: "year", label: "Ano" },
              { value: "custom", label: "Livre", icon: <Calendar size={12} /> },
            ]}
          />

          {(exportPreset === "month" || exportPreset === "year") && (
            <div className="flex items-center gap-1">
              <IconButton variant="outline" size="sm" aria-label="Período anterior" onClick={() => navigateExportPeriod(-1)}><ChevronLeft size={14} /></IconButton>
              <span className="min-w-[140px] text-center text-xs font-medium text-slate-700">
                {exportPreset === "year" ? exportNavYear : `${MONTHS[exportNavMonth]} ${exportNavYear}`}
              </span>
              <IconButton variant="outline" size="sm" aria-label="Próximo período" onClick={() => navigateExportPeriod(1)}><ChevronRight size={14} /></IconButton>
            </div>
          )}

          {exportPreset === "custom" && (
            <FilterLineDateRange
              from={exportFrom || null}
              to={exportTo || null}
              onFromChange={(v) => { setExportFrom(v ?? ""); setExportTo((prev) => prev || (v ?? "")); }}
              onToChange={(v) => setExportTo(v ?? "")}
            />
          )}
        </div>
      </Modal>

      {/* Detalhe da sessão */}
      <Modal
        isOpen={!!detail}
        onClose={() => setDetail(null)}
        title="Sessão de Caixa"
        size="md"
        footer={detail ? (
          <ModalFooter>
            {detail.status === "CLOSED" && (
              <Button variant="outline" onClick={() => printSessionReceipt(detail)} iconLeft={<Printer size={14} />} title="Imprimir via térmica">Imprimir</Button>
            )}
            <Button variant="primary" onClick={() => goToReportForSession(detail)} iconRight={<ChevronRight size={14} />}>Ver relatório de vendas</Button>
          </ModalFooter>
        ) : undefined}
      >
        {detail && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <p className="text-[11px] text-slate-500 mb-1">Aberto por</p>
                <p className="text-xs font-medium text-slate-800">{detail.openedByName || detail.operatorName || "—"}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1"><Calendar size={10} /> {new Date(detail.openedAt).toLocaleString("pt-BR")}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <p className="text-[11px] text-slate-500 mb-1">Fechado por</p>
                <p className="text-xs font-medium text-slate-800">{detail.closedByName ?? "Ainda aberto"}</p>
                {detail.closedAt && (
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1"><Calendar size={10} /> {new Date(detail.closedAt).toLocaleString("pt-BR")}</p>
                )}
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Valor inicial</span>
                <span className="tabular-nums font-medium text-slate-800">{money(detail.openingBalance)}</span>
              </div>
              {detail.status === "CLOSED" && (
                <>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Vendas em dinheiro</span>
                    <span className="tabular-nums font-medium text-slate-800">
                      {money(Math.round(((detail.expectedBalance ?? 0) - detail.openingBalance) * 100) / 100)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 pt-1.5 border-t border-slate-200">
                    <span>Esperado</span>
                    <span className="tabular-nums font-medium text-slate-800">{money(detail.expectedBalance)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Contado</span>
                    <span className="tabular-nums font-medium text-slate-800">{money(detail.closingBalance)}</span>
                  </div>
                  <div className="flex justify-between text-[13px] font-medium pt-1.5 border-t border-slate-200">
                    <span className="text-slate-800">Diferença</span>
                    <span className={cn("tabular-nums", Math.abs(sessionDiff) < 0.01 ? "text-slate-500" : sessionDiff > 0 ? "text-emerald-700" : "text-red-600")}>
                      {sessionDiff > 0 ? "+" : ""}{money(sessionDiff)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {detail.status === "CLOSED" && detail.paymentBreakdown && (
              <PanelCard title="Por forma de pagamento">
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead className="bg-zinc-50 text-slate-500 text-[11px] font-medium">
                      <tr>
                        <td className="px-3 py-2">Forma</td>
                        <td className="px-3 py-2 text-right">Esperado</td>
                        <td className="px-3 py-2 text-right">Contado</td>
                        <td className="px-3 py-2 text-right">Diferença</td>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(detail.paymentBreakdown).map(([method, entry]) => (
                        <tr key={method} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-700">{PM_LABEL[method] ?? method}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">{money(entry.expected)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                            {entry.counted !== undefined ? money(entry.counted) : "—"}
                          </td>
                          <td className={cn(
                            "px-3 py-2 text-right tabular-nums font-semibold",
                            entry.difference === undefined ? "text-slate-300" :
                            Math.abs(entry.difference) < 0.01 ? "text-slate-500" : entry.difference > 0 ? "text-blue-600" : "text-red-600",
                          )}>
                            {entry.difference !== undefined ? money(entry.difference) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PanelCard>
            )}

            {detail.notes && (
              <div className="text-[11px] text-slate-500"><span className="font-medium text-slate-700">Observações:</span> {detail.notes}</div>
            )}

            <div className="bg-slate-50 rounded-lg border border-slate-100 p-3">
              <p className="text-[11px] text-slate-500 mb-1">Vendas nesta sessão</p>
              <p className="text-sm font-semibold text-slate-800">
                {new Set((detail.movements || []).filter((m) => m.type.startsWith("PAYMENT_")).map((m) => m.orderId)).size}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
