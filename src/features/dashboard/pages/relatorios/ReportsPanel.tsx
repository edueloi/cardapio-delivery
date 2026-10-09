import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3, TrendingUp, Calendar, Download, LayoutDashboard, Boxes, Loader2,
  ShoppingBag, CreditCard, Banknote, QrCode,
  Receipt, Package, Clock, ArrowUpRight, Timer, Truck, AlertTriangle,
} from "lucide-react";
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard,
  Button, EmptyState, PanelCard, Tabs, Badge,
  FilterLine, FilterLineSection, FilterLineItem, FilterLineSegmented, FilterLineDateRange,
} from "../../../../components";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { apiFetch } from "../../../../lib/api";
import type { Tenant } from "../../../../types";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

interface ReportSummary {
  totalRevenue: number;
  totalOrders: number;
  averageTicket: number;
  totalFees: number;
  totalFeesAbsorbed: number;
  netRevenue: number;
  byPaymentMethod: Record<string, { count: number; total: number; fees: number }>;
  byOrderType: Record<string, { count: number; total: number }>;
  topProducts: { id: string; name: string; qty: number; total: number }[];
  hourly: { hour: number; total: number }[];
  dateFrom: string;
  dateTo: string;
}

interface DailyData {
  date: string;
  total: number;
  count: number;
}

interface MonthlyData {
  month: number;
  total: number;
  count: number;
}

interface TopInventoryItem {
  id: string;
  name: string;
  unit: string | null;
  quantity: number;
}

interface SlowestOrder {
  id: string;
  customerName: string;
  counterTicketNumber: number | null;
  orderType: string;
  createdAt: string;
  readyAt: string;
  prepMinutes: number;
  deliveryMinutes: number | null;
}

interface TimingReport {
  avgPrepMinutes: number;
  avgDeliveryMinutes: number;
  ordersWithTiming: number;
  hourly: { hour: number; avgPrepMinutes: number; count: number }[];
  slowest: SlowestOrder[];
}

const REPORT_TABS = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "timing", label: "Tempos", icon: Timer },
  { id: "products", label: "Produtos e estoque", icon: Boxes },
] as const;
type ReportTabId = (typeof REPORT_TABS)[number]["id"];

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "7 dias" },
  { value: "month", label: "Este mês" },
  { value: "year", label: "Este ano" },
  { value: "custom", label: "Livre", icon: <Calendar size={12} /> },
];

// Gráfico de barras padrão (eixos sem linha, fonte 11, grade horizontal, azul).
function BarsChart({ data, format, color = "#2563eb" }: {
  data: { label: string; value: number }[];
  format: (v: number) => string;
  color?: string;
}) {
  return (
    <div className="h-56 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} interval="preserveStartEnd" />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} width={48} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))} />
          <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(v: number) => [format(v), ""]} separator="" contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }} />
          <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const PAYMENT_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  CASH:   { label: "Dinheiro", icon: Banknote,    color: "bg-green-500" },
  PIX:    { label: "PIX",      icon: QrCode,      color: "bg-violet-500" },
  CREDIT: { label: "Crédito",  icon: CreditCard,  color: "bg-orange-500" },
  DEBIT:  { label: "Débito",   icon: CreditCard,  color: "bg-cyan-500" },
  VR:     { label: "VR",       icon: Receipt,     color: "bg-emerald-500" },
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  DELIVERY: "Delivery",
  PICKUP: "Retirada",
  DINE_IN: "Mesa/Comanda",
  TAKEAWAY: "Balcão",
};

interface ReportsPanelProps {
  slug: string;
  tenant: Tenant;
}

