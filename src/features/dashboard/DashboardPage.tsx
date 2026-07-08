import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DashboardShell, useToast } from "../../components";
import { apiFetch, apiJson, AuthError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import socket from "../../lib/socket";
import type { Order, Tenant } from "../../types";
import DashboardContent from "./DashboardContent";
import { DASHBOARD_NAVIGATION } from "./config/navigation";
import { type DashboardOrderTabId, type DashboardTabId, type MyMembership, PATH_TO_TAB, TAB_TO_PATH, canAccess, OWNER_ONLY_TABS, ALL_PERMISSION_TABS } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { Bell, Receipt, ShoppingBag, X } from "lucide-react";

export default function DashboardPage() {
  const { slug, tab: tabParam, orderId } = useParams<{ slug: string; tab?: string; orderId?: string }>();
  const navigate = useNavigate();
  const { logout, account } = useAuth();
  const toast = useToast();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [subTab, setSubTab] = useState<DashboardOrderTabId>("pending");
  const [membership, setMembership] = useState<MyMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [checkoutRequests, setCheckoutRequests] = useState<Array<{ tableId: string; customerName: string; timestamp: number }>>([]);
  const [waiterCalls, setWaiterCalls] = useState<Array<{ tableId: string; customerName: string; note: string; requestBill: boolean; timestamp: number }>>([]);
  const [newOrderAlerts, setNewOrderAlerts] = useState<Array<{ id: string; customerName: string; orderType: string; total: number; timestamp: number }>>([]);

  const activeTab: DashboardTabId = (tabParam ? PATH_TO_TAB[tabParam] : undefined) ?? (orderId ? "history" : "overview");

  const navigateToTab = (tab: DashboardTabId) => {
    navigate(`/dashboard/${slug ?? ""}/${TAB_TO_PATH[tab]}`);
  };

  // Quando o membro não tem acesso à tela padrão (ex: operador de PDV sem permissão em "Visão Geral"),
  // manda direto para a primeira tela que ele pode ver, em vez de mostrar "Acesso restrito".
  useEffect(() => {
    if (!membership || tabParam) return;
    if (canAccess(membership, activeTab)) return;
    const firstAllowed = ALL_PERMISSION_TABS.find((tab) => canAccess(membership, tab));
    if (firstAllowed) navigateToTab(firstAllowed);
  }, [membership, activeTab, tabParam]);

  const fetchOrders = async (tenantId: string) => {
    try {
      const data = await apiJson<Order[]>(`/api/admin/${tenantId}/orders`);
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setOrders([]);
    }
  };

  const fetchTenant = async () => {
    if (!slug) {
      setTenant(null);
      setOrders([]);
      setLoading(false);
      return;
    }

    // Only show full loading if we don't have a tenant yet or slug changed
    if (!tenant || tenant.slug !== slug) {
      setLoading(true);
    }

    try {
      const data = await apiJson<Tenant>(`/api/admin/tenant/${slug}`);
      setTenant(data);
      socket.emit("join-tenant", data.id);
      await fetchOrders(data.id);
      try {
        const mem = await apiJson<MyMembership>(`/api/owner/tenants/${data.id}/my-membership`);
        setMembership(mem);
      } catch {
        setMembership(null);
      }
    } catch (err) {
      if (err instanceof AuthError) {
        // Token expirado — redireciona para login
        navigate(`/login?next=/dashboard/${slug}`, { replace: true });
        return;
      }
      // Erro transitório (servidor reiniciando) — tenta novamente em 3s
      setTimeout(() => void fetchTenant(), 3000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTenant();

    socket.on("new-order", (newOrder: Order) => {
      setOrders((prev) => (Array.isArray(prev) ? [newOrder, ...prev] : [newOrder]));
      new Audio("/notification.mp3").play().catch(() => undefined);
      setNewOrderAlerts((prev) => [
        { id: newOrder.id, customerName: newOrder.customerName, orderType: newOrder.orderType, total: newOrder.total, timestamp: Date.now() },
        ...prev,
      ]);
    });

    socket.on("order-status-updated", (updatedOrder: Order) => {
      setOrders((prev) => {
        if (!Array.isArray(prev)) return [];
        const oldOrder = prev.find((o) => o.id === updatedOrder.id);
        if (updatedOrder.kitchenReady && (!oldOrder || !oldOrder.kitchenReady)) {
          new Audio("/notification.mp3").play().catch(() => undefined);
          const who = updatedOrder.orderType === "DINE_IN"
            ? (updatedOrder.tableId ? `Mesa ${updatedOrder.tableId}` : `Senha ${String(updatedOrder.counterTicketNumber).padStart(2, "0")}`)
            : updatedOrder.customerName;
          toast.success(`Cozinha preparou os itens do pedido de ${who}!`);
        }
        return prev.map((order) => (order.id === updatedOrder.id ? updatedOrder : order));
      });
    });

    socket.on("inventory-update", ({ id, quantity }) => {
      setTenant(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          categories: prev.categories.map(cat => ({
            ...cat,
            products: cat.products.map(prod => {
              if (prod.inventoryItemId === id && prod.inventoryItem) {
                return {
                  ...prod,
                  inventoryItem: { ...prod.inventoryItem, quantity }
                };
              }
              return prod;
            })
          }))
        };
      });
    });

    socket.on("checkout-requested", ({ tableId, customerName }) => {
      new Audio("/notification.mp3").play().catch(() => undefined);
      setCheckoutRequests(prev => [
        { tableId, customerName, timestamp: Date.now() },
        ...prev
      ]);
    });

    socket.on("waiter-called", ({ tableId, customerName, note, requestBill }) => {
      new Audio("/notification.mp3").play().catch(() => undefined);
      setWaiterCalls(prev => [
        { tableId, customerName, note, requestBill, timestamp: Date.now() },
        ...prev
      ]);
    });

    // Cardápio/estoque mudou (em qualquer aba, dispositivo ou usuário) — recarrega
    // a árvore completa do tenant para manter tudo sincronizado sem precisar de F5.
    socket.on("menu-updated", () => {
      void fetchTenant();
    });

    // Comanda pronta pra servir — dispara em qualquer tela do dashboard, não só na do
    // Garçom, já que o(a) garçom pode estar em Mesas, Cardápio etc. quando a cozinha avisa.
    socket.on("comanda-ready", ({ tableId, customerName, operatorName }) => {
      new Audio("/notification.mp3").play().catch(() => undefined);
      const who = tableId ? `Mesa ${tableId}` : customerName || "Comanda";
      toast.success(`${who} está pronta para servir!${operatorName ? ` (${operatorName})` : ""}`);
    });

    return () => {
      socket.off("new-order");
      socket.off("order-status-updated");
      socket.off("checkout-requested");
      socket.off("waiter-called");
      socket.off("menu-updated");
      socket.off("comanda-ready");
    };
  }, [slug]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await apiFetch(`/api/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearTable = async (tableId: string) => {
    if (!tenant) return;
    try {
      await apiFetch(`/api/admin/${tenant.id}/table/${tableId}/clear`, {
        method: "POST"
      });
      setCheckoutRequests(prev => prev.filter(r => r.tableId !== tableId));
      fetchOrders(tenant.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearComanda = async (orderId: string) => {
    if (!tenant) return;
    try {
      await apiFetch(`/api/admin/${tenant.id}/comanda/${orderId}/clear`, {
        method: "POST"
      });
      fetchOrders(tenant.id);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredOrders = [...orders]
    .filter((order) => {
      if (activeTab === "live-orders") {
        if (subTab === "pending") return order.status === "PENDING";
        if (subTab === "preparing") return order.status === "PREPARING";
        if (subTab === "shipped") return order.status === "SHIPPED";
      }

      if (activeTab === "history") {
        return order.status === "DELIVERED" || order.status === "CANCELLED";
      }

      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1B3E] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Painel nao encontrado</h1>
        <p className="text-slate-400 mb-6">
          Nao conseguimos localizar as configuracoes para {slug}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/painel" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold">
            Ir para Meu Painel
          </Link>
          <Link to="/" className="bg-slate-100 text-slate-700 px-6 py-2 rounded-lg font-bold">
            Voltar ao Inicio
          </Link>
        </div>
      </div>
    );
  }

  // Filter navigation based on membership permissions
  const filteredNavigation = DASHBOARD_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.ownerOnly && membership?.role !== "OWNER") return false;
      return canAccess(membership, item.tab);
    }),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <DashboardShell
        tenantName={tenant.name}
        slug={slug ?? ""}
        activeTab={activeTab}
        navigationGroups={filteredNavigation}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen((current) => !current)}
        onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        onSelectTab={(tab) => {
          navigateToTab(tab as DashboardTabId);
          setIsMobileMenuOpen(false);
        }}
        onLogout={logout}
        isSuperAdmin={!!(account as any)?.isSuperAdmin}
        hideHeader={activeTab === "pos"}
      >
        <DashboardContent
          tenant={tenant}
          slug={slug ?? ""}
          orders={orders}
          activeTab={activeTab}
          setActiveTab={navigateToTab}
          subTab={subTab}
          setSubTab={setSubTab}
          filteredOrders={filteredOrders}
          refreshTenant={fetchTenant}
          updateStatus={updateStatus}
          activeOrderId={orderId}
          checkoutRequests={checkoutRequests}
          onClearTable={handleClearTable}
          onClearComanda={handleClearComanda}
          waiterCalls={waiterCalls}
          onDismissWaiterCall={(ts) => setWaiterCalls(prev => prev.filter(w => w.timestamp !== ts))}
          membership={membership}
        />
      </DashboardShell>

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
                onClick={() => {
                  navigateToTab("live-orders");
                  setNewOrderAlerts((prev) => prev.filter((a) => a.timestamp !== alert.timestamp));
                }}
                className="w-full bg-white text-emerald-600 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-colors"
              >
                Ver Pedido
              </button>
            </motion.div>
          ))}
          {waiterCalls.map((w) => (
            <motion.div
              key={w.timestamp}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
              className="pointer-events-auto bg-amber-500 text-black p-4 rounded-2xl shadow-2xl flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center animate-pulse">
                    <Bell className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">
                    {w.requestBill ? "Pedir Conta — " : "Garçom — "}Mesa {w.tableId}
                  </span>
                </div>
                <button onClick={() => setWaiterCalls(prev => prev.filter(c => c.timestamp !== w.timestamp))} className="p-1 hover:bg-black/10 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs font-bold opacity-70">{w.customerName}</p>
              {w.note && <p className="text-xs bg-black/10 rounded-xl px-3 py-2 italic">{w.note}</p>}
              <button
                onClick={() => setWaiterCalls(prev => prev.filter(c => c.timestamp !== w.timestamp))}
                className="w-full bg-black text-amber-400 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black/80 transition-colors"
              >
                Ciente
              </button>
            </motion.div>
          ))}
          {checkoutRequests.map((req) => (
            <motion.div
              key={req.timestamp}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
              className="pointer-events-auto bg-red-600 text-white p-4 rounded-2xl shadow-2xl border border-red-500 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">Fechar Mesa {req.tableId}</span>
                </div>
                <button
                  onClick={() => setCheckoutRequests(prev => prev.filter(r => r.timestamp !== req.timestamp))}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold opacity-60 uppercase">Cliente</p>
                <p className="text-sm font-black">{req.customerName}</p>
              </div>
              <button
                onClick={() => {
                  navigateToTab("pos");
                }}
                className="w-full bg-white text-red-600 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-colors"
              >
                Abrir no PDV
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
