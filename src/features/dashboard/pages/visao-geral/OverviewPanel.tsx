import { useMemo } from "react";
import { motion } from "motion/react";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  CircleDollarSign,
  Utensils,
  Users,
  ArrowRight,
  Truck,
  Store,
  QrCode,
  Zap,
  BarChart3,
  Activity,
  CreditCard,
  Banknote,
} from "lucide-react";
import type { Order, Tenant } from "../../../../types";
import type { DashboardTabId, DashboardOrderTabId } from "../../types";
import { WhatsAppOverviewCard } from "../whatsapp/WhatsAppPanel";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const fmtShort = (n: number) => {
  if (n >= 1000) return `R$${(n / 1000).toFixed(1)}k`;
  return fmt(n);
};

interface Props {
  tenant: Tenant;
  slug: string;
  orders: Order[];
  setActiveTab: (tab: DashboardTabId) => void;
  setSubTab: (tab: DashboardOrderTabId) => void;
}

// Mini sparkline SVG sem deps externas
function Sparkline({
  data,
  color = "#C9A227",
  height = 40,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = height;
  const pad = 4;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });
  const polyline = pts.join(" ");
  const area = `${pad},${h - pad} ${polyline} ${w - pad},${h - pad}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={area}
        fill={`url(#sg-${color.replace("#", "")})`}
      />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Gráfico de barras horizontal simples
function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className="font-bold text-slate-800">{value}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// Mini donut para distribuição de tipos
function Donut({ slices }: { slices: { value: number; color: string; label: string }[] }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return <div className="w-20 h-20 rounded-full bg-slate-100" />;

  const r = 30;
  const cx = 40;
  const cy = 40;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const arcs = slices.map((sl) => {
    const pct = sl.value / total;
    const dash = pct * circ;
    const arc = { ...sl, dash, offset, gap: circ - dash };
    offset += dash;
    return arc;
  });

  return (
    <svg viewBox="0 0 80 80" className="w-20 h-20">
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth="10"
          strokeDasharray={`${arc.dash} ${arc.gap}`}
          strokeDashoffset={-arc.offset + circ / 4}
          strokeLinecap="butt"
        />
      ))}
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1e293b">
        {total}
      </text>
    </svg>
  );
}