export default function ReportsPanel({ slug, tenant }: ReportsPanelProps) {
  const [period, setPeriod] = useState<"today" | "week" | "month" | "year" | "custom">("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [topInventory, setTopInventory] = useState<TopInventoryItem[]>([]);
  const [timing, setTiming] = useState<TimingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTabId>("overview");

  const buildDates = useCallback(() => {
    const now = new Date();
    if (period === "today") {
      const from = new Date(now); from.setHours(0, 0, 0, 0);
      const to = new Date(now); to.setHours(23, 59, 59, 999);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    if (period === "week") {
      const from = new Date(now); from.setDate(from.getDate() - 6); from.setHours(0, 0, 0, 0);
      const to = new Date(now); to.setHours(23, 59, 59, 999);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    if (period === "month") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now); to.setHours(23, 59, 59, 999);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    if (period === "year") {
      const from = new Date(now.getFullYear(), 0, 1);
      const to = new Date(now); to.setHours(23, 59, 59, 999);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    return { from: customFrom ? new Date(customFrom).toISOString() : "", to: customTo ? new Date(customTo + "T23:59:59").toISOString() : "" };
  }, [period, customFrom, customTo]);

  const fetchReport = useCallback(async () => {
    const { from, to } = buildDates();
    if (!from || !to) return;
    setLoading(true);
    try {
      const [summRes, dailyRes, monthlyRes, topInvRes, timingRes] = await Promise.all([
        apiFetch(`/api/tenants/${slug}/reports/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
        apiFetch(`/api/tenants/${slug}/reports/daily?days=${period === "month" ? 30 : period === "week" ? 7 : 1}`),
        apiFetch(`/api/tenants/${slug}/reports/monthly?year=${new Date().getFullYear()}`),
        apiFetch(`/api/tenants/${slug}/reports/top-inventory?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
        apiFetch(`/api/tenants/${slug}/reports/timing?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
      ]);
      if (summRes.ok) setSummary(await summRes.json());
      if (dailyRes.ok) setDailyData(await dailyRes.json());
      if (monthlyRes.ok) setMonthlyData(await monthlyRes.json());
      if (topInvRes.ok) setTopInventory(await topInvRes.json());
      if (timingRes.ok) setTiming(await timingRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [slug, buildDates, period]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const maxTopInventoryQty = topInventory.length > 0 ? Math.max(...topInventory.map((i) => i.quantity), 1) : 1;

  const fmtMinutes = (m: number) => {
    if (m < 1) return "< 1 min";
    if (m < 60) return `${Math.round(m)} min`;
    const h = Math.floor(m / 60);
    const rest = Math.round(m % 60);
    return `${h}h${rest > 0 ? ` ${rest}min` : ""}`;
  };

  const exportCSV = () => {
    if (!summary) return;
    const rows = [
      ["Produto", "Quantidade", "Receita"],
      ...summary.topProducts.map((p) => [p.name, p.qty, p.total.toFixed(2)]),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bar = (pct: number, color: string) => (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );

  const hasTiming = !!timing && timing.ordersWithTiming > 0;
  const tabs = REPORT_TABS.map((t) => (t.id === "timing" && !hasTiming ? { ...t, disabled: true } : t));

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle
          title="Relatórios"
          description="Análise de vendas e desempenho"
          icon={BarChart3}
          action={
            <Button variant="outline" size="sm" iconLeft={<Download size={14} />} onClick={exportCSV}>
              Exportar CSV
            </Button>
          }
        />

        <FilterLine>
          <FilterLineSection grow>
            <FilterLineItem fullOnMobile={false}>
              <FilterLineSegmented
                value={period}
                onChange={(v) => setPeriod(v as typeof period)}
                options={PERIOD_OPTIONS}
              />
            </FilterLineItem>
            {period === "custom" && (
              <>
                <FilterLineItem minWidth={260}>
                  <FilterLineDateRange
                    from={customFrom || null}
                    to={customTo || null}
                    onFromChange={(v) => setCustomFrom(v ?? "")}
                    onToChange={(v) => setCustomTo(v ?? "")}
                  />
                </FilterLineItem>
                <FilterLineItem fullOnMobile={false}>
                  <Button variant="primary" size="sm" onClick={fetchReport}>Buscar</Button>
                </FilterLineItem>
              </>
            )}
          </FilterLineSection>
        </FilterLine>

        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin" />Carregando relatório…
          </div>
        ) : !summary ? (
          <ContentCard>
            <EmptyState title="Sem dados" description="Selecione um período para visualizar o relatório." icon={BarChart3} />
          </ContentCard>
        ) : summary.totalOrders === 0 ? (
          <ContentCard>
            <EmptyState
              title="Nenhuma venda nesse período"
              description="Não houve pedidos concluídos no período selecionado. Tente escolher outro período ou aguarde as primeiras vendas chegarem."
              icon={BarChart3}
            />
          </ContentCard>
        ) : (
          <>
            <StatGrid cols={4}>
              <StatCard title="Receita Total" value={fmt(summary.totalRevenue)} icon={TrendingUp} color="success" />
              <StatCard title="Pedidos" value={summary.totalOrders} icon={ShoppingBag} color="info" />
              <StatCard title="Ticket Médio" value={fmt(summary.averageTicket)} icon={ArrowUpRight} color="default" />
              <StatCard title="Produtos Vendidos" value={summary.topProducts.reduce((s, p) => s + p.qty, 0)} icon={Package} color="warning" />
            </StatGrid>

            {summary.totalFees > 0 && (
              <StatGrid cols={3}>
                <StatCard title="Taxa de Maquininha (custo)" value={fmt(summary.totalFees)} icon={CreditCard} color="warning" />
                <StatCard title="Absorvida pela Loja" value={fmt(summary.totalFeesAbsorbed)} icon={ArrowUpRight} color="danger" />
                <StatCard title="Receita Líquida" value={fmt(summary.netRevenue)} icon={TrendingUp} color="success" />
              </StatGrid>
            )}

            <Tabs<ReportTabId> items={tabs} value={activeTab} onChange={setActiveTab} label="Seções do relatório">
              {activeTab === "overview" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <PanelCard title="Receita por pagamento">
                      <div className="space-y-3 p-3">
                        {Object.entries(summary.byPaymentMethod)
                          .sort((a, b) => b[1].total - a[1].total)
                          .map(([method, data]) => {
                            const meta = PAYMENT_LABELS[method] || { label: method, icon: CreditCard, color: "bg-slate-400" };
                            const pct = summary.totalRevenue > 0 ? (data.total / summary.totalRevenue) * 100 : 0;
                            return (
                              <div key={method}>
                                <div className="flex items-center justify-between mb-1 gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${meta.color}`} />
                                    <span className="text-xs font-medium text-slate-700">{meta.label}</span>
                                    <span className="text-[11px] text-slate-500">({data.count} pedidos)</span>
                                  </div>
                                  <span className="text-xs font-semibold tabular-nums text-slate-800">{fmt(data.total)}</span>
                                </div>
                                {bar(pct, meta.color)}
                                {data.fees > 0 && (
                                  <p className="text-[11px] text-amber-600 font-medium mt-1">Taxa maquininha: {fmt(data.fees)}</p>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </PanelCard>

                    <PanelCard title="Por tipo de pedido">
                      <div className="space-y-3 p-3">
                        {Object.entries(summary.byOrderType)
                          .sort((a, b) => b[1].total - a[1].total)
                          .map(([type, data]) => {
                            const pct = summary.totalRevenue > 0 ? (data.total / summary.totalRevenue) * 100 : 0;
                            return (
                              <div key={type}>
                                <div className="flex items-center justify-between mb-1 gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-2 h-2 rounded-full shrink-0 bg-blue-600" />
                                    <span className="text-xs font-medium text-slate-700">{ORDER_TYPE_LABELS[type] || type}</span>
                                    <span className="text-[11px] text-slate-500">({data.count} pedidos)</span>
                                  </div>
                                  <span className="text-xs font-semibold tabular-nums text-slate-800">{fmt(data.total)}</span>
                                </div>
                                {bar(pct, "bg-blue-600")}
                              </div>
                            );
                          })}
                      </div>
                    </PanelCard>
                  </div>

                  {period === "year" && (
                    <PanelCard title={`Receita por mês — ${new Date().getFullYear()}`}>
                      <div className="p-3">
                        <BarsChart
                          data={monthlyData.map((m) => ({ label: MONTH_LABELS[m.month], value: m.total }))}
                          format={fmt}
                        />
                      </div>
                    </PanelCard>
                  )}

                  {dailyData.length > 1 && (
                    <PanelCard title="Receita diária">
                      <div className="p-3">
                        <BarsChart
                          data={dailyData.map((d) => ({
                            label: new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
                            value: d.total,
                          }))}
                          format={fmt}
                        />
                      </div>
                    </PanelCard>
                  )}

                  {period === "today" && summary.hourly.some((h) => h.total > 0) && (
                    <PanelCard title="Distribuição por hora" icon={Clock}>
                      <div className="p-3">
                        <BarsChart
                          data={summary.hourly.map((h) => ({ label: `${h.hour}h`, value: h.total }))}
                          format={fmt}
                        />
                      </div>
                    </PanelCard>
                  )}
                </div>
              )}

              {activeTab === "timing" && timing && hasTiming && (
                <div className="space-y-3">
                  <StatGrid cols={3}>
                    <StatCard title="Tempo Médio de Preparo" value={fmtMinutes(timing.avgPrepMinutes)} icon={Timer} color="warning" />
                    <StatCard title="Tempo Médio de Entrega" value={timing.avgDeliveryMinutes > 0 ? fmtMinutes(timing.avgDeliveryMinutes) : "—"} icon={Truck} color="info" />
                    <StatCard title="Pedidos com Tempo Registrado" value={timing.ordersWithTiming} icon={Clock} color="default" />
                  </StatGrid>

                  <PanelCard title="Tempo médio de preparo por hora" icon={Timer}>
                    <div className="p-3">
                      <BarsChart
                        data={timing.hourly.map((h) => ({ label: `${h.hour}h`, value: h.count > 0 ? Math.round(h.avgPrepMinutes * 10) / 10 : 0 }))}
                        format={fmtMinutes}
                      />
                    </div>
                  </PanelCard>

                  {timing.slowest.length > 0 && (
                    <PanelCard title="Pedidos mais demorados no preparo" icon={AlertTriangle}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-zinc-50 text-left text-[11px] font-medium text-slate-500">
                              <th className="px-3 py-2 font-medium">Pedido</th>
                              <th className="px-3 py-2 font-medium">Data / Hora</th>
                              <th className="px-3 py-2 font-medium">Tipo</th>
                              <th className="px-3 py-2 font-medium text-right">Preparo</th>
                              <th className="px-3 py-2 font-medium text-right">Entrega</th>
                            </tr>
                          </thead>
                          <tbody>
                            {timing.slowest.map((o) => (
                              <tr key={o.id} className="border-t border-slate-100">
                                <td className="px-3 py-2 font-medium text-slate-700">
                                  {o.counterTicketNumber != null ? `#${String(o.counterTicketNumber).padStart(2, "0")}` : o.customerName}
                                </td>
                                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                                  {new Date(o.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                </td>
                                <td className="px-3 py-2 text-slate-500">{ORDER_TYPE_LABELS[o.orderType] || o.orderType}</td>
                                <td className="px-3 py-2 text-right"><Badge color="warning" size="sm">{fmtMinutes(o.prepMinutes)}</Badge></td>
                                <td className="px-3 py-2 text-right text-slate-500">
                                  {o.deliveryMinutes != null ? fmtMinutes(o.deliveryMinutes) : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </PanelCard>
                  )}
                </div>
              )}

              {activeTab === "products" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <PanelCard title="Produtos mais vendidos" icon={ShoppingBag}>
                    {summary.topProducts.length === 0 ? (
                      <p className="p-3 text-xs text-slate-500">Nenhum produto vendido no período.</p>
                    ) : (
                      <div className="space-y-3 p-3">
                        {summary.topProducts.map((p, i) => {
                          const maxTotal = summary.topProducts[0]?.total || 1;
                          const pct = (p.total / maxTotal) * 100;
                          return (
                            <div key={p.id} className="flex items-center gap-3">
                              <span className="w-6 text-[11px] font-medium text-slate-500 text-center shrink-0">#{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs font-medium text-slate-800 truncate">{p.name}</span>
                                  <div className="flex items-center gap-3 shrink-0 ml-2">
                                    <span className="text-[11px] text-slate-500">{p.qty}x</span>
                                    <span className="text-xs font-semibold tabular-nums text-blue-700">{fmt(p.total)}</span>
                                  </div>
                                </div>
                                {bar(pct, "bg-blue-600")}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </PanelCard>

                  <PanelCard title="Estoque que mais sai" icon={Package}>
                    {topInventory.length === 0 ? (
                      <p className="p-3 text-xs text-slate-500">Nenhuma saída de estoque no período.</p>
                    ) : (
                      <div className="space-y-3 p-3">
                        {topInventory.map((item, i) => {
                          const pct = (item.quantity / maxTopInventoryQty) * 100;
                          return (
                            <div key={item.id} className="flex items-center gap-3">
                              <span className="w-6 text-[11px] font-medium text-slate-500 text-center shrink-0">#{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs font-medium text-slate-800 truncate">{item.name}</span>
                                  <span className="text-xs font-semibold tabular-nums text-slate-700 shrink-0 ml-2">
                                    {item.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {item.unit || "un"}
                                  </span>
                                </div>
                                {bar(pct, "bg-slate-500")}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </PanelCard>
                </div>
              )}
            </Tabs>
          </>
        )}
      </div>
    </PageWrapper>
  );
}
