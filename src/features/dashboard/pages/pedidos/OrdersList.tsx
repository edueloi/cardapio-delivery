import React, { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChefHat,
  Eye,
  FileText,
  Package,
  Phone,
  Truck,
  Utensils,
  X,
} from "lucide-react";
import { PaymentBadge, useToast } from "../../../../components";
import { apiFetch, apiJson } from "../../../../lib/api";
import { Order, dineInOrderLabel } from "../../../../types";
import { playOrderDelayedSound } from "../../../../lib/notificationSound";

function maskPhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  // Remove 55 prefix if present for masking
  const clean = (digits.startsWith("55") && digits.length >= 12) ? digits.slice(2) : digits;
  
  if (clean.length <= 2) return clean.length > 0 ? `(${clean}` : "";
  if (clean.length <= 6) return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
  if (clean.length <= 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`;
}

function OrderWaitTime({ createdAt, status }: { createdAt: string, status: string }) {
  const [wait, setWait] = useState("");

  useEffect(() => {
    if (status === 'DELIVERED' || status === 'CANCELLED') {
      setWait("--");
      return;
    }
    const update = () => {
      const diff = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / 60000);
      setWait(`${diff} min`);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [createdAt, status]);

  if (wait === "--") return null;

  return <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">{wait}</span>;
}

const STATUS_MAP = {
  PENDING:          { label: 'Aguardando',   color: 'bg-amber-100 text-amber-700',   border: '#F59E0B' },
  PREPARING:        { label: 'Em Preparo',   color: 'bg-blue-100 text-blue-700',     border: '#3B82F6' },
  SHIPPED:          { label: 'Pronto',       color: 'bg-orange-100 text-orange-700', border: '#F97316' },
  AWAITING_PAYMENT: { label: 'Ag. Caixa',   color: 'bg-purple-100 text-purple-700', border: '#A855F7' },
  DELIVERED:        { label: 'Concluído',   color: 'bg-green-100 text-green-700',   border: '#22C55E' },
} as const;

const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

function orderSenhaLabel(order: Order): string {
  if (order.counterTicketNumber != null)
    return `Senha ${String(order.counterTicketNumber).padStart(2, '0')}`;
  if (order.tableId) return `Mesa ${order.tableId}`;
  return `#${order.id.slice(-4).toUpperCase()}`;
}

const PREPARING_DELAY_MS = 30 * 60 * 1000; // 30 minutos em preparo = atrasado
const SHIPPED_DELAY_MS = 15 * 60 * 1000;   // 15 minutos pronto sem retirar = atrasado

type DelayedAlertEntry = { orderId: string; kind: 'preparing' | 'shipped'; label: string; timestamp: number };