export default function OverviewPanel({ tenant, slug, orders, setActiveTab, setSubTab }: Props) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const todayOrders = orders.filter((o) => o.createdAt.slice(0, 10) === todayStr);
    const pending = orders.filter((o) => o.status === "PENDING").length;
    const preparing = orders.filter((o) => o.status === "PREPARING").length;
    const shipped = orders.filter((o) => o.status === "SHIPPED").length;
    const delivered = orders.filter((o) => o.status === "DELIVERED").length;
    const cancelled = orders.filter((o) => o.status === "CANCELLED").length;
    const active = pending + preparing + shipped;

    // Pedido de Balcão/Mesa pago fica com status AWAITING_PAYMENT (ou PREPARING, se pago
    // adiantado) pra sempre — faturar no PDV muda só o campo "billed", nunca o status.
    // Contar só DELIVERED escondia essas vendas do total do dia (podia mostrar R$0 em
    // vendas com um dia cheio de pedidos de balcão já pagos).
    const isConcludedSale = (o: Order) => o.status !== "CANCELLED" && (o.billed === true || o.status === "DELIVERED");
    const totalSales = todayOrders
      .filter(isConcludedSale)
      .reduce((s, o) => s + o.total, 0);
    const concludedCount = todayOrders.filter(isConcludedSale).length;
    const avgTicket = concludedCount > 0 ? totalSales / concludedCount : 0;

    // Pedidos por hora (últimas 8h)
    const byHour: number[] = Array(8).fill(0);
    const hours8ago = new Date(now.getTime() - 8 * 3600 * 1000);
    orders.forEach((o) => {
      const d = new Date(o.createdAt);
      if (d >= hours8ago) {
        const idx = Math.floor((now.getTime() - d.getTime()) / 3600000);
        if (idx >= 0 && idx < 8) byHour[7 - idx]++;
      }
    });

    // Distribuição por tipo
    const delivery = orders.filter((o) => o.orderType === "DELIVERY").length;
    const pickup = orders.filter((o) => o.orderType === "PICKUP").length;
    const dineIn = orders.filter((o) => o.orderType === "DINE_IN").length;

    // Distribuição por pagamento
    const payMap: Record<string, number> = {};
    orders.filter(o => o.status !== "CANCELLED").forEach((o) => {
      const k = o.paymentMethod;
      payMap[k] = (payMap[k] || 0) + 1;
    });

    // Top produtos
    const prodMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    orders.filter(o => o.status !== "CANCELLED").forEach((o) => {
      o.items?.forEach((item) => {
        const name = item.product?.name || "Produto";
        if (!prodMap[name]) prodMap[name] = { name, qty: 0, revenue: 0 };
        prodMap[name].qty += item.quantity;
        prodMap[name].revenue += item.price * item.quantity;
      });
    });
    const topProducts = Object.values(prodMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // Vendas por método de pagamento em R$
    const payRevMap: Record<string, number> = {};
    orders.filter(o => o.status !== "CANCELLED").forEach((o) => {
      payRevMap[o.paymentMethod] = (payRevMap[o.paymentMethod] || 0) + o.total;
    });

    return {
      todayOrders,
      pending,
      preparing,
      shipped,
      delivered,
      cancelled,
      active,
      totalSales,
      avgTicket,
      byHour,
      delivery,
      pickup,
      dineIn,
      payMap,
      payRevMap,
      topProducts,
      totalCount: orders.length,
    };
  }, [orders, todayStr]);

  const PAY_LABELS: Record<string, string> = {
    PIX: "Pix",
    CREDIT: "Crédito",
    DEBIT: "Débito",
    CASH: "Dinheiro",
    MEAL: "Vale Ref.",
    FOOD: "Vale Alim.",
    SPLIT: "Dividido",
  };

  const PAY_COLORS: Record<string, string> = {
    PIX: "#10b981",
    CREDIT: "#6366f1",
    DEBIT: "#3b82f6",
    CASH: "#f59e0b",
    MEAL: "#ec4899",
    FOOD: "#f97316",
    SPLIT: "#8b5cf6",
  };

  const wppOk =
    tenant.wppInstance?.isActive &&
    tenant.wppInstance?.status === "CONNECTED";

  const isOpen = tenant.effectiveIsOpen ?? tenant.isOpen ?? true;

  // Horas do dia para label do gráfico
  const hourLabels = Array(8)
    .fill(0)
    .map((_, i) => {
      const h = new Date(now.getTime() - (7 - i) * 3600000);
      return `${String(h.getHours()).padStart(2, "0")}h`;
    });

  const maxHour = Math.max(...stats.byHour, 1);

  return (
    <div className="space-y-5 pb-6">

      {/* ── Linha de status rápido ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${isOpen ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-600 border-red-200"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-green-500 animate-pulse" : "bg-red-400"}`} />
          {isOpen
            ? "Estabelecimento Aberto"
            : tenant.isOpen === false
            ? "Estabelecimento Fechado (manual)"
            : "Estabelecimento Fechado (fora do horário)"}
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${wppOk ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${wppOk ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
          {wppOk ? "Bot WhatsApp Ativo" : "Bot Desconectado"}
        </div>
        {stats.active > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
            <Activity className="w-3 h-3" />
            {stats.active} pedido{stats.active > 1 ? "s" : ""} em aberto
          </div>
        )}
      </div>

      {/* ── KPI Cards principais ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Vendas Hoje",
            value: fmtShort(stats.totalSales),
            sub: `${stats.todayOrders.filter(o => o.status !== "CANCELLED").length} pedidos concluídos`,
            icon: CircleDollarSign,
            color: "from-[#C9A227]/10 to-[#C9A227]/5 border-[#C9A227]/20",
            iconColor: "text-[#C9A227]",
            sparkData: stats.byHour,
            sparkColor: "#C9A227",
          },
          {
            label: "Ticket Médio",
            value: fmtShort(stats.avgTicket),
            sub: stats.delivered > 0 ? `sobre ${stats.delivered} entregues` : "Sem dados",
            icon: TrendingUp,
            color: "from-blue-50 to-blue-50/30 border-blue-100",
            iconColor: "text-blue-500",
            sparkData: null,
            sparkColor: "#3b82f6",
          },
          {
            label: "Pedidos Ativos",
            value: stats.active.toString(),
            sub: `${stats.pending} aguard. · ${stats.preparing} preparo · ${stats.shipped} pronto`,
            icon: Clock,
            color: stats.active > 0 ? "from-orange-50 to-orange-50/30 border-orange-100" : "from-slate-50 to-slate-50/30 border-slate-100",
            iconColor: stats.active > 0 ? "text-orange-500" : "text-slate-400",
            sparkData: null,
            sparkColor: "#f97316",
          },
          {
            label: "Entregues Hoje",
            value: stats.delivered.toString(),
            sub: stats.cancelled > 0 ? `${stats.cancelled} cancelado${stats.cancelled > 1 ? "s" : ""}` : "Nenhum cancelamento",
            icon: CheckCircle2,
            color: "from-green-50 to-green-50/30 border-green-100",
            iconColor: "text-green-500",
            sparkData: null,
            sparkColor: "#22c55e",
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className={`bg-gradient-to-br ${card.color} border rounded-2xl p-4 relative overflow-hidden`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center ${card.iconColor}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-800 leading-none mb-1">{card.value}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{card.label}</p>
            <p className="text-[10px] text-slate-400 mt-1 leading-tight">{card.sub}</p>
            {card.sparkData && (
              <div className="mt-3 opacity-60">
                <Sparkline data={card.sparkData} color={card.sparkColor} height={32} />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* ── Fila de pedidos + gráfico de barras por hora ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Fila operacional */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-slate-800">Fila Operacional</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Clique para gerenciar</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${stats.active > 0 ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"}`}>
              {stats.active > 0 ? `${stats.active} ativo${stats.active > 1 ? "s" : ""}` : "Limpa"}
            </span>
          </div>
          <div className="p-3 space-y-2">
            {[
              {
                label: "Aguardando aceite",
                count: stats.pending,
                color: "#C9A227",
                bg: "bg-amber-50 hover:bg-amber-100",
                badge: "bg-amber-100 text-amber-700",
                tab: "live-orders" as DashboardTabId,
                sub: "pending" as DashboardOrderTabId,
                icon: AlertCircle,
                urgent: stats.pending > 0,
              },
              {
                label: "Em preparo (cozinha)",
                count: stats.preparing,
                color: "#f97316",
                bg: "bg-orange-50 hover:bg-orange-100",
                badge: "bg-orange-100 text-orange-700",
                tab: "live-orders" as DashboardTabId,
                sub: "preparing" as DashboardOrderTabId,
                icon: Utensils,
                urgent: false,
              },
              {
                label: "Pronto / Saiu p/ entrega",
                count: stats.shipped,
                color: "#3b82f6",
                bg: "bg-blue-50 hover:bg-blue-100",
                badge: "bg-blue-100 text-blue-700",
                tab: "live-orders" as DashboardTabId,
                sub: "shipped" as DashboardOrderTabId,
                icon: Truck,
                urgent: false,
              },
              {
                label: "Entregues hoje",
                count: stats.delivered,
                color: "#22c55e",
                bg: "bg-green-50 hover:bg-green-100",
                badge: "bg-green-100 text-green-700",
                tab: "history" as DashboardTabId,
                sub: "pending" as DashboardOrderTabId,
                icon: CheckCircle2,
                urgent: false,
              },
            ].map((row) => (
              <button
                key={row.label}
                onClick={() => { setActiveTab(row.tab); if (row.sub) setSubTab(row.sub); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${row.bg} ${row.urgent ? "ring-1 ring-amber-300" : ""}`}
              >
                <row.icon className="w-4 h-4 shrink-0" style={{ color: row.color }} />
                <span className="flex-1 text-xs font-semibold text-slate-700">{row.label}</span>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${row.badge}`}>{row.count}</span>
                <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Gráfico de pedidos por hora */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-black text-slate-800">Pedidos — Últimas 8h</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Volume por hora do dia</p>
            </div>
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-[#C9A227]" />
            </div>
          </div>
          <div className="flex items-end gap-2 h-28">
            {stats.byHour.map((val, i) => {
              const heightPct = maxHour > 0 ? (val / maxHour) * 100 : 0;
              const isLast = i === stats.byHour.length - 1;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end" style={{ height: "96px" }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(heightPct, val > 0 ? 8 : 2)}%` }}
                      transition={{ delay: i * 0.05, duration: 0.5, ease: "easeOut" }}
                      className={`w-full rounded-t-lg ${isLast ? "bg-[#C9A227]" : "bg-[#C9A227]/30"}`}
                    />
                  </div>
                  <span className="text-[8px] text-slate-400 font-medium">{hourLabels[i]}</span>
                  {val > 0 && <span className="text-[9px] font-black text-slate-600">{val}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Top Produtos + Distribuição canais + Pagamentos ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Top produtos */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-black text-slate-800">Top Produtos</p>
            <button onClick={() => setActiveTab("menu")} className="text-[10px] text-[#C9A227] font-bold hover:underline flex items-center gap-1">
              Ver cardápio <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {stats.topProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-300">
              <ShoppingBag className="w-8 h-8 mb-2" />
              <p className="text-xs font-medium">Nenhum produto vendido ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[9px] font-black shrink-0 ${i === 0 ? "bg-[#C9A227] text-white" : i === 1 ? "bg-slate-200 text-slate-600" : "bg-slate-100 text-slate-400"}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{p.name}</p>
                    <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(p.qty / (stats.topProducts[0]?.qty || 1)) * 100}%` }}
                        transition={{ delay: i * 0.1, duration: 0.6 }}
                        className="h-full rounded-full bg-[#C9A227]"
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-slate-700">{p.qty}x</p>
                    <p className="text-[9px] text-slate-400">{fmtShort(p.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Canais de venda */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm font-black text-slate-800 mb-4">Canais de Venda</p>
          <div className="flex items-center gap-5 mb-5">
            <Donut
              slices={[
                { value: stats.delivery, color: "#6366f1", label: "Delivery" },
                { value: stats.pickup, color: "#C9A227", label: "Retirada" },
                { value: stats.dineIn, color: "#22c55e", label: "Mesa" },
              ]}
            />
            <div className="space-y-2.5 flex-1">
              {[
                { label: "Delivery", count: stats.delivery, color: "#6366f1", Icon: Truck },
                { label: "Retirada", count: stats.pickup, color: "#C9A227", Icon: Store },
                { label: "Mesa", count: stats.dineIn, color: "#22c55e", Icon: QrCode },
              ].map(({ label, count, color, Icon }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                  <span className="text-xs text-slate-600 flex-1">{label}</span>
                  <span className="text-xs font-black" style={{ color }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <HBar label="Delivery" value={stats.delivery} max={stats.totalCount} color="#6366f1" />
            <HBar label="Retirada" value={stats.pickup} max={stats.totalCount} color="#C9A227" />
            <HBar label="Mesa" value={stats.dineIn} max={stats.totalCount} color="#22c55e" />
          </div>
        </div>

        {/* Pagamentos */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-black text-slate-800">Formas de Pagamento</p>
            <CreditCard className="w-4 h-4 text-slate-300" />
          </div>
          {Object.keys(stats.payMap).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-300">
              <Banknote className="w-8 h-8 mb-2" />
              <p className="text-xs font-medium">Nenhum pagamento registrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.payMap)
                .sort((a, b) => b[1] - a[1])
                .map(([method, count]) => {
                  const color = PAY_COLORS[method] || "#94a3b8";
                  const label = PAY_LABELS[method] || method;
                  const revenue = stats.payRevMap[method] || 0;
                  const total = Object.values(stats.payMap).reduce((s, v) => s + v, 0);
                  return (
                    <div key={method} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-semibold text-slate-700">{label}</span>
                        </div>
                        <div className="flex items-center gap-2 text-right">
                          <span className="text-slate-400">{count}x</span>
                          <span className="font-black text-slate-700">{fmtShort(revenue)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(count / total) * 100}%` }}
                          transition={{ duration: 0.6 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* ── Atalhos rápidos + WhatsApp ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Atalhos */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm font-black text-slate-800 mb-3">Acesso Rápido</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: "Painel de Pedidos", icon: ShoppingBag, tab: "live-orders" as DashboardTabId, color: "hover:border-orange-200 hover:bg-orange-50 group-hover:text-orange-500" },
              { label: "PDV — Caixa", icon: CreditCard, tab: "pos" as DashboardTabId, color: "hover:border-blue-200 hover:bg-blue-50 group-hover:text-blue-500" },
              { label: "Monitor Cozinha", icon: Utensils, tab: "kds" as DashboardTabId, color: "hover:border-amber-200 hover:bg-amber-50 group-hover:text-amber-500" },
              { label: "Cardápio", icon: QrCode, tab: "menu" as DashboardTabId, color: "hover:border-green-200 hover:bg-green-50 group-hover:text-green-500" },
              { label: "Relatórios", icon: BarChart3, tab: "reports" as DashboardTabId, color: "hover:border-purple-200 hover:bg-purple-50 group-hover:text-purple-500" },
              { label: "Clientes CRM", icon: Users, tab: "customers" as DashboardTabId, color: "hover:border-pink-200 hover:bg-pink-50 group-hover:text-pink-500" },
              { label: "Fluxo de Caixa", icon: CircleDollarSign, tab: "finance" as DashboardTabId, color: "hover:border-emerald-200 hover:bg-emerald-50 group-hover:text-emerald-500" },
              { label: "Estoque", icon: Zap, tab: "inventory" as DashboardTabId, color: "hover:border-red-200 hover:bg-red-50 group-hover:text-red-500" },
              { label: "Histórico", icon: TrendingDown, tab: "history" as DashboardTabId, color: "hover:border-slate-200 hover:bg-slate-50 group-hover:text-slate-500" },
            ].map(({ label, icon: Icon, tab, color }) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`group flex items-center gap-2.5 px-3 py-3 rounded-xl border border-slate-100 bg-slate-50 transition-all text-left ${color}`}
              >
                <Icon className="w-4 h-4 shrink-0 text-slate-400 transition-colors group-hover:scale-110" />
                <span className="text-[11px] font-semibold text-slate-600 leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* WhatsApp card */}
        <div className="lg:col-span-1">
          <WhatsAppOverviewCard tenant={tenant} onOpenSettings={() => setActiveTab("whatsapp")} />
        </div>
      </div>

      {/* ── Alertas e dicas contextuais ── */}
      {(stats.pending > 3 || !isOpen || !wppOk) && (
        <div className="space-y-2">
          {stats.pending > 3 && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
            >
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-amber-800">
                  {stats.pending} pedidos aguardando aceite
                </p>
                <p className="text-[11px] text-amber-600 mt-0.5">
                  Clientes estão esperando — aceite os pedidos para não perder vendas.
                </p>
              </div>
              <button
                onClick={() => { setActiveTab("live-orders"); setSubTab("pending"); }}
                className="shrink-0 text-[10px] font-black text-amber-700 bg-amber-100 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                Ver agora
              </button>
            </motion.div>
          )}
          {!isOpen && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
            >
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-800">Estabelecimento fechado manualmente</p>
                <p className="text-[11px] text-red-600 mt-0.5">
                  Seu cardápio está invisível para clientes. Ative em Configurações → Loja.
                </p>
              </div>
            </motion.div>
          )}
          {!wppOk && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"
            >
              <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-700">Bot WhatsApp desconectado</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Conecte para receber pedidos e enviar confirmações automáticas.
                </p>
              </div>
              <button
                onClick={() => setActiveTab("whatsapp")}
                className="shrink-0 text-[10px] font-black text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                Conectar
              </button>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
