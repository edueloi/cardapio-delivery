import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { apiJson, apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import socket from "../lib/socket";
import type { Order, Tenant } from "../types";
import { ChefHat, Timer, Bell, CheckCircle2, LogOut, Utensils } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const KITCHEN_STATUSES = ["PENDING", "PREPARING"] as const;

function useElapsedMinutes(createdAt: string) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 60000));
    tick();
    const timer = setInterval(tick, 10000);
    return () => clearInterval(timer);
  }, [createdAt]);
  return elapsed;
}

function orderLabel(order: Order) {
  if (order.orderType === "DINE_IN") return order.tableId ? `Mesa ${order.tableId}` : "Comanda";
  if (order.orderType === "DELIVERY") return "Delivery";
  return "Retirada";
}

function KitchenTicket({
  order,
  onAdvance,
  isReady,
}: {
  order: Order;
  onAdvance: () => void;
  isReady: boolean;
}) {
  const elapsed = useElapsedMinutes(order.createdAt);
  const kitchenItems = order.items.filter((item) => item.product?.kitchenPrint === true);

  const urgency = isReady
    ? "border-emerald-500/40 bg-emerald-500/5"
    : elapsed > 20
    ? "border-red-500/60 bg-red-500/10"
    : elapsed > 10
    ? "border-amber-400/60 bg-amber-400/10"
    : "border-white/10 bg-white/5";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={`rounded-3xl border-2 p-5 flex flex-col gap-4 ${urgency}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-white tracking-tight">#{order.id.slice(-4).toUpperCase()}</span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/10 text-white/70">
              {orderLabel(order)}
            </span>
          </div>
          <p className="text-sm font-bold text-white/60 mt-0.5 truncate max-w-[200px]">{order.customerName}</p>
        </div>
        <div
          className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-full shrink-0 ${
            !isReady && elapsed > 15 ? "text-red-300 bg-red-500/20 animate-pulse" : "text-white/60 bg-white/10"
          }`}
        >
          <Timer className="w-3.5 h-3.5" />
          {elapsed} min
        </div>
      </div>

      <div className="flex-1 space-y-2">
        {kitchenItems.map((item, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 bg-black/30 rounded-2xl border border-white/5">
            <span className="text-base font-black text-[#C9A227] min-w-[24px]">{item.quantity}x</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">{item.product?.name}</p>
              {item.notes && (
                <div className="mt-1 flex items-start gap-1.5 text-[11px] font-black text-amber-300 uppercase tracking-tight italic">
                  <Bell className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>{item.notes}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {kitchenItems.length === 0 && (
          <p className="text-xs text-white/30 italic text-center py-4">Nenhum item de cozinha neste pedido</p>
        )}
      </div>

      <button
        onClick={onAdvance}
        className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
          isReady
            ? "bg-emerald-500 hover:bg-emerald-400 text-black"
            : "bg-[#C9A227] hover:bg-[#E8B93A] text-black"
        }`}
      >
        <CheckCircle2 className="w-4 h-4" />
        {isReady ? "Enviar / Concluir" : "Marcar como Pronto"}
      </button>
    </motion.div>
  );
}

export default function KitchenDisplayPage() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const fetchTenant = async () => {
    if (!slug) return;
    try {
      const data = await apiJson<Tenant>(`/api/admin/tenant/${slug}`);
      setTenant(data);
      socket.emit("join-tenant", data.id);
      const ordersData = await apiJson<Order[]>(`/api/admin/${data.id}/orders`);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch {
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate(`/login?redirect=/cozinha/${slug}`);
      return;
    }
    fetchTenant();

    socket.on("new-order", (newOrder: Order) => {
      setOrders((prev) => [newOrder, ...prev]);
      new Audio("/notification.mp3").play().catch(() => {});
    });
    socket.on("order-status-updated", (updatedOrder: Order) => {
      setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
    });
    return () => {
      socket.off("new-order");
      socket.off("order-status-updated");
    };
  }, [slug, authLoading, isAuthenticated]);

  // Só para re-renderizar os cronômetros de forma consistente com o resto da tela
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const advanceStatus = async (order: Order) => {
    const nextStatus = order.status === "PENDING" ? "PREPARING" : "SHIPPED";
    try {
      await apiFetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus as Order["status"] } : o)));
    } catch (err) {
      console.error(err);
    }
  };

  // Fila por ordem de chegada — mais antigo primeiro (FIFO)
  const kitchenOrders = useMemo(() => {
    return orders
      .filter((o) => KITCHEN_STATUSES.includes(o.status as any))
      .filter((o) => o.items.some((item) => item.product?.kitchenPrint === true))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [orders, now]);

  const toDo = kitchenOrders.filter((o) => o.status === "PENDING");
  const preparing = kitchenOrders.filter((o) => o.status === "PREPARING");

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-[#0D1B3E] flex items-center justify-center">
        <div className="text-center text-white space-y-4">
          <p className="text-lg font-black">Acesso restrito</p>
          <Link to="/login" className="underline text-[#C9A227]">Fazer login</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0D1B3E] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="fixed inset-0 bg-[#0D1B3E] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg font-bold text-white">Painel de cozinha não encontrado</p>
          <Link to="/login" className="text-[#C9A227] underline text-sm">Voltar ao login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0D1B3E] overflow-hidden">
      {/* Topbar */}
      <div className="bg-black/20 text-white px-6 py-4 flex items-center justify-between shrink-0 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#C9A227] rounded-2xl flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-black" />
          </div>
          <div>
            <p className="text-sm font-black">{tenant.name}</p>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Painel de Cozinha</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[10px] text-white/40 font-bold uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Ao vivo
          </span>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase text-white/40 hover:text-white transition-colors bg-white/5 px-3 py-2 rounded-xl"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      </div>

      {/* Columns: A Fazer / Prontos */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
        {/* A Fazer */}
        <div className="flex flex-col min-h-0">
          <div className="px-6 py-4 flex items-center gap-2 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" />
            <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">
              A Fazer ({toDo.length})
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
            {toDo.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30 gap-3">
                <Utensils className="w-12 h-12 text-white" />
                <p className="text-sm font-black uppercase tracking-widest text-white">Nenhum pedido novo</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {toDo.map((order) => (
                    <KitchenTicket key={order.id} order={order} onAdvance={() => advanceStatus(order)} isReady={false} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Prontos (em preparo -> avançar para enviar) */}
        <div className="flex flex-col min-h-0">
          <div className="px-6 py-4 flex items-center gap-2 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse" />
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">
              Em Preparo ({preparing.length})
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
            {preparing.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30 gap-3">
                <ChefHat className="w-12 h-12 text-white" />
                <p className="text-sm font-black uppercase tracking-widest text-white">Nada em preparo</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {preparing.map((order) => (
                    <KitchenTicket key={order.id} order={order} onAdvance={() => advanceStatus(order)} isReady={true} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