// ─── Alerta de atraso (som + card, sem travar a tela) ─────────────────────────
// Diferente do AwaitingPaymentAlert (modal bloqueante — exige resposta), este é
// só um aviso: o operador continua trabalhando normalmente, só fica sabendo que
// um pedido em preparo passou de 30min, ou um pedido pronto passou de 15min sem
// ser retirado. Dispara uma vez por pedido (não repete a cada re-render).
function DelayedOrdersAlert({ orders }: { orders: Order[] }) {
  const [alerts, setAlerts] = useState<DelayedAlertEntry[]>([]);
  const timerMap = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const firedRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    const activeKeys = new Set<string>();

    orders.forEach((order) => {
      if (order.status === 'PREPARING') {
        const key = `preparing-${order.id}`;
        activeKeys.add(key);
        if (timerMap.current.has(key) || firedRef.current.has(key)) return;
        const since = order.updatedAt ? new Date(order.updatedAt).getTime() : new Date(order.createdAt).getTime();
        const remaining = Math.max(0, PREPARING_DELAY_MS - (Date.now() - since));
        const timer = setTimeout(() => {
          firedRef.current.add(key);
          timerMap.current.delete(key);
          playOrderDelayedSound();
          setAlerts((prev) => [{ orderId: order.id, kind: 'preparing', label: orderSenhaLabel(order), timestamp: Date.now() }, ...prev]);
        }, remaining);
        timerMap.current.set(key, timer);
      }

      if (order.status === 'SHIPPED') {
        const key = `shipped-${order.id}`;
        activeKeys.add(key);
        if (timerMap.current.has(key) || firedRef.current.has(key)) return;
        const since = order.readyAt ? new Date(order.readyAt).getTime() : (order.updatedAt ? new Date(order.updatedAt).getTime() : new Date(order.createdAt).getTime());
        const remaining = Math.max(0, SHIPPED_DELAY_MS - (Date.now() - since));
        const timer = setTimeout(() => {
          firedRef.current.add(key);
          timerMap.current.delete(key);
          playOrderDelayedSound();
          setAlerts((prev) => [{ orderId: order.id, kind: 'shipped', label: orderSenhaLabel(order), timestamp: Date.now() }, ...prev]);
        }, remaining);
        timerMap.current.set(key, timer);
      }
    });

    // Limpa timers/estado "já disparado" de pedidos que saíram do status monitorado
    // (ex: pedido em preparo foi marcado como pronto, ou pedido pronto foi retirado) —
    // assim, se ele voltar a esse status depois, o alerta pode disparar de novo.
    timerMap.current.forEach((timer, key) => {
      if (!activeKeys.has(key)) {
        clearTimeout(timer);
        timerMap.current.delete(key);
      }
    });
    firedRef.current.forEach((key) => {
      if (!activeKeys.has(key)) firedRef.current.delete(key);
    });
    setAlerts((prev) => prev.filter((a) => activeKeys.has(`${a.kind}-${a.orderId}`)));
  }, [orders]);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[150] flex flex-col-reverse gap-2 max-w-xs w-full pointer-events-none">
      <AnimatePresence>
        {alerts.map((alert) => (
          <motion.div
            key={`${alert.kind}-${alert.orderId}`}
            initial={{ opacity: 0, x: 80, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.15 } }}
            className="pointer-events-auto bg-red-500 text-white p-3.5 rounded-2xl shadow-2xl ring-4 ring-red-500/20 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4.5 h-4.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/80">
                {alert.kind === 'preparing' ? 'Atrasado — 30min em preparo' : 'Não retirado — 15min pronto'}
              </p>
              <p className="text-sm font-black leading-tight truncate">{alert.label}</p>
            </div>
            <button
              onClick={() => setAlerts((prev) => prev.filter((a) => !(a.kind === alert.kind && a.orderId === alert.orderId)))}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function KanbanCard({ order, categoryMap, updateStatus, isExpanded, toggleOrder, isOverlay, onBillDelivery }: { order: Order, categoryMap: any, updateStatus: any, isExpanded: boolean, toggleOrder: () => void, isOverlay?: boolean, onBillDelivery?: (order: Order) => void }) {
  const isDelayed = Date.now() - new Date(order.createdAt).getTime() > 30 * 60000 && order.status !== 'DELIVERED' && order.status !== 'CANCELLED';
  const isPaid = order.billed === true;
  const needsBilling = order.orderType === 'DELIVERY' && order.status === 'DELIVERED' && !isPaid;
  const toast = useToast();
  const [reannouncing, setReannouncing] = useState(false);

  const handleReannounce = async (e: any) => {
    e.stopPropagation();
    setReannouncing(true);
    try {
      const res = await apiFetch(`/api/orders/${order.id}/reannounce`, { method: 'POST' });
      if (res.ok) toast.success('Chamando de novo no painel de TV!');
      else toast.error('Não foi possível chamar de novo.');
    } catch {
      toast.error('Não foi possível chamar de novo.');
    } finally {
      setReannouncing(false);
    }
  };

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    data: { order }
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.3 : 1,
  } : undefined;

  const handleNextAction = (e: any) => {
    e.stopPropagation();
    if (order.status === 'PENDING') updateStatus(order.id, 'PREPARING');
    else if (order.status === 'PREPARING') updateStatus(order.id, 'SHIPPED');
    else if (order.status === 'SHIPPED') {
      if (order.orderType === 'DELIVERY') updateStatus(order.id, 'DELIVERED');
      else updateStatus(order.id, 'AWAITING_PAYMENT');
    }
  };

  const actionLabel = order.status === 'PENDING' ? 'Aceitar pedido' 
                    : order.status === 'PREPARING' ? (order.orderType === 'DELIVERY' ? 'Despachar' : 'Marcar pronto')
                    : order.status === 'SHIPPED' ? (order.orderType === 'DELIVERY' ? 'Confirmar Entrega' : 'Entregar')
                    : 'Ação';

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-white rounded-[1.25rem] p-3 sm:p-4 flex flex-col gap-3 border shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden transition-all ${isDelayed ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200/60'} ${isDragging ? 'shadow-xl scale-105 border-blue-400 cursor-grabbing' : ''}`}
    >
      {/* Top: Senha + Time (Draggable Area) */}
      <div className="flex items-start justify-between gap-2 cursor-grab active:cursor-grabbing" {...listeners} {...attributes}>
        <div className="flex items-center gap-2.5 min-w-0">
          {order.orderType === 'DINE_IN' && (order.tableId || order.counterTicketNumber != null) && (
            <div className="shrink-0 w-11 h-11 flex flex-col items-center justify-center bg-slate-50 border border-slate-100 rounded-xl leading-none">
              <span className="text-[7px] font-black uppercase tracking-widest text-slate-400">{order.tableId ? "Mesa" : "Senha"}</span>
              <span className="text-base font-black text-[#0D1B3E] tabular-nums mt-0.5">{order.tableId || String(order.counterTicketNumber).padStart(2, "0")}</span>
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-slate-800 tracking-tight">#{order.id.slice(-4).toUpperCase()}</span>
              {isPaid && (
                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Pago
                </span>
              )}
              {needsBilling && (
                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 border border-purple-200 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1 shrink-0">
                  <Truck className="w-2.5 h-2.5" /> Ag. Faturar
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
              {order.customerName || (order.orderType === 'DINE_IN' ? dineInOrderLabel(order) : '')}
            </p>
          </div>
        </div>
        <div className={`flex flex-col items-end shrink-0 ${isDelayed ? 'text-red-500' : 'text-slate-400'}`}>
          <span className="text-[10px] font-black uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">
            <OrderWaitTime createdAt={order.createdAt} status={order.status} />
          </span>
        </div>
      </div>

      {/* Items list — agrupados por destino: Cozinha (precisa preparo) e Balcão (o resto) */}
      {(() => {
        const renderItem = (item: any, idx: number) => (
          <div
            key={idx}
            className={`py-2 ${idx > 0 ? "border-t border-dashed border-slate-200" : ""}`}
          >
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-700 leading-tight">
                    {item.quantity}x {item.product?.name}
                  </p>
                  {item.productVariant?.name && (
                    <p className="text-[10px] font-black uppercase text-[#C9A227] mt-0.5">· {item.productVariant.name}</p>
                  )}
                  {item.notes && (
                    <div className="mt-1 bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-bold px-2 py-1 rounded-lg flex items-start gap-1">
                      <Utensils className="w-2.5 h-2.5 mt-0.5 shrink-0" />
                      <span>{item.notes}</span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-black text-slate-400 tabular-nums shrink-0 pt-0.5">
                  {fmt(item.price * item.quantity)}
                </span>
              </div>
            </div>
          </div>
        );

        const kitchenItems = order.items?.filter((item: any) => item.product?.kitchenPrint === true) || [];
        const counterItems = order.items?.filter((item: any) => item.product?.kitchenPrint !== true) || [];

        return (
          <div className="space-y-3">
            {kitchenItems.length > 0 && (
              <div>
                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 tracking-widest flex items-center gap-0.5 w-fit mb-1">
                  <ChefHat className="w-2.5 h-2.5" />
                  Cozinha
                </span>
                <div className="space-y-0">{kitchenItems.map(renderItem)}</div>
              </div>
            )}
            {counterItems.length > 0 && (
              <div>
                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 tracking-widest flex items-center gap-0.5 w-fit mb-1">
                  Balcão
                </span>
                <div className="space-y-0">{counterItems.map(renderItem)}</div>
              </div>
            )}
          </div>
        );
      })()}

      <div className="h-px bg-slate-100 w-full" />

      {/* Total */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</span>
        <span className="text-sm font-black text-slate-800">{fmt(order.total)}</span>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={toggleOrder}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-[9px] font-black uppercase tracking-widest rounded-xl transition-colors"
        >
          <FileText className="w-3 h-3" />
          Ver detalhes
        </button>
        {needsBilling ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onBillDelivery?.(order); }}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 bg-purple-500 hover:bg-purple-600 shadow-purple-500/20"
          >
            <Truck className="w-3 h-3" />
            Faturar Delivery
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNextAction}
            className={`w-full flex items-center justify-center gap-1.5 py-2.5 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 ${order.status === 'PENDING' ? 'bg-[#0D1B3E] hover:bg-blue-950 shadow-blue-900/20' : order.status === 'PREPARING' ? 'bg-[#C9A227] hover:bg-[#b58f20] shadow-[#C9A227]/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'}`}
          >
            <CheckCircle2 className="w-3 h-3" />
            {actionLabel}
          </button>
        )}
        {order.status === 'SHIPPED' && (
          <button
            type="button"
            onClick={handleReannounce}
            disabled={reannouncing}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-white border border-amber-200 hover:bg-amber-50 text-amber-600 text-[9px] font-black uppercase tracking-widest rounded-xl transition-colors disabled:opacity-50"
          >
            <Bell className="w-3 h-3" />
            Chamar novamente
          </button>
        )}
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-4 mt-2 border-t border-slate-100 space-y-3">
              <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {maskPhone(order.customerPhone)}
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-[0.15em] px-2 py-0.5 bg-slate-200 text-slate-600 rounded-md">
                    {order.orderType === 'DELIVERY' ? 'Delivery' : order.orderType === 'DINE_IN' ? dineInOrderLabel(order) : 'Retirada'}
                  </span>
                </div>
                {order.address && (
                  <p className="text-[9px] text-slate-500 font-medium italic border-l-2 border-slate-300 pl-2">
                    {order.address}
                  </p>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Método de Pgto</span>
                  {order.orderType === "DINE_IN" && !order.billed ? (
                    <span className="text-[9px] font-bold text-slate-400 italic">A definir no fechamento</span>
                  ) : (
                    <PaymentBadge method={order.paymentMethod.toLowerCase() as any} size="sm" />
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function OrdersList({
  filteredOrders,
  updateStatus,
  slug,
  activeOrderId,
  tenant,
}: {
  filteredOrders: Order[];
  updateStatus: any;
  slug?: string;
  activeOrderId?: string;
  tenant?: import("../../../../types").Tenant | null;
}) {
  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    tenant?.categories?.forEach((cat) => { map[cat.id] = cat.name; });
    return map;
  }, [tenant?.categories]);
  
  const navigate = useNavigate();
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(() => new Set());
  
  useEffect(() => {
    if (activeOrderId) {
      setExpandedOrders((prev) => new Set([...prev, activeOrderId]));
    }
  }, [activeOrderId]);

  const toggleOrder = (orderId: string, isHistory: boolean) => {
    if (isHistory && slug) {
      if (expandedOrders.has(orderId)) {
        navigate(`/dashboard/${slug}/historico`);
        setExpandedOrders((prev) => { const s = new Set(prev); s.delete(orderId); return s; });
      } else {
        navigate(`/dashboard/${slug}/historico/${orderId}`);
        setExpandedOrders((prev) => new Set([...prev, orderId]));
      }
    } else {
      setExpandedOrders((prev) => {
        const s = new Set(prev);
        if (s.has(orderId)) s.delete(orderId); else s.add(orderId);
        return s;
      });
    }
  };

  const pendingOrders = filteredOrders.filter(o => o.status === 'PENDING');
  const preparingOrders = filteredOrders.filter(o => o.status === 'PREPARING');
  const shippedOrders = filteredOrders.filter(o => o.status === 'SHIPPED');
  // Delivery entregue (pagamento na entrega) que ainda não teve o valor lançado
  // no caixa — precisa ser faturado aqui, senão fica invisível pro operador.
  const billingOrders = filteredOrders.filter(o => o.orderType === 'DELIVERY' && o.status === 'DELIVERED' && !o.billed);

  const [billingOrder, setBillingOrder] = useState<Order | null>(null);
  const [billingPaymentMethod, setBillingPaymentMethod] = useState<"CASH" | "CREDIT" | "DEBIT" | "PIX">("CASH");
  const [isBilling, setIsBilling] = useState(false);
  const toast = useToast();

  const handleConfirmBilling = async () => {
    if (!billingOrder || !tenant?.slug) return;
    setIsBilling(true);
    try {
      await apiJson(`/api/tenants/${tenant.slug}/pdv/bill-order/${billingOrder.id}`, {
        method: "POST",
        body: JSON.stringify({ paymentMethod: billingPaymentMethod }),
      });
      setBillingOrder(null);
      toast.success("Delivery faturado com sucesso!");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível faturar o pedido.");
    } finally {
      setIsBilling(false);
    }
  };

  // Helper for Kanban Column
  const KanbanColumn = ({ id, title, count, orders, borderColor, textColor, droppable = true, onBillDelivery }: { id: string, title: string, count: number, orders: Order[], borderColor: string, textColor: string, droppable?: boolean, onBillDelivery?: (order: Order) => void }) => {
    const { isOver, setNodeRef } = useDroppable({ id, disabled: !droppable });

    return (
      <div
        ref={setNodeRef}
        className={`flex flex-col bg-slate-50/50 rounded-[1.75rem] border-2 p-3 sm:p-4 h-full transition-all ${isOver ? `border-dashed bg-white shadow-inner scale-[1.02] ${borderColor}` : 'border-solid border-slate-100'}`}
      >
        <div className={`flex items-center justify-between pb-2.5 mb-3 border-b-2 ${borderColor}`}>
          <h3 className={`font-black uppercase tracking-widest text-[13px] sm:text-sm ${textColor}`}>{title}</h3>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black border ${borderColor} ${textColor} bg-white`}>{count}</span>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
          {orders.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-32 sm:h-36 text-center transition-all ${isOver ? 'opacity-100 scale-110' : 'opacity-40 grayscale'}`}>
              <span className="text-3xl sm:text-4xl mb-2">{isOver ? '📥' : '🍽️'}</span>
              <p className={`text-xs font-bold ${isOver ? textColor : 'text-slate-500'}`}>{isOver ? 'Solte aqui' : `Nenhum pedido ${title.toLowerCase()}`}</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {orders.map((order) => (
                <KanbanCard
                  key={order.id}
                  order={order}
                  categoryMap={categoryMap}
                  updateStatus={updateStatus}
                  isExpanded={expandedOrders.has(order.id)}
                  toggleOrder={() => toggleOrder(order.id, order.status === "DELIVERED" || order.status === "CANCELLED")}
                  onBillDelivery={onBillDelivery}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    );
  };

  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    
    const orderId = active.id as string;
    const targetStatus = over.id as string;
    
    const order = filteredOrders.find(o => o.id === orderId);
    if (!order) return;
    
    if (order.status !== targetStatus) {
      updateStatus(orderId, targetStatus);
    }
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
      <div className="flex flex-col h-full space-y-3 min-h-0">
        <DelayedOrdersAlert orders={filteredOrders} />

        {/* Kanban Board */}
        <div className="flex-1 min-h-0 grid gap-4 pb-3 overflow-hidden grid-cols-1 lg:grid-cols-2 xl:grid-cols-4">
          <KanbanColumn id="PENDING" title="Pendentes" count={pendingOrders.length} orders={pendingOrders} borderColor="border-amber-400" textColor="text-amber-500" />
          <KanbanColumn id="PREPARING" title="Em preparo" count={preparingOrders.length} orders={preparingOrders} borderColor="border-orange-400" textColor="text-orange-500" />
          <KanbanColumn id="SHIPPED" title="Prontos / Retire" count={shippedOrders.length} orders={shippedOrders} borderColor="border-emerald-400" textColor="text-emerald-500" />
          <KanbanColumn id="BILLING" title="Ag. Faturamento" count={billingOrders.length} orders={billingOrders} borderColor="border-purple-400" textColor="text-purple-500" droppable={false} onBillDelivery={setBillingOrder} />
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 250, easing: 'ease' }}>
        {activeId ? (
          <KanbanCard
            order={filteredOrders.find(o => o.id === activeId)!}
            categoryMap={categoryMap}
            updateStatus={updateStatus}
            isExpanded={expandedOrders.has(activeId)}
            toggleOrder={() => {}}
            isOverlay
          />
        ) : null}
      </DragOverlay>

      {/* ── Faturar Delivery Modal — mesmo fluxo do PDV (aba "Delivery Aguardando
          Faturar"), disponível aqui pra não depender do operador saber que precisa
          abrir o PDV pra fechar um pedido de delivery pago na entrega. ── */}
      <AnimatePresence>
        {billingOrder && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm space-y-6 shadow-2xl"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center mx-auto mb-4">
                  <Truck className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">Faturar Delivery</h3>
                <p className="text-xs text-slate-400 font-bold uppercase">{billingOrder.customerName} · {fmt(billingOrder.total)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                  Como foi pago?
                </label>
                <div className="max-h-32 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 space-y-1">
                  {billingOrder.items.filter((item) => item.product).map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs gap-3">
                      <span className="font-bold text-slate-600 truncate">{item.quantity}x {item.product?.name}</span>
                      <span className="font-black text-slate-700 whitespace-nowrap">{fmt(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: "CASH", label: "Dinheiro" },
                    { id: "CREDIT", label: "Crédito" },
                    { id: "DEBIT", label: "Débito" },
                    { id: "PIX", label: "Pix" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setBillingPaymentMethod(opt.id)}
                      className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest border-2 transition-all ${
                        billingPaymentMethod === opt.id
                          ? "border-[#C9A227] bg-[#C9A227]/10 text-[#0D1B3E]"
                          : "border-slate-100 bg-slate-50 text-slate-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setBillingOrder(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-500 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all"
                >
                  Cancelar
                </button>
                <button
                  disabled={isBilling}
                  onClick={() => void handleConfirmBilling()}
                  className="bg-[#0D1B3E] hover:bg-slate-800 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  {isBilling ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : "Confirmar e Faturar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DndContext>
  );
}

