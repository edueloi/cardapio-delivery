import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  LayoutDashboard,
  CreditCard,
  Banknote,
  Bell,
  LayoutGrid,
} from "lucide-react";
import type { Order, Tenant } from "../../../../types";
import type { DashboardTabId, DashboardOrderTabId } from "../../types";
import { WhatsAppOverviewCard } from "../whatsapp/WhatsAppPanel";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  PageWrapper,
  PanelCard,
  SectionTitle,
  StatCard,
  StatGrid,
  Tabs,
} from "../../../../components";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const fmtShort = (n: number) => {
  if (n >= 1000) return `R$${(n / 1000).toFixed(1)}k`;
  return fmt(n);
};

const OVERVIEW_TABS = [
  { id: "resumo", label: "Resumo", icon: LayoutDashboard },
  { id: "alertas", label: "Alertas", icon: Bell },
  { id: "atalhos", label: "Atalhos", icon: LayoutGrid },
] as const;
type OverviewTabId = (typeof OVERVIEW_TABS)[number]["id"];

const CHART_BLUE = "#2563eb";
const CHART_BLUE_SOFT = "#bfdbfe";

interface Props {
  tenant: Tenant;
  slug: string;
  orders: Order[];
  setActiveTab: (tab: DashboardTabId) => void;
  setSubTab: (tab: DashboardOrderTabId) => void;
}

