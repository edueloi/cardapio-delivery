import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import socket from "../../lib/socket";
import type { Order, Tenant } from "../../types";
import { dineInOrderLabel } from "../../types";
import { motion, AnimatePresence } from "motion/react";
import {
  ChefHat,
  ShoppingBag,
  Clock,
  Bell,
  Globe,
  Utensils,
} from "lucide-react";

/* ─── helpers ─────────────────────────────────────────────── */
function orderCode(order: Order) {
  if (order.counterTicketNumber != null)
    return `#${String(order.counterTicketNumber).padStart(3, "0")}`;
  return `#${order.id.slice(-4).toUpperCase()}`;
}

function orderLocation(order: Order) {
  if (order.orderType === "DINE_IN") return dineInOrderLabel(order);
  if (order.orderType === "DELIVERY") return "Delivery";
  return "Balcão";
}

function orderTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function minutesAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

/* ─── sub-components ──────────────────────────────────────── */

interface PreparingCardProps {
  order: Order;
  isFirst: boolean;
}
function PreparingCard({ order, isFirst }: PreparingCardProps) {
  return (
    <motion.div
      layout
      key={order.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35 }}
      style={{
        background: isFirst
          ? "linear-gradient(135deg, rgba(234,88,12,0.18) 0%, rgba(30,41,59,0.85) 100%)"
          : "rgba(15,23,42,0.75)",
        border: isFirst ? "1.5px solid #ea580c" : "1.5px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "18px 20px",
        position: "relative",
        backdropFilter: "blur(8px)",
        boxShadow: isFirst
          ? "0 4px 32px 0 rgba(234,88,12,0.18)"
          : "0 2px 12px 0 rgba(0,0,0,0.3)",
      }}
    >
      {/* Code */}
      <span
        style={{
          fontSize: 34,
          fontWeight: 900,
          letterSpacing: "-1px",
          color: "#fff",
          minWidth: 110,
          fontFamily: "'Inter', monospace",
        }}
      >
        {orderCode(order)}
      </span>

      {/* Name + location */}
      <div style={{ flex: 1, marginLeft: 16 }}>
        <p
          style={{
            fontWeight: 800,
            fontSize: 17,
            color: "#fff",
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          {order.customerName || "—"}
        </p>
        <p
          style={{
            fontWeight: 700,
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            margin: "3px 0 0",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {orderLocation(order)}
        </p>
      </div>
    </motion.div>
  );
}

interface ReadyCardProps {
  order: Order;
}
function ReadyCard({ order }: ReadyCardProps) {
  return (
    <motion.div
      layout
      key={order.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35 }}
      style={{
        background: "rgba(15,23,42,0.75)",
        border: "1.5px solid rgba(34,197,94,0.25)",
        borderRadius: 16,
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "18px 20px",
        position: "relative",
        backdropFilter: "blur(8px)",
        boxShadow: "0 2px 12px 0 rgba(0,0,0,0.3)",
      }}
    >
      {/* Code */}
      <span
        style={{
          fontSize: 34,
          fontWeight: 900,
          letterSpacing: "-1px",
          color: "#22c55e",
          minWidth: 110,
          fontFamily: "'Inter', monospace",
        }}
      >
        {orderCode(order)}
      </span>

      {/* Name + location */}
      <div style={{ flex: 1, marginLeft: 16 }}>
        <p
          style={{
            fontWeight: 800,
            fontSize: 17,
            color: "#fff",
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          {order.customerName || "—"}
        </p>
        <p
          style={{
            fontWeight: 700,
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            margin: "3px 0 0",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {orderLocation(order)}
        </p>
      </div>

      {/* Pronto badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          background: "rgba(34,197,94,0.12)",
          border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: 8,
          padding: "5px 10px",
          flexShrink: 0,
        }}
      >
        <Bell style={{ width: 12, height: 12, color: "#22c55e" }} />
        <span
          style={{
            fontWeight: 800,
            fontSize: 11,
            color: "#22c55e",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Pronto
        </span>
      </div>
    </motion.div>
  );
}

/* ─── main page ───────────────────────────────────────────── */
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

  const displayConfig = useMemo(() => {
    const defaults = { showDelivery: false, showPickup: true, showDineIn: true };
    try {
      return tenant?.displayPanelConfig
        ? { ...defaults, ...JSON.parse(tenant.displayPanelConfig) }
        : defaults;
    } catch {
      return defaults;
    }
  }, [tenant?.displayPanelConfig]);

  const isOrderTypeVisible = (orderType: Order["orderType"]) => {
    if (orderType === "DELIVERY") return displayConfig.showDelivery;
    if (orderType === "DINE_IN") return displayConfig.showDineIn;
    return displayConfig.showPickup;
  };

  const visibleOrders = orders.filter((o) => isOrderTypeVisible(o.orderType));
  const preparingOrders = visibleOrders.filter((o) => o.status === "PREPARING");
  const readyOrders = visibleOrders
    .filter((o) => o.status === "SHIPPED")
    .slice(0, 8);

  /* ─── loading ─── */
  if (!tenant)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0d1b2a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            border: "4px solid #ea580c",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );

  /* ─── colours ─── */
  const BG = "#0d1b2a";
  const SURFACE = "rgba(255,255,255,0.03)";
  const DIVIDER = "rgba(255,255,255,0.06)";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: "#fff",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header
        style={{
          background: "rgba(10,20,35,0.95)",
          borderBottom: `1px solid ${DIVIDER}`,
          padding: "0 28px",
          height: 76,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Left: logo + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {tenant.logoUrl ? (
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              style={{
                height: 52,
                width: 52,
                objectFit: "contain",
                borderRadius: 12,
                background: "#fff",
                padding: 4,
              }}
            />
          ) : (
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                background: "rgba(234,88,12,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Utensils style={{ width: 26, height: 26, color: "#ea580c" }} />
            </div>
          )}

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: "-0.5px",
                textTransform: "uppercase",
                color: "#fff",
                lineHeight: 1,
              }}
            >
              {tenant.name}
            </h1>
            <p
              style={{
                margin: "3px 0 0",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.22em",
                color: "rgba(255,255,255,0.3)",
              }}
            >
              Painel de Atendimento Digital
            </p>
          </div>
        </div>

        {/* Right: clock */}
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 48,
              fontWeight: 900,
              letterSpacing: "-2px",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {currentTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              justifyContent: "flex-end",
              marginTop: 2,
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 6px #22c55e",
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: "#22c55e",
              }}
            >
              Tempo Real
            </span>
          </div>
        </div>
      </header>

      {/* ── COLUMNS ────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 0,
          overflow: "hidden",
        }}
      >
        {/* ── EM PREPARO ─── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            borderRight: `1px solid ${DIVIDER}`,
            overflow: "hidden",
          }}
        >
          {/* Column header */}
          <div
            style={{
              padding: "16px 24px",
              background: "rgba(234,88,12,0.08)",
              borderBottom: "2px solid rgba(234,88,12,0.3)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(234,88,12,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChefHat style={{ width: 20, height: 20, color: "#ea580c" }} />
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 900,
                textTransform: "uppercase",
                color: "#f97316",
                fontStyle: "italic",
                letterSpacing: "-0.3px",
              }}
            >
              Em Preparo
            </h2>
          </div>

          {/* Cards */}
          <div
            style={{
              flex: 1,
              padding: "16px 20px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <AnimatePresence mode="popLayout">
              {preparingOrders.length === 0 ? (
                <motion.div
                  key="empty-prep"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    textAlign: "center",
                    padding: "48px 24px",
                    color: "rgba(255,255,255,0.15)",
                    fontSize: 14,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                  }}
                >
                  Nenhum pedido em preparo
                </motion.div>
              ) : (
                preparingOrders.map((order, i) => (
                  <PreparingCard
                    key={order.id}
                    order={order}
                    isFirst={i === 0}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── PRONTO / RETIRE ─── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Column header */}
          <div
            style={{
              padding: "16px 24px",
              background: "rgba(34,197,94,0.07)",
              borderBottom: "2px solid rgba(34,197,94,0.25)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(34,197,94,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShoppingBag style={{ width: 20, height: 20, color: "#22c55e" }} />
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 900,
                textTransform: "uppercase",
                color: "#22c55e",
                fontStyle: "italic",
                letterSpacing: "-0.3px",
              }}
            >
              Pronto / Retire
            </h2>
          </div>

          {/* Cards */}
          <div
            style={{
              flex: 1,
              padding: "16px 20px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <AnimatePresence mode="popLayout">
              {readyOrders.length === 0 ? (
                <motion.div
                  key="empty-ready"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    textAlign: "center",
                    padding: "48px 24px",
                    color: "rgba(255,255,255,0.15)",
                    fontSize: 14,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                  }}
                >
                  Nenhum pedido pronto
                </motion.div>
              ) : (
                readyOrders.map((order, i) => (
                  <ReadyCard key={order.id} order={order} />
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer
        style={{
          height: 46,
          background: "rgba(8,16,28,0.95)",
          borderTop: `1px solid ${DIVIDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          flexShrink: 0,
        }}
      >
        {/* Left: slogan */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 11,
              fontStyle: "italic",
              color: "rgba(255,255,255,0.3)",
              fontWeight: 600,
            }}
          >
            {tenant.name} — Sabor que encanta, atendimento que acolhe.
          </span>
        </div>

        {/* Center: status */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#22c55e",
              boxShadow: "0 0 6px #22c55e",
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            Sistema de Filas Inteligente
          </span>
        </div>

        {/* Right: domain */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Globe style={{ width: 12, height: 12, color: "rgba(255,255,255,0.3)" }} />
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            {tenant?.slug}
          </span>
        </div>
      </footer>
    </div>
  );
}
