import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardShell } from "../../components";
import { apiFetch, apiJson } from "../../lib/api";
import socket from "../../lib/socket";
import type { Order, Tenant } from "../../types";
import DashboardContent from "./DashboardContent";
import { DASHBOARD_NAVIGATION } from "./config/navigation";
import { type DashboardOrderTabId, type DashboardTabId } from "./types";

export default function DashboardPage() {
  const { slug } = useParams();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<DashboardTabId>("overview");
  const [subTab, setSubTab] = useState<DashboardOrderTabId>("pending");
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

    setLoading(true);

    try {
      const data = await apiJson<Tenant>(`/api/admin/tenant/${slug}`);
      setTenant(data);
      socket.emit("join-tenant", data.id);
      await fetchOrders(data.id);
    } catch {
      setTenant(null);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTenant();

    socket.on("new-order", (newOrder: Order) => {
      setOrders((prev) => (Array.isArray(prev) ? [newOrder, ...prev] : [newOrder]));
      new Audio("/notification.mp3").play().catch(() => undefined);
    });

    socket.on("order-status-updated", (updatedOrder: Order) => {
      setOrders((prev) =>
        Array.isArray(prev)
          ? prev.map((order) => (order.id === updatedOrder.id ? updatedOrder : order))
          : [],
      );
    });

    return () => {
      socket.off("new-order");
      socket.off("order-status-updated");
    };
  }, [slug]);

  const updateStatus = async (orderId: string, status: string) => {
    try {
      await apiFetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
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

  return (
    <DashboardShell
      tenantName={tenant.name}
      slug={slug ?? ""}
      activeTab={activeTab}
      navigationGroups={DASHBOARD_NAVIGATION}
      isMobileMenuOpen={isMobileMenuOpen}
      onToggleMobileMenu={() => setIsMobileMenuOpen((current) => !current)}
      onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
      onSelectTab={(tab) => {
        setActiveTab(tab as DashboardTabId);
        setIsMobileMenuOpen(false);
      }}
    >
      <DashboardContent
        tenant={tenant}
        slug={slug ?? ""}
        orders={orders}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        subTab={subTab}
        setSubTab={setSubTab}
        filteredOrders={filteredOrders}
        refreshTenant={fetchTenant}
        updateStatus={updateStatus}
      />
    </DashboardShell>
  );
}