export default function OverviewPanel({ tenant, slug, orders, setActiveTab, setSubTab }: Props) {
  const [tab, setTab] = useState<OverviewTabId>("resumo");
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


  const hourData = stats.byHour.map((value, i) => ({ hora: hourLabels[i], pedidos: value }));
  const channelData = [
    { name: "Delivery", value: stats.delivery, color: "#2563eb", Icon: Truck },
    { name: "Retirada", value: stats.pickup, color: "#0ea5e9", Icon: Store },
    { name: "Mesa", value: stats.dineIn, color: "#10b981", Icon: QrCode },
  ];
  const channelTotal = stats.delivery + stats.pickup + stats.dineIn;

  const alertCount = (stats.pending > 3 ? 1 : 0) + (!isOpen ? 1 : 0) + (!wppOk ? 1 : 0);

  const tabItems = OVERVIEW_TABS.map((t) =>
    t.id === "alertas" ? { ...t, badge: alertCount > 0 ? alertCount : undefined } : t
  );

  const alerts = (
    <div className="space-y-2">
      {stats.pending > 3 && (
        <Alert
          variant="warning"
          title={`${stats.pending} pedidos aguardando aceite`}
          action={
            <Button size="xs" variant="outline" onClick={() => { setActiveTab("live-orders"); setSubTab("pending"); }}>
              Ver agora
            </Button>
          }
        >
          Clientes estão esperando — aceite os pedidos para não perder vendas.
        </Alert>
      )}
      {!isOpen && (
        <Alert variant="error" title="Estabelecimento fechado manualmente">
          Seu cardápio está invisível para clientes. Ative em Configurações → Loja.
        </Alert>
      )}
      {!wppOk && (
        <Alert
          variant="info"
          title="Bot WhatsApp desconectado"
          action={
            <Button size="xs" variant="outline" onClick={() => setActiveTab("whatsapp")}>
              Conectar
            </Button>
          }
        >
          Conecte para receber pedidos e enviar confirmações automáticas.
        </Alert>
      )}
    </div>
  );

  const queueRows = [
    { label: "Aguardando aceite", count: stats.pending, tab: "live-orders" as DashboardTabId, sub: "pending" as DashboardOrderTabId, icon: AlertCircle, tone: "text-amber-600", urgent: stats.pending > 0 },
    { label: "Em preparo (cozinha)", count: stats.preparing, tab: "live-orders" as DashboardTabId, sub: "preparing" as DashboardOrderTabId, icon: Utensils, tone: "text-blue-600", urgent: false },
    { label: "Pronto / Saiu p/ entrega", count: stats.shipped, tab: "live-orders" as DashboardTabId, sub: "shipped" as DashboardOrderTabId, icon: Truck, tone: "text-blue-600", urgent: false },
    { label: "Entregues hoje", count: stats.delivered, tab: "history" as DashboardTabId, sub: "pending" as DashboardOrderTabId, icon: CheckCircle2, tone: "text-emerald-600", urgent: false },
  ];

  const shortcuts = [
    { label: "Painel de Pedidos", icon: ShoppingBag, tab: "live-orders" as DashboardTabId },
    { label: "PDV — Caixa", icon: CreditCard, tab: "pos" as DashboardTabId },
    { label: "Monitor Cozinha", icon: Utensils, tab: "kds" as DashboardTabId },
    { label: "Cardápio", icon: QrCode, tab: "menu" as DashboardTabId },
    { label: "Relatórios", icon: BarChart3, tab: "reports" as DashboardTabId },
    { label: "Clientes", icon: Users, tab: "customers" as DashboardTabId },
    { label: "Fluxo de Caixa", icon: CircleDollarSign, tab: "finance" as DashboardTabId },
    { label: "Estoque", icon: Zap, tab: "inventory" as DashboardTabId },
    { label: "Histórico", icon: TrendingDown, tab: "history" as DashboardTabId },
  ];

  const tooltipStyle = { fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "none" };

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle
          title="Visão Geral"
          description="Acompanhe vendas, fila e canais do seu estabelecimento."
          icon={LayoutDashboard}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Badge color={isOpen ? "success" : "danger"} dot>
                {isOpen
                  ? "Estabelecimento aberto"
                  : tenant.isOpen === false
                  ? "Fechado (manual)"
                  : "Fechado (fora do horário)"}
              </Badge>
              <Badge color={wppOk ? "success" : "default"} dot>
                {wppOk ? "Bot WhatsApp ativo" : "Bot desconectado"}
              </Badge>
              {stats.active > 0 && (
                <Badge color="info">
                  {stats.active} pedido{stats.active > 1 ? "s" : ""} em aberto
                </Badge>
              )}
            </div>
          }
        />

        {alertCount > 0 && tab !== "alertas" && (
          <Alert
            variant="warning"
            action={
              <Button size="xs" variant="outline" onClick={() => setTab("alertas")}>
                Ver alertas
              </Button>
            }
          >
            {alertCount} alerta{alertCount > 1 ? "s" : ""} precisa{alertCount > 1 ? "m" : ""} da sua atenção.
          </Alert>
        )}

        <StatGrid cols={4}>
          <StatCard
            title="Vendas hoje"
            value={fmtShort(stats.totalSales)}
            description={`${stats.todayOrders.filter((o) => o.status !== "CANCELLED").length} pedidos concluídos`}
            icon={CircleDollarSign}
            color="info"
          />
          <StatCard
            title="Ticket médio"
            value={fmtShort(stats.avgTicket)}
            description={stats.delivered > 0 ? `sobre ${stats.delivered} entregues` : "Sem dados"}
            icon={TrendingUp}
            color="info"
          />
          <StatCard
            title="Pedidos ativos"
            value={stats.active}
            description={`${stats.pending} aguard. · ${stats.preparing} preparo · ${stats.shipped} pronto`}
            icon={Clock}
            color={stats.active > 0 ? "warning" : "default"}
          />
          <StatCard
            title="Entregues hoje"
            value={stats.delivered}
            description={stats.cancelled > 0 ? `${stats.cancelled} cancelado${stats.cancelled > 1 ? "s" : ""}` : "Nenhum cancelamento"}
            icon={CheckCircle2}
            color="success"
          />
        </StatGrid>

        <Tabs items={tabItems} value={tab} onChange={(v) => setTab(v as OverviewTabId)} label="Seções da visão geral">

        {tab === "resumo" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <PanelCard
                title="Fila operacional"
                description="Clique para gerenciar"
                icon={Clock}
                action={
                  <Badge color={stats.active > 0 ? "warning" : "success"}>
                    {stats.active > 0 ? `${stats.active} ativo${stats.active > 1 ? "s" : ""}` : "Limpa"}
                  </Badge>
                }
              >
                <div className="space-y-1.5">
                  {queueRows.map((row) => (
                    <button
                      key={row.label}
                      type="button"
                      onClick={() => { setActiveTab(row.tab); if (row.sub) setSubTab(row.sub); }}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-slate-50 ${row.urgent ? "border-amber-300 bg-amber-50/50" : "border-slate-200"}`}
                    >
                      <row.icon className={`h-4 w-4 shrink-0 ${row.tone}`} />
                      <span className="flex-1 text-xs font-medium text-slate-700">{row.label}</span>
                      <span className="text-xs font-semibold text-slate-900">{row.count}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-slate-300" />
                    </button>
                  ))}
                </div>
              </PanelCard>

              <PanelCard
                className="lg:col-span-2"
                title="Pedidos — últimas 8h"
                description="Volume por hora do dia"
                icon={BarChart3}
              >
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="hora" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: "#f1f5f9" }} contentStyle={tooltipStyle} />
                      <Bar dataKey="pedidos" name="Pedidos" radius={[4, 4, 0, 0]}>
                        {hourData.map((_, i) => (
                          <Cell key={i} fill={i === hourData.length - 1 ? CHART_BLUE : CHART_BLUE_SOFT} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </PanelCard>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <PanelCard
                title="Top produtos"
                icon={ShoppingBag}
                action={
                  <Button size="xs" variant="ghost" iconRight={<ArrowRight size={12} />} onClick={() => setActiveTab("menu")}>
                    Ver cardápio
                  </Button>
                }
              >
                {stats.topProducts.length === 0 ? (
                  <EmptyState icon={ShoppingBag} title="Nenhum produto vendido ainda" />
                ) : (
                  <div className="space-y-3">
                    {stats.topProducts.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-3">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold ${i === 0 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-700">{p.name}</p>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{ width: `${(p.qty / (stats.topProducts[0]?.qty || 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-semibold text-slate-700">{p.qty}x</p>
                          <p className="text-[11px] text-slate-500">{fmtShort(p.revenue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </PanelCard>

              <PanelCard title="Canais de venda" icon={Store}>
                {channelTotal === 0 ? (
                  <EmptyState icon={Store} title="Sem pedidos nos canais" />
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="h-28 w-28 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={channelData} dataKey="value" nameKey="name" innerRadius={30} outerRadius={52} paddingAngle={2} stroke="none">
                            {channelData.map((c) => (
                              <Cell key={c.name} fill={c.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      {channelData.map(({ name, value, color, Icon }) => (
                        <div key={name} className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                          <span className="flex-1 text-xs text-slate-600">{name}</span>
                          <span className="text-xs font-semibold text-slate-800">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </PanelCard>

              <PanelCard title="Formas de pagamento" icon={CreditCard}>
                {Object.keys(stats.payMap).length === 0 ? (
                  <EmptyState icon={Banknote} title="Nenhum pagamento registrado" />
                ) : (
                  <div className="space-y-3">
                    {Object.entries(stats.payMap)
                      .sort((a, b) => b[1] - a[1])
                      .map(([method, count]) => {
                        const label = PAY_LABELS[method] || method;
                        const revenue = stats.payRevMap[method] || 0;
                        const total = Object.values(stats.payMap).reduce((s, v) => s + v, 0);
                        return (
                          <div key={method} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-700">{label}</span>
                              <div className="flex items-center gap-2 text-right">
                                <span className="text-slate-500">{count}x</span>
                                <span className="font-semibold text-slate-700">{fmtShort(revenue)}</span>
                              </div>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-blue-600" style={{ width: `${(count / total) * 100}%` }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </PanelCard>
            </div>
          </div>
        )}

        {tab === "alertas" && (
          <div className="space-y-4">
            {alertCount > 0 ? (
              alerts
            ) : (
              <PanelCard>
                <EmptyState icon={CheckCircle2} title="Tudo certo por aqui" description="Nenhum alerta no momento." />
              </PanelCard>
            )}
            <WhatsAppOverviewCard tenant={tenant} onOpenSettings={() => setActiveTab("whatsapp")} />
          </div>
        )}

        {tab === "atalhos" && (
          <PanelCard title="Acesso rápido" icon={Zap}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {shortcuts.map(({ label, icon: Icon, tab: target }) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => setActiveTab(target)}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-blue-200 hover:bg-blue-50"
                >
                  <Icon className="h-4 w-4 shrink-0 text-blue-600" />
                  <span className="text-xs font-medium text-slate-700">{label}</span>
                </button>
              ))}
            </div>
          </PanelCard>
        )}
        </Tabs>
      </div>
    </PageWrapper>
  );
}
