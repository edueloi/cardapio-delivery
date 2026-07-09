import { useEffect, useMemo, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors,
  closestCenter, useDroppable, type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import socket from "../lib/socket";
import { playNotificationSound } from "../lib/notificationSound";
import type { Order, Tenant } from "../types";
import { ChefHat, Timer, Bell, CheckCircle2, LogOut, Utensils, User } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export type OrderStatus = "PENDING" | "PREPARING" | "SHIPPED";

const COLUMNS: { status: OrderStatus; label: string; dot: string; empty: string }[] = [
  { status: "PENDING", label: "Recebido", dot: "bg-yellow-400", empty: "Nenhum pedido novo" },
  { status: "PREPARING", label: "Em Preparo", dot: "bg-orange-400", empty: "Nada em preparo" },
  { status: "SHIPPED", label: "Pronto", dot: "bg-emerald-400", empty: "Nada pronto ainda" },
];

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

// Identificador curto do pedido: senha do balcão (mais fácil de gritar/conferir na
// cozinha) quando existir, senão o número da mesa, senão o código curto do pedido.
function orderShortCode(order: Order): string {
  if (order.orderType === "DINE_IN" && order.counterTicketNumber != null) {
    return `Senha ${String(order.counterTicketNumber).padStart(2, "0")}`;
  }
  if (order.orderType === "DINE_IN" && order.tableId) return `Mesa ${order.tableId}`;
  return `#${order.id.slice(-4).toUpperCase()}`;
}

function orderTypeLabel(order: Order) {
  if (order.orderType === "DINE_IN") return order.tableId ? "Mesa" : "Balcão";
  if (order.orderType === "DELIVERY") return "Delivery";
  return "Retirada";
}

function KitchenTicket({ order, onAdvance, isOverlay }: { order: Order; onAdvance: () => void; isOverlay?: boolean }) {
  const elapsed = useElapsedMinutes(order.createdAt);
  const kitchenItems = order.items.filter((item) => item.product?.kitchenPrint === true);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: order.id, data: { order } });
  const nextLabel = order.status === "PENDING" ? "Marcar em preparo" : (order.status === "PREPARING" && !order.kitchenReady) ? "Marcar como pronto" : null;
  const elapsedLabel = elapsed < 0 ? "agora" : `${elapsed} min`;

  const urgency = order.status === "SHIPPED"
    ? "border-emerald-500/40 bg-emerald-500/5"
    : elapsed > 20
    ? "border-red-500/60 bg-red-500/10"
    : elapsed > 10
    ? "border-amber-400/60 bg-amber-400/10"
    : "border-white/10 bg-white/5";

  return (
    <motion.div
      ref={setNodeRef}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: isDragging && !isOverlay ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      style={{ transform: transform && !isOverlay ? CSS.Translate.toString(transform) : undefined }}
      className={`rounded-2xl border-2 p-3.5 flex flex-col gap-2.5 touch-none select-none ${urgency} ${isOverlay ? "cursor-grabbing shadow-2xl scale-[1.02] border-[#C9A227] bg-[#0E1A3D]" : "cursor-grab active:cursor-grabbing"}`}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-base font-black text-white tracking-tight leading-tight whitespace-nowrap min-w-0">{orderShortCode(order)}</span>
          <div
            className={`flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${
              order.status !== "SHIPPED" && elapsed > 15 ? "text-red-300 bg-red-500/20 animate-pulse" : "text-white/60 bg-white/10"
            }`}
          >
            <Timer className="w-3 h-3" />
            {elapsedLabel}
          </div>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-white/10 text-white/70 whitespace-nowrap shrink-0">
            {orderTypeLabel(order)}
          </span>
          {order.customerName && (
            <p className="text-xs font-bold text-white/50 truncate min-w-0">{order.customerName}</p>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-1.5">
        {kitchenItems.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 p-2 bg-black/30 rounded-xl border border-white/5">
            <span className="text-sm font-black text-[#C9A227] min-w-[20px]">{item.quantity}x</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-white leading-tight">{item.product?.name}</p>
              {item.notes && (
                <div className="mt-1 flex items-start gap-1.5 bg-amber-400/15 border border-amber-400/30 rounded-lg px-2 py-1">
                  <Bell className="w-3 h-3 shrink-0 mt-0.5 text-amber-300" />
                  <span className="text-[11px] font-bold text-amber-200 leading-snug">{item.notes}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {kitchenItems.length === 0 && (
          <p className="text-xs text-white/30 italic text-center py-3">Nenhum item de cozinha neste pedido</p>
        )}
      </div>

      {nextLabel ? (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onAdvance(); }}
          className="w-full py-2 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/15 text-white"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {nextLabel}
        </button>
      ) : (
        <div className="flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-300/60">
          <CheckCircle2 className="w-3 h-3" />
          Pronto — aguardando saída
        </div>
      )}
    </motion.div>
  );
}

function KitchenColumn({
  status, label, dot, empty, orders, onAdvance,
}: {
  status: OrderStatus; label: string; dot: string; empty: string; orders: Order[]; onAdvance: (order: Order) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col min-h-0">
      <div className="px-6 py-4 flex items-center gap-2 shrink-0">
        <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${dot}`} />
        <p className="text-xs font-black uppercase tracking-[0.2em] text-white/80">
          {label} ({orders.length})
        </p>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar rounded-2xl transition-colors ${isOver ? "bg-white/[0.03]" : ""}`}
      >
        {orders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 gap-3">
            <Utensils className="w-12 h-12 text-white" />
            <p className="text-sm font-black uppercase tracking-widest text-white">{empty}</p>
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            <AnimatePresence mode="popLayout">
              {orders.map((order) => (
                <KitchenTicket
                  key={order.id}
                  order={order}
                  onAdvance={() => onAdvance(order)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

// Board completo (colunas + drag-and-drop + socket) — reutilizado tanto por /cozinha/:slug
// quanto por cozinha.boxsys.com.br (login global). Recebe apiBase pronto (já incluindo o
// slug quando existir) e cuida de tudo a partir do token de sessão.
export default function KitchenBoard({
  apiBase, token, staffName, onAuthExpired, onLogout,
}: {
  apiBase: string;
  token: string;
  staffName: string | null;
  onAuthExpired: () => void;
  onLogout: () => void;
}) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // delay maior no touch dá tempo do navegador diferenciar "rolar a tela" (colunas
  // ficam lado a lado com scroll horizontal no celular) de "segurar pra arrastar o
  // card" — sem isso os dois gestos concorrem e o card pode ficar num estado
  // inconsistente (visualmente sumido) se o toque for interrompido no meio.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const fetchData = async () => {
    try {
      const res = await fetch(`${apiBase}/data`, { headers: { "X-Kitchen-Token": token } });
      if (res.status === 401) {
        onAuthExpired();
        return;
      }
      const data = await res.json();
      setTenant(data.tenant);
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      socket.emit("join-tenant", data.tenant.id);
    } catch {
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();

    const handleNewOrder = (newOrder: Order) => {
      setOrders((prev) => [newOrder, ...prev]);
      playNotificationSound();
    };
    const handleOrderStatusUpdated = (updatedOrder: Order) => {
      setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
    };
    socket.on("new-order", handleNewOrder);
    socket.on("order-status-updated", handleOrderStatusUpdated);

    // Celular/tablet suspende a conexão WebSocket quando a tela apaga ou o app vai
    // pra segundo plano — ao voltar, o socket pode ficar "zumbi" (parece conectado
    // mas não recebe mais eventos) até o próximo reconnect automático, que pode
    // demorar. Isso fazia a cozinha perder pedidos até alguém dar refresh manual.
    // Ao a aba voltar a ficar visível: força a reconexão do socket se necessário
    // e sempre revalida os dados via fetch, que não depende do socket estar vivo.
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (!socket.connected) socket.connect();
      fetchData();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    window.addEventListener("online", handleVisibilityChange);

    return () => {
      socket.off("new-order", handleNewOrder);
      socket.off("order-status-updated", handleOrderStatusUpdated);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
      window.removeEventListener("online", handleVisibilityChange);
    };
  }, [apiBase, token]);

  // Só para re-renderizar os cronômetros de forma consistente com o resto da tela
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const setOrderStatus = async (order: Order, nextStatus: OrderStatus) => {
    const isMovingToReady = nextStatus === "SHIPPED";
    const body = isMovingToReady
      ? { status: "PREPARING", kitchenReady: true }
      : { status: nextStatus, kitchenReady: false };

    const previousStatus = order.status;
    const previousKitchenReady = order.kitchenReady;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? { ...o, status: body.status as any, kitchenReady: body.kitchenReady }
          : o
      )
    );

    try {
      const res = await fetch(`${apiBase}/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Kitchen-Token": token },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err) {
      console.error(err);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? { ...o, status: previousStatus, kitchenReady: previousKitchenReady }
            : o
        )
      );
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const order = event.active.data.current?.order as Order | undefined;
    setActiveOrder(order ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveOrder(null);
    const draggedOrder = event.active.data.current?.order as Order | undefined;
    const targetStatus = event.over?.id as OrderStatus | undefined;
    if (!draggedOrder || !targetStatus) return;
    // Busca a versão mais atual do pedido no state em vez de confiar na referência
    // capturada quando o drag começou — evita mandar um status baseado em dados
    // stale se um evento de socket atualizou o pedido durante o gesto.
    setOrders((prev) => {
      const current = prev.find((o) => o.id === draggedOrder.id);
      if (current) setOrderStatus(current, targetStatus);
      return prev;
    });
  };

  // Fila por ordem de chegada — mais antigo primeiro (FIFO)
  const kitchenOrders = useMemo(() => {
    return orders
      .filter((o) => o.status === "PENDING" || o.status === "PREPARING")
      .filter((o) => o.items.some((item) => item.product?.kitchenPrint === true))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [orders, now]);

  const byStatus = (status: OrderStatus) => {
    return kitchenOrders.filter((o) => {
      if (status === "PENDING") return o.status === "PENDING" && !o.kitchenReady;
      if (status === "PREPARING") return o.status === "PREPARING" && !o.kitchenReady;
      if (status === "SHIPPED") return o.status === "PREPARING" && o.kitchenReady;
      return false;
    });
  };

  const advanceOrder = (order: Order) => {
    const nextStatus: OrderStatus = order.status === "PENDING" ? "PREPARING" : "SHIPPED";
    setOrderStatus(order, nextStatus);
  };

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
          <button onClick={onLogout} className="text-[#C9A227] underline text-sm">Voltar ao login</button>
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
          {staffName && (
            <span className="flex items-center gap-1.5 text-[11px] text-white font-black uppercase bg-white/10 px-3 py-1.5 rounded-xl">
              <User className="w-3.5 h-3.5 text-[#C9A227]" />
              {staffName}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[10px] text-white/40 font-bold uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Ao vivo
          </span>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase text-white/40 hover:text-white transition-colors bg-white/5 px-3 py-2 rounded-xl"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      </div>

      {/* Columns: Recebido / Em Preparo / Pronto — arraste o card entre elas.
          Em telas pequenas (celular) as colunas ficam lado a lado com scroll horizontal,
          em vez de empilhadas, para o arrastar entre colunas continuar prático. */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 min-h-0 flex md:grid md:grid-cols-3 overflow-x-auto md:overflow-x-visible divide-x divide-white/5 snap-x snap-mandatory md:snap-none">
          {COLUMNS.map((col) => (
            <div key={col.status} className="w-[88vw] sm:w-[420px] md:w-auto shrink-0 md:shrink snap-start flex flex-col min-h-0">
              <KitchenColumn {...col} orders={byStatus(col.status)} onAdvance={advanceOrder} />
            </div>
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 250, easing: "ease-out" }}>
          {activeOrder ? (
            <div className="w-[300px] pointer-events-none">
              <KitchenTicket order={activeOrder} onAdvance={() => advanceOrder(activeOrder)} isOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
