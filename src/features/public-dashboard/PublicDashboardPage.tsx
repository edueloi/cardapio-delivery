import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import socket from "../../lib/socket";
import type { Order, Tenant } from "../../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  Clock, 
  ChefHat, 
  CheckCircle2, 
  Utensils, 
  ShoppingBag, 
  MapPin,
  ArrowRight,
  Bell
} from "lucide-react";

export default function PublicDashboardPage() {
  const { slug } = useParams();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  const fetchOrders = async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/tenants/${slug}/orders`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    }
  };

  useEffect(() => {
    const fetchTenant = async () => {
      if (!slug) return;
      try {
        const res = await fetch(`/api/tenants/${slug}`);
        const data = await res.json();
        setTenant(data);
        if (data.id) socket.emit("join-tenant", data.id);
      } catch (err) {
        console.error("Failed to fetch tenant:", err);
      }
    };

    fetchTenant();
    fetchOrders();

    socket.on("order-status-updated", () => fetchOrders());
    socket.on("new-order", () => fetchOrders());

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      socket.off("order-status-updated");
      socket.off("new-order");
      clearInterval(timer);
    };
  }, [slug]);

  // Quais tipos de pedido aparecem no Painel TV — configurável em Configurações.
  // Por padrão, Delivery fica de fora: um pedido entregue no endereço do cliente
  // nunca é "retirado" presencialmente, então não faz sentido chamar aqui.
  const displayConfig = useMemo(() => {
    const defaults = { showDelivery: false, showPickup: true, showDineIn: true };
    try {
      return tenant?.displayPanelConfig ? { ...defaults, ...JSON.parse(tenant.displayPanelConfig) } : defaults;
    } catch {
      return defaults;
    }
  }, [tenant?.displayPanelConfig]);

  const isOrderTypeVisible = (orderType: Order["orderType"]) => {
    if (orderType === "DELIVERY") return displayConfig.showDelivery;
    if (orderType === "DINE_IN") return displayConfig.showDineIn;
    return displayConfig.showPickup; // TAKEAWAY e demais tipos de retirada
  };

  const visibleOrders = orders.filter(o => isOrderTypeVisible(o.orderType));
  const preparingOrders = visibleOrders.filter(o => o.status === 'PREPARING');
  const readyOrders = visibleOrders.filter(o => o.status === 'SHIPPED').slice(0, 12);

  if (!tenant) return (
    <div className="min-h-screen bg-[#050A18] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050A18] text-white overflow-hidden font-sans flex flex-col">
      
      {/* ── HEADER (Ultra Modern) ────────────────────────────────────────── */}
      <header className="h-24 px-8 flex items-center justify-between border-b border-white/5 bg-white/[0.02] backdrop-blur-3xl relative z-10">
        <div className="flex items-center gap-6">
          {tenant.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.name} className="h-14 w-14 object-contain rounded-2xl bg-white p-2 shadow-2xl shadow-white/10" />
          ) : (
            <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-500/20 rotate-3">
              <Utensils className="w-10 h-10 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-4xl font-[1000] tracking-tighter uppercase bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
              {tenant?.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Painel de Atendimento Digital</span>
            </div>
          </div>
        </div>
        <div className="text-right bg-slate-800/50 px-8 py-4 rounded-[2rem] border border-slate-700/50 backdrop-blur-md">
          <div className="text-5xl font-black text-white tabular-nums tracking-tighter">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <p className="text-blue-500 font-black text-[10px] uppercase tracking-[0.4em] mt-1">Tempo Real</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex divide-x divide-slate-800 overflow-hidden">
        
        {/* Preparing Column */}
        <div className="flex-1 flex flex-col bg-slate-900/30">
          <div className="p-10 flex items-center gap-4 bg-orange-500/10 border-b border-orange-500/20">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-500 animate-pulse" />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tight text-orange-500 italic">Em Preparo</h2>
          </div>
          <div className="flex-1 p-10 overflow-y-auto no-scrollbar">
            <div className="grid grid-cols-2 gap-6">
              <AnimatePresence mode="popLayout">
                {preparingOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.1, opacity: 0 }}
                    className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50 flex flex-col items-center relative overflow-hidden group shadow-xl"
                  >
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500/40" />
                    
                    <div className="w-full flex justify-between items-start mb-4">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500/80 px-2 py-1 bg-orange-500/10 rounded-lg">
                        {order.orderType === 'DINE_IN' 
                          ? (order.tableId === 'Balcao' ? 'Balcão' : (order.tableId ? `Mesa ${order.tableId}` : 'Salão')) 
                          : order.orderType === 'DELIVERY' ? 'Delivery' : 'Retirada'}
                      </span>
                      <span className="text-xs font-bold text-slate-500 tabular-nums">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <span className="text-5xl font-black tracking-tighter text-white drop-shadow-sm">
                      #{order.id.slice(-4).toUpperCase()}
                    </span>
                    
                    <div className="mt-4 text-center">
                      <p className="text-sm font-black text-slate-300 uppercase tracking-wider truncate max-w-full">
                        {order.customerName}
                      </p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Iniciado agora</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Ready Column */}
        <div className="flex-1 flex flex-col">
          <div className="p-10 flex items-center gap-4 bg-green-500/10 border-b border-green-500/20">
            <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tight text-green-500 italic">Pronto / Retire</h2>
          </div>
          <div className="flex-1 p-10 overflow-y-auto no-scrollbar">
            <div className="grid grid-cols-1 gap-6">
              <AnimatePresence mode="popLayout">
                {readyOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ 
                       x: 0, 
                       opacity: 1,
                       backgroundColor: ["rgba(34, 197, 94, 0.15)", "rgba(30, 41, 59, 1)"],
                       transition: { duration: 1 }
                    }}
                    className="bg-slate-800 p-6 rounded-3xl border-2 border-green-500/20 flex items-center justify-between relative overflow-hidden shadow-2xl shadow-green-500/5 group"
                  >
                    <div className="absolute inset-0 bg-green-500/[0.02] animate-pulse" />
                    
                    <div className="flex items-center gap-6 relative z-10">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-green-400 mb-2 px-2 py-1 bg-green-500/10 rounded-lg w-fit">
                          {order.orderType === 'DINE_IN' 
                            ? (order.tableId === 'Balcao' ? 'Balcão' : (order.tableId ? `Mesa ${order.tableId}` : 'Mesa Salão')) 
                            : order.orderType === 'DELIVERY' ? 'Delivery Online' : 'Pedido Balcão'}
                        </span>
                        <span className="text-7xl font-black tracking-tighter text-green-400 drop-shadow-xl">
                          #{order.id.slice(-4).toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="h-16 w-px bg-slate-700" />
                      
                      <div>
                        <p className="text-4xl font-black text-white uppercase tracking-tight">
                          {order.customerName}
                        </p>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">Pode retirar seu pedido</p>
                      </div>
                    </div>

                    <div className="relative z-10 flex flex-col items-end gap-2">
                      <div className="bg-green-500 text-white px-6 py-4 rounded-[2rem] flex items-center gap-3 shadow-lg shadow-green-500/20 animate-bounce">
                        <Bell className="w-6 h-6" />
                        <span className="text-base font-black uppercase tracking-widest">Chamando</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="p-6 bg-slate-900 border-t border-slate-800 flex justify-center shrink-0">
         <div className="flex items-center gap-8 text-slate-500 font-bold text-xs uppercase tracking-widest">
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-green-500"></div>
               Sistema de Filas Inteligente
            </div>
            <div className="w-px h-4 bg-slate-800"></div>
            <span>{tenant?.slug}.com.br</span>
         </div>
      </footer>
    </div>
  );
}
