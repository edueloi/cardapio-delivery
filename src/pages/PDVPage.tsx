import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { apiFetch, apiJson } from "../lib/api";
import { useAuth } from "../lib/auth";
import socket from "../lib/socket";
import { playNotificationSound, playNewOrderSound, playKitchenReadySound } from "../lib/notificationSound";
import type { Order, Tenant } from "../types";
import { dineInOrderLabel } from "../types";
import { PDVPanel, WaiterPanel } from "../features/dashboard/pages";
import { ShoppingBag, X, BellRing } from "lucide-react";
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
  const [operatorName, setOperatorName] = useState<string | null>(null);
  const [checkoutRequests, setCheckoutRequests] = useState<Array<{ tableId: string; customerName: string; timestamp: number }>>([]);
  const [waiterCalls, setWaiterCalls] = useState<Array<{ tableId: string; customerName: string; note: string; requestBill: boolean; timestamp: number }>>([]);
  const [newOrderAlerts, setNewOrderAlerts] = useState<Array<{ id: string; customerName: string; orderType: string; total: number; timestamp: number }>>([]);
  const [kitchenReadyAlerts, setKitchenReadyAlerts] = useState<Array<{ id: string; label: string; timestamp: number }>>([]);
  const [loading, setLoading] = useState(true);

  const fetchTenant = async () => {
    if (!slug) return;
    try {
      const data = await apiJson<Tenant>(`/api/admin/tenant/${slug}`);
      setTenant(data);
      socket.emit("join-tenant", data.id);
      const ordersData = await apiJson<Order[]>(`/api/admin/${data.id}/orders`);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      apiJson<{ name: string | null }>(`/api/owner/tenants/${data.id}/my-membership`)
        .then((m) => setOperatorName(m.name || null))
        .catch(() => {});
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

    const handleNewOrder = (newOrder: Order) => {
      setOrders((prev) => [newOrder, ...prev]);
      playNewOrderSound();
      setNewOrderAlerts((prev) => [
        { id: newOrder.id, customerName: newOrder.customerName, orderType: newOrder.orderType, total: newOrder.total, timestamp: Date.now() },
        ...prev,
      ]);
    };

    const handleOrderStatusUpdated = (updatedOrder: Order) => {
      setOrders((prev) => {
        const oldOrder = prev.find((o) => o.id === updatedOrder.id);
        if (updatedOrder.kitchenReady && (!oldOrder || !oldOrder.kitchenReady)) {
          playKitchenReadySound();
          setKitchenReadyAlerts((alerts) => [
            { id: updatedOrder.id, label: dineInOrderLabel(updatedOrder), timestamp: Date.now() },
            ...alerts,
          ]);
        }
        return prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
      });
    };

    const handleCheckoutRequested = ({ tableId, customerName }: { tableId: string; customerName: string }) => {
      playNotificationSound();
      setCheckoutRequests((prev) => [{ tableId, customerName, timestamp: Date.now() }, ...prev]);
    };

    const handleWaiterCalled = ({ tableId, customerName, note, requestBill }: { tableId: string; customerName: string; note: string; requestBill: boolean }) => {
      playNotificationSound();
      setWaiterCalls((prev) => [{ tableId, customerName, note, requestBill, timestamp: Date.now() }, ...prev]);
    };

    socket.on("new-order", handleNewOrder);
    socket.on("order-status-updated", handleOrderStatusUpdated);
    socket.on("checkout-requested", handleCheckoutRequested);
    socket.on("waiter-called", handleWaiterCalled);

    return () => {
      socket.off("new-order", handleNewOrder);
      socket.off("order-status-updated", handleOrderStatusUpdated);
      socket.off("checkout-requested", handleCheckoutRequested);
      socket.off("waiter-called", handleWaiterCalled);
    };
  }, [slug, authLoading, isAuthenticated]);

  const handleClearTable = async (tableId: string) => {
    if (!tenant) return;
    try {
      await apiFetch(`/api/admin/${tenant.id}/table/${tableId}/clear`, { method: "POST" });
      setCheckoutRequests((prev) => prev.filter((r) => r.tableId !== tableId));
      const ordersData = await apiJson<Order[]>(`/api/admin/${tenant.id}/orders`);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch {}
  };

  const handleClearComanda = async (orderId: string) => {
    if (!tenant) return;
    try {
      await apiFetch(`/api/admin/${tenant.id}/comanda/${orderId}/clear`, { method: "POST" });
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

  const refreshOrders = () => {
    if (tenant) {
      apiJson<Order[]>(`/api/admin/${tenant.id}/orders`)
        .then((data) => setOrders(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  };

  if (isWaiterMode) {
    return (
      <div className={`fixed inset-0 flex flex-col overflow-hidden ${isDesktop ? "top-[40px]" : "top-0"}`}>
        <WaiterPanel
          tenant={tenant}
          operatorName={operatorName}
          onOrderCreated={refreshOrders}
          orders={orders}
          waiterCalls={waiterCalls}
        />
      </div>
    );
  }

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
                PDV — Ponto de Venda
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-[10px] text-white/40 font-bold uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Online
            </span>
          </div>
        </div>
      )}

      {/* PDV ocupa todo espaço restante */}
      <div className="flex-1 min-h-0 p-2 sm:p-3 pt-3 sm:pt-4">
        <PDVPanel
          tenant={tenant}
          mode={mode}
          operatorName={operatorName}
          onOrderCreated={refreshOrders}
          checkoutRequests={checkoutRequests}
          onClearTable={handleClearTable}
          onClearComanda={handleClearComanda}
          orders={orders}
        />
      </div>

      {/* Toasts de novo pedido do cardápio digital */}
      <div className="fixed bottom-6 right-6 z-[200] space-y-4 w-full max-w-md pointer-events-none">
        <AnimatePresence>
          {newOrderAlerts.map((alert) => (
            <motion.div
              key={alert.timestamp}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
              className="pointer-events-auto bg-emerald-500 text-white p-5 rounded-3xl shadow-2xl ring-4 ring-emerald-500/20 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center animate-bounce shrink-0">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-black uppercase tracking-widest">
                    Novo Pedido — {alert.orderType === "DELIVERY" ? "Delivery" : alert.orderType === "PICKUP" ? "Retirada" : "Mesa"}
                  </span>
                </div>
                <button
                  onClick={() => setNewOrderAlerts((prev) => prev.filter((a) => a.timestamp !== alert.timestamp))}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-lg font-black leading-tight">{alert.customerName}</p>
              <p className="text-sm font-bold opacity-80">
                Total: R$ {alert.total.toFixed(2).replace(".", ",")}
              </p>
              <button
                onClick={() => setNewOrderAlerts((prev) => prev.filter((a) => a.timestamp !== alert.timestamp))}
                className="w-full bg-white text-emerald-600 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-50 transition-colors"
              >
                Ciente
              </button>
            </motion.div>
          ))}
          {kitchenReadyAlerts.map((alert) => (
            <motion.div
              key={alert.timestamp}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
              className="pointer-events-auto bg-sky-500 text-white p-5 rounded-3xl shadow-2xl ring-4 ring-sky-500/20 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center animate-bounce shrink-0">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-black uppercase tracking-widest">Pronto na Cozinha</span>
                </div>
                <button
                  onClick={() => setKitchenReadyAlerts((prev) => prev.filter((a) => a.timestamp !== alert.timestamp))}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-lg font-black leading-tight">{alert.label}</p>
              <button
                onClick={() => setKitchenReadyAlerts((prev) => prev.filter((a) => a.timestamp !== alert.timestamp))}
                className="w-full bg-white text-sky-600 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-sky-50 transition-colors"
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
