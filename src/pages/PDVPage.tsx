import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { apiJson } from "../lib/api";
import { useAuth } from "../lib/auth";
import socket from "../lib/socket";
import type { Order, Tenant } from "../types";
import PDVPanel from "../features/dashboard/PDVPanel";
import { ShoppingBag, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PDVPageProps {
  /** "waiter" = tela reduzida para garçons: só lança pedidos em mesa/comanda, sem caixa/pagamento. */
  mode?: "full" | "waiter";
}

export default function PDVPage({ mode = "full" }: PDVPageProps) {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isWaiterMode = mode === "waiter";
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [checkoutRequests, setCheckoutRequests] = useState<Array<{ tableId: string; customerName: string; timestamp: number }>>([]);
  const [newOrderAlerts, setNewOrderAlerts] = useState<Array<{ id: string; customerName: string; orderType: string; total: number; timestamp: number }>>([]);
  const [loading, setLoading] = useState(true);

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
      navigate(`/login?redirect=/${isWaiterMode ? "garcom" : "pdv"}/${slug}`);
      return;
    }
    fetchTenant();
    socket.on("new-order", (newOrder: Order) => {
      setOrders((prev) => [newOrder, ...prev]);
      new Audio("/notification.mp3").play().catch(() => {});
      setNewOrderAlerts((prev) => [
        { id: newOrder.id, customerName: newOrder.customerName, orderType: newOrder.orderType, total: newOrder.total, timestamp: Date.now() },
        ...prev,
      ]);
    });
    socket.on("order-status-updated", (updatedOrder: Order) => {
      setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
    });
    socket.on("checkout-requested", ({ tableId, customerName }) => {
      new Audio("/notification.mp3").play().catch(() => {});
      setCheckoutRequests((prev) => [{ tableId, customerName, timestamp: Date.now() }, ...prev]);
    });
    return () => {
      socket.off("new-order");
      socket.off("order-status-updated");
      socket.off("checkout-requested");
    };
  }, [slug, authLoading, isAuthenticated]);

  const handleClearTable = async (tableId: string) => {
    if (!tenant) return;
    try {
      await fetch(`/api/admin/${tenant.id}/table/${tableId}/clear`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      setCheckoutRequests((prev) => prev.filter((r) => r.tableId !== tableId));
      const ordersData = await apiJson<Order[]>(`/api/admin/${tenant.id}/orders`);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch {}
  };

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
          <p className="text-lg font-bold text-white">PDV não encontrado</p>
          <Link to={`/dashboard/${slug}`} className="text-[#C9A227] underline text-sm">
            Voltar ao painel
          </Link>
        </div>
      </div>
    );
  }

  const isDesktop = !!(window as any).pdvDesktop;

  return (
    <div className={`fixed inset-0 flex flex-col bg-[#f1f5f9] overflow-hidden ${isDesktop ? "top-[40px]" : "top-0"}`}>
      {/* Topbar — hidden inside Electron */}
      {!isDesktop && (
        <div className="bg-[#0D1B3E] text-white px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#C9A227] rounded-lg flex items-center justify-center font-black text-black text-xs">
              {tenant.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-black">{tenant.name}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                {isWaiterMode ? "Garçom — Lançar Pedidos" : "PDV — Ponto de Venda"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-[10px] text-white/40 font-bold uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Online
            </span>
            {!isWaiterMode && (
              <Link
                to={`/dashboard/${slug}/pdv`}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase text-white/40 hover:text-white transition-colors bg-white/5 px-3 py-2 rounded-xl"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Fechar</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* PDV ocupa todo espaço restante */}
      <div className="flex-1 min-h-0 p-2 sm:p-3 pt-3 sm:pt-4">
        <PDVPanel
          tenant={tenant}
          mode={mode}
          onOrderCreated={() => {
            if (tenant) {
              apiJson<Order[]>(`/api/admin/${tenant.id}/orders`)
                .then((data) => setOrders(Array.isArray(data) ? data : []))
                .catch(() => {});
            }
          }}
          checkoutRequests={checkoutRequests}
          onClearTable={handleClearTable}
          orders={orders}
        />
      </div>

      {/* Toasts de novo pedido do cardápio digital */}
      <div className="fixed bottom-6 right-6 z-[200] space-y-3 w-full max-w-xs pointer-events-none">
        <AnimatePresence>
          {newOrderAlerts.map((alert) => (
            <motion.div
              key={alert.timestamp}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
              className="pointer-events-auto bg-emerald-500 text-white p-4 rounded-2xl shadow-2xl flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-bounce">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">
                    Novo Pedido — {alert.orderType === "DELIVERY" ? "Delivery" : alert.orderType === "PICKUP" ? "Retirada" : "Mesa"}
                  </span>
                </div>
                <button
                  onClick={() => setNewOrderAlerts((prev) => prev.filter((a) => a.timestamp !== alert.timestamp))}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm font-black">{alert.customerName}</p>
              <p className="text-xs font-bold opacity-70">
                Total: R$ {alert.total.toFixed(2).replace(".", ",")}
              </p>
              <button
                onClick={() => setNewOrderAlerts((prev) => prev.filter((a) => a.timestamp !== alert.timestamp))}
                className="w-full bg-white text-emerald-600 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-colors"
              >
                Ciente
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
