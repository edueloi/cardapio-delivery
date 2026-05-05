import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Utensils, Bell, CheckCircle2, Clock } from "lucide-react";
import socket from "../../lib/socket";
import { Order, Tenant } from "../../types";
import { Badge, StatCard } from "../../components";

export default function PublicDashboardPage() {
  const { slug } = useParams();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const res = await fetch(`/api/tenants/${slug}/orders`);
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchTenant = async () => {
      const res = await fetch(`/api/tenants/${slug}`);
      const data = await res.json();
      setTenant(data);
    };

    fetchTenant();
    fetchOrders();

    const joinRoom = async () => {
      const res = await fetch(`/api/tenants/${slug}`);
      const data = await res.json();
      if (data?.id) {
        socket.emit("join-tenant", data.id);
      }
    };
    joinRoom();

    socket.on("order-status-updated", () => fetchOrders());
    socket.on("new-order", () => fetchOrders());

    return () => {
      socket.off("order-status-updated");
      socket.off("new-order");
    };
  }, [slug]);

  if (loading) return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const preparingOrders = orders.filter(o => o.status === 'PREPARING');
  const readyOrders = orders.filter(o => o.status === 'SHIPPED').slice(0, 10);

  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="p-8 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex justify-between items-center shrink-0">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 rotate-3">
             <Utensils className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">{tenant?.name}</h1>
            <Badge color="primary" size="sm" className="mt-1">Painel de Atendimento</Badge>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black text-blue-500 tabular-nums">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <p className="text-slate-500 font-black text-[10px] uppercase tracking-widest mt-1">Status em Tempo Real</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex divide-x divide-slate-800 overflow-hidden">
        
        {/* Preparing Column */}
        <div className="flex-1 flex flex-col bg-slate-900/30">
          <div className="p-10 flex items-center gap-4 bg-orange-500/10 border-b border-orange-500/20">
            <Clock className="w-8 h-8 text-orange-500 animate-pulse" />
            <h2 className="text-4xl font-black uppercase tracking-tight text-orange-500 italic">Em Preparo</h2>
          </div>
          <div className="flex-1 p-12 overflow-y-auto no-scrollbar">
            <div className="grid grid-cols-2 gap-8">
              <AnimatePresence mode="popLayout">
                {preparingOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.2, opacity: 0 }}
                    className="bg-slate-800/50 p-8 rounded-[32px] border border-slate-700/50 flex flex-col items-center justify-center relative overflow-hidden group shadow-xl"
                  >
                    <div className="absolute top-0 left-0 w-2 h-full bg-orange-500/50" />
                    <span className="text-7xl font-black tracking-titer text-slate-300">
                      #{order.id.slice(-3).toUpperCase()}
                    </span>
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest mt-4">
                      {order.customerName.split(' ')[0]}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Ready Column */}
        <div className="flex-1 flex flex-col">
          <div className="p-10 flex items-center gap-4 bg-green-500/10 border-b border-green-500/20">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <h2 className="text-4xl font-black uppercase tracking-tight text-green-500 italic">Pronto / Retire</h2>
          </div>
          <div className="flex-1 p-12 overflow-y-auto no-scrollbar">
            <div className="grid grid-cols-2 gap-8">
              <AnimatePresence mode="popLayout">
                {readyOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    initial={{ x: -100, opacity: 0 }}
                    animate={{ 
                       x: 0, 
                       opacity: 1,
                       backgroundColor: ["rgba(34, 197, 94, 0.2)", "rgba(30, 41, 59, 1)"],
                       transition: { duration: 1 }
                    }}
                    className="bg-slate-800 p-8 rounded-[32px] border-4 border-green-500/30 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl shadow-green-500/10"
                  >
                    <div className="absolute inset-0 bg-green-500/5 animate-pulse" />
                    <span className="text-8xl font-[1000] tracking-tighter text-green-400 drop-shadow-lg">
                      #{order.id.slice(-3).toUpperCase()}
                    </span>
                    <span className="text-sm font-black text-green-300 uppercase tracking-[0.3em] mt-4 flex items-center gap-2">
                       <Bell className="w-4 h-4 animate-bounce" />
                       Chamar Cliente
                    </span>
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
