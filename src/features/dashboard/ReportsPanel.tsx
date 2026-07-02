import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3, TrendingUp, Calendar, Download,
  ShoppingBag, CreditCard, Banknote, QrCode,
  Receipt, Package, Clock, ArrowUpRight,
} from "lucide-react";
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard,
  Button, EmptyState,
} from "../../components";
import type { Tenant } from "../../types";

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
  const [period, setPeriod] = useState<"today" | "week" | "month" | "custom">("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(false);

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
    return { from: customFrom ? new Date(customFrom).toISOString() : "", to: customTo ? new Date(customTo + "T23:59:59").toISOString() : "" };
  }, [period, customFrom, customTo]);

  const fetchReport = useCallback(async () => {
    const { from, to } = buildDates();
    if (!from || !to) return;
    setLoading(true);
    try {
      const [summRes, dailyRes] = await Promise.all([
        fetch(`/api/tenants/${slug}/reports/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        }),
        fetch(`/api/tenants/${slug}/reports/daily?days=${period === "month" ? 30 : period === "week" ? 7 : 1}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        }),
      ]);
      if (summRes.ok) setSummary(await summRes.json());
      if (dailyRes.ok) setDailyData(await dailyRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [slug, buildDates, period]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const maxDailyTotal = dailyData.length > 0 ? Math.max(...dailyData.map((d) => d.total)) : 1;
  const maxHourlyTotal = summary ? Math.max(...summary.hourly.map((h) => h.total), 1) : 1;

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

  return (
    <PageWrapper>
      <SectionTitle
        title="Relatórios"
        description="Análise de vendas e desempenho"
        icon={BarChart3}
        action={
          <Button variant="outline" size="sm" iconLeft={<Download className="w-4 h-4" />} onClick={exportCSV}>
            Exportar CSV
          </Button>
        }
        className="mb-6"
      />

      {/* Period selector */}
      <ContentCard className="mb-6">
        <div className="flex flex-wrap gap-2 items-center">
          {(["today", "week", "month", "custom"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                period === p ? "bg-[#0D1B3E] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {p === "today" ? "Hoje" : p === "week" ? "7 Dias" : p === "month" ? "Este Mês" : "Personalizado"}
            </button>
          ))}

          {period === "custom" && (
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-slate-200 rounded-xl py-2 px-3 text-sm focus:border-[#C9A227] outline-none"
              />
              <span className="text-slate-400 text-sm">até</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border border-slate-200 rounded-xl py-2 px-3 text-sm focus:border-[#C9A227] outline-none"
              />
              <Button variant="primary" size="sm" onClick={fetchReport}>Buscar</Button>
            </div>
          )}
        </div>
      </ContentCard>

      {loading ? (
        <div className="flex justify-center py-20 opacity-30">
          <div className="w-10 h-10 border-4 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !summary ? (
        <EmptyState title="Sem dados" description="Selecione um período para visualizar o relatório." icon={BarChart3} />
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <StatGrid cols={4}>
            <StatCard title="Receita Total" value={fmt(summary.totalRevenue)} icon={TrendingUp} color="success" delay={0} />
            <StatCard title="Pedidos" value={summary.totalOrders} icon={ShoppingBag} color="info" delay={0.1} />
            <StatCard title="Ticket Médio" value={fmt(summary.averageTicket)} icon={ArrowUpRight} color="default" delay={0.2} />
            <StatCard title="Produtos Vendidos" value={summary.topProducts.reduce((s, p) => s + p.qty, 0)} icon={Package} color="warning" delay={0.3} />
          </StatGrid>

          {summary.totalFees > 0 && (
            <StatGrid cols={3}>
              <StatCard title="Taxa de Maquininha (custo)" value={fmt(summary.totalFees)} icon={CreditCard} color="warning" delay={0} />
              <StatCard title="Absorvida pela Loja" value={fmt(summary.totalFeesAbsorbed)} icon={ArrowUpRight} color="danger" delay={0.1} />
              <StatCard title="Receita Líquida" value={fmt(summary.netRevenue)} icon={TrendingUp} color="success" delay={0.2} />
            </StatGrid>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment method breakdown */}
            <ContentCard>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 mb-4">
                Receita por Pagamento
              </h3>
              <div className="space-y-3">
                {Object.entries(summary.byPaymentMethod)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([method, data]) => {
                    const meta = PAYMENT_LABELS[method] || { label: method, icon: CreditCard, color: "bg-slate-400" };
                    const pct = summary.totalRevenue > 0 ? (data.total / summary.totalRevenue) * 100 : 0;
                    return (
                      <div key={method}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${meta.color}`} />
                            <span className="text-sm font-bold text-slate-700">{meta.label}</span>
                            <span className="text-[10px] text-slate-400">({data.count} pedidos)</span>
                          </div>
                          <span className="text-sm font-black text-slate-800">{fmt(data.total)}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${meta.color} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {data.fees > 0 && (
                          <p className="text-[10px] text-amber-500 font-bold mt-1">Taxa maquininha: {fmt(data.fees)}</p>
                        )}
                      </div>
                    );
                  })}
              </div>
            </ContentCard>

            {/* Order type breakdown */}
            <ContentCard>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 mb-4">
                Por Tipo de Pedido
              </h3>
              <div className="space-y-3">
                {Object.entries(summary.byOrderType)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([type, data]) => {
                    const pct = summary.totalRevenue > 0 ? (data.total / summary.totalRevenue) * 100 : 0;
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#0D1B3E]" />
                            <span className="text-sm font-bold text-slate-700">{ORDER_TYPE_LABELS[type] || type}</span>
                            <span className="text-[10px] text-slate-400">({data.count} pedidos)</span>
                          </div>
                          <span className="text-sm font-black text-slate-800">{fmt(data.total)}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#0D1B3E] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </ContentCard>
          </div>

          {/* Daily chart */}
          {dailyData.length > 1 && (
            <ContentCard>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 mb-4">
                Receita Diária
              </h3>
              <div className="flex items-end gap-1 h-32 overflow-x-auto pb-2">
                {dailyData.map((d) => {
                  const pct = maxDailyTotal > 0 ? (d.total / maxDailyTotal) * 100 : 0;
                  return (
                    <div key={d.date} className="flex flex-col items-center gap-1 min-w-[32px] flex-1 group relative">
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-black px-2 py-0.5 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {fmt(d.total)}
                      </div>
                      <div
                        className="w-full rounded-t-lg bg-[#C9A227] hover:bg-[#E8B93A] transition-colors min-h-[4px]"
                        style={{ height: `${Math.max(4, pct)}%` }}
                      />
                      <span className="text-[8px] text-slate-400 font-bold">
                        {new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ContentCard>
          )}

          {/* Hourly distribution (today only) */}
          {period === "today" && summary.hourly.some((h) => h.total > 0) && (
            <ContentCard>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Distribuição por Hora
              </h3>
              <div className="flex items-end gap-1 h-24">
                {summary.hourly.map((h) => {
                  const pct = maxHourlyTotal > 0 ? (h.total / maxHourlyTotal) * 100 : 0;
                  return (
                    <div key={h.hour} className="flex flex-col items-center gap-1 flex-1 group relative">
                      {h.total > 0 && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          {fmt(h.total)}
                        </div>
                      )}
                      <div
                        className={`w-full rounded-t-md min-h-[2px] transition-colors ${h.total > 0 ? "bg-[#0D1B3E] hover:bg-[#1a3068]" : "bg-slate-100"}`}
                        style={{ height: `${Math.max(2, pct)}%` }}
                      />
                      <span className="text-[7px] text-slate-300 font-bold">{h.hour}h</span>
                    </div>
                  );
                })}
              </div>
            </ContentCard>
          )}

          {/* Top products */}
          {summary.topProducts.length > 0 && (
            <ContentCard>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 mb-4">
                Produtos Mais Vendidos
              </h3>
              <div className="space-y-3">
                {summary.topProducts.map((p, i) => {
                  const maxTotal = summary.topProducts[0]?.total || 1;
                  const pct = (p.total / maxTotal) * 100;
                  return (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="w-6 text-[10px] font-black text-slate-400 text-center shrink-0">
                        #{i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-bold text-slate-800 truncate">{p.name}</span>
                          <div className="flex items-center gap-3 shrink-0 ml-2">
                            <span className="text-[10px] text-slate-400">{p.qty}x</span>
                            <span className="text-sm font-black text-[#C9A227]">{fmt(p.total)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-[#C9A227]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ContentCard>
          )}
        </div>
      )}
    </PageWrapper>
  );
}
