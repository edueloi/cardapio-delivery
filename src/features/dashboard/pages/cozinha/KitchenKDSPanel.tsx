import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Bell, Clock, LayoutGrid, ListChecks, Timer, Utensils } from "lucide-react";
import { Button, ContentCard, SectionTitle } from "../../../../components";
import { Order, dineInOrderLabel } from "../../../../types";

export function KitchenKDSPanel({
  orders,
  updateStatus,
  waiterCalls = [],
  onDismissWaiterCall,
}: {
  orders: Order[];
  updateStatus: (id: string, status: string) => void;
  waiterCalls?: Array<{ tableId: string; customerName: string; note: string; requestBill: boolean; timestamp: number }>;
  onDismissWaiterCall?: (ts: number) => void;
}) {
  const [viewMode, setViewMode] = useState<"grid" | "consolidated">("grid");
  const hasKitchenItem = (o: Order) => o.items.some(item => item.product?.kitchenPrint === true);
  const pendingOrders = orders.filter(o => o.status === "PENDING" && hasKitchenItem(o));
  const preparingOrders = orders.filter(o => o.status === "PREPARING" && hasKitchenItem(o));
  const kitchenOrders = [...pendingOrders, ...preparingOrders];

  // Calculate consolidated items (pending + preparing) — só itens marcados para cozinha
  const consolidated = kitchenOrders.reduce((acc: Record<string, { name: string; quantity: number }>, order) => {
    order.items.filter(item => item.product?.kitchenPrint === true).forEach(item => {
      const key = item.productId;
      if (!acc[key]) acc[key] = { name: item.product?.name || "Produto", quantity: 0 };
      acc[key].quantity += item.quantity;
    });
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Waiter Call Alerts */}
      {waiterCalls.length > 0 && (
        <div className="space-y-2">
          {waiterCalls.map(w => (
            <div key={w.timestamp} className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center shrink-0 animate-pulse">
                <Bell className="w-4 h-4 text-black" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-amber-800 uppercase tracking-widest">
                  {w.requestBill ? "Pedir Conta" : "Chamada"} — Mesa {w.tableId}
                </p>
                <p className="text-sm font-bold text-amber-700 truncate">{w.customerName}</p>
                {w.note && <p className="text-xs text-amber-600 italic truncate">{w.note}</p>}
              </div>
              <button
                onClick={() => onDismissWaiterCall?.(w.timestamp)}
                className="shrink-0 px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-black text-[10px] font-black uppercase rounded-xl transition-all"
              >
                Ciente
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <SectionTitle
          title="Cozinha (KDS)"
          description="Gestão de produção em tempo real"
          icon={Utensils}
        />
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              viewMode === "grid" ? 'bg-white shadow-sm text-[#C9A227]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Cards
          </button>
          <button 
            onClick={() => setViewMode("consolidated")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              viewMode === "consolidated" ? 'bg-white shadow-sm text-[#C9A227]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            Resumo
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="space-y-6">
          {/* Pending (new orders) */}
          {pendingOrders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" />
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-yellow-600">
                  Novos Pedidos ({pendingOrders.length})
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {pendingOrders.map(order => (
                  <KDSTicket
                    key={order.id}
                    order={order}
                    onComplete={() => updateStatus(order.id, 'PREPARING')}
                    actionLabel="Iniciar Preparo"
                    highlight="yellow"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Preparing */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse" />
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-600">
                Em Preparo ({preparingOrders.length})
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {preparingOrders.map(order => (
                <KDSTicket
                  key={order.id}
                  order={order}
                  onComplete={() => updateStatus(order.id, 'SHIPPED')}
                  actionLabel="Concluir Pedido"
                  highlight="orange"
                />
              ))}
              {preparingOrders.length === 0 && pendingOrders.length === 0 && (
                <div className="col-span-full py-20 text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-200">
                    <Clock className="w-10 h-10" />
                  </div>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhum pedido na cozinha no momento</p>
                </div>
              )}
              {preparingOrders.length === 0 && pendingOrders.length > 0 && (
                <div className="col-span-full py-10 text-center">
                  <p className="text-sm text-slate-400">Nenhum pedido em preparo</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <ContentCard>
          <div className="space-y-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 pb-4">
              Total de Itens para Produção (Novos + Em Preparo)
            </p>
            {Object.keys(consolidated).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Nenhum item na fila</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(consolidated).map(([id, item]) => (
                  <div key={id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-sm font-black text-slate-800">{item.name}</span>
                    <span className="text-lg font-black text-[#C9A227] bg-white w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border border-[#C9A227]/10">
                      {item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ContentCard>
      )}
    </div>
  );
}

function KDSTicket({ order, onComplete, actionLabel = "Concluir Pedido", highlight = "orange" }: {
  order: Order;
  onComplete: () => void;
  actionLabel?: string;
  highlight?: "yellow" | "orange";
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(order.createdAt).getTime();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 60000));
    }, 10000);
    setElapsed(Math.floor((Date.now() - start) / 60000));
    return () => clearInterval(timer);
  }, [order.createdAt]);

  const getUrgencyColor = () => {
    if (highlight === "yellow") return "border-yellow-300 bg-yellow-50";
    if (elapsed > 20) return "border-red-500 bg-red-50/30";
    if (elapsed > 10) return "border-amber-500 bg-amber-50/30";
    return "border-slate-200 bg-white";
  };

  return (
    <motion.div
      layout
      className={`border-2 rounded-3xl p-5 space-y-4 flex flex-col shadow-sm transition-colors ${getUrgencyColor()}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-slate-800">#{order.id.slice(-4).toUpperCase()}</span>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
              order.orderType === 'DELIVERY' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
            }`}>
              {order.orderType === 'DELIVERY' ? 'Delivery' : order.orderType === 'DINE_IN' ? dineInOrderLabel(order) : 'Retirada'}
            </span>
          </div>
          <p className="text-xs font-bold text-slate-400 mt-1">{order.customerName}</p>
        </div>
        <div className="flex flex-col items-end">
          <div className={`flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full ${
            elapsed > 15 ? 'text-red-600 bg-red-100 animate-pulse' : 'text-slate-500 bg-slate-100'
          }`}>
            <Timer className="w-3.5 h-3.5" />
            {elapsed} min
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-2.5">
        {order.items.filter((item) => item.product?.kitchenPrint === true).map((item, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 bg-white/60 rounded-2xl border border-slate-100/50">
            <span className="text-sm font-black text-[#C9A227] min-w-[20px]">{item.quantity}x</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800 leading-tight">{item.product?.name}</p>
              {item.notes && (
                <div className="mt-1 flex items-start gap-1.5 text-[10px] font-black text-amber-600 uppercase tracking-tight italic">
                  <Bell className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>{item.notes}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {order.items.every((item) => item.product?.kitchenPrint !== true) && (
          <p className="text-xs text-slate-300 italic text-center py-4">Nenhum item de cozinha neste pedido</p>
        )}
      </div>

      <Button
        onClick={onComplete}
        variant="primary"
        className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 ${highlight === "yellow" ? "!bg-yellow-400 !text-black hover:!bg-yellow-300" : ""}`}
      >
        {actionLabel}
      </Button>
    </motion.div>
  );
}

