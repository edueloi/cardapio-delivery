import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiJson } from "../lib/api";
import { useAuth } from "../lib/auth";
import socket from "../lib/socket";
import type { Order, Tenant } from "../types";
import PDVPanel from "../features/dashboard/PDVPanel";
import { X } from "lucide-react";

export default function PDVPage() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [checkoutRequests, setCheckoutRequests] = useState<Array<{ tableId: string; customerName: string; timestamp: number }>>([]);
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
    fetchTenant();
    socket.on("new-order", (newOrder: Order) => {
      setOrders((prev) => [newOrder, ...prev]);
      new Audio("/notification.mp3").play().catch(() => {});
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
  }, [slug]);

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
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">PDV — Ponto de Venda</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-[10px] text-white/40 font-bold uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Online
            </span>
            <Link
              to={`/dashboard/${slug}/pdv`}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase text-white/40 hover:text-white transition-colors bg-white/5 px-3 py-2 rounded-xl"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Fechar</span>
            </Link>
          </div>
        </div>
      )}

      {/* PDV ocupa todo espaço restante */}
      <div className="flex-1 min-h-0 p-2 sm:p-3 pt-3 sm:pt-4">
        <PDVPanel
          tenant={tenant}
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
    </div>
  );
}
