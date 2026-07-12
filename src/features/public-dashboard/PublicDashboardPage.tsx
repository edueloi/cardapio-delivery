import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import socket from "../../lib/socket";
import { playTvPanelReadySound } from "../../lib/notificationSound";
import { announceOrderReady } from "../../lib/voiceAnnouncement";
import type { DisplayPanelConfig, Order, Tenant } from "../../types";
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

const DEFAULT_DISPLAY_CONFIG: DisplayPanelConfig = {
  showDelivery: false,
  showPickup: true,
  showDineIn: true,
  voiceAnnouncement: true,
};

const READY_ANNOUNCEMENT_DURATION_MS = 10000;

function isDisplayOrderVisible(orderType: Order["orderType"], config: DisplayPanelConfig) {
  if (orderType === "DELIVERY") return config.showDelivery;
  if (orderType === "DINE_IN") return config.showDineIn;
  return config.showPickup;
}

function readyAnnouncementTitle(order: Order) {
  if (order.counterTicketNumber != null) return "SENHA";
  if (order.tableId) return "MESA";
  return "PEDIDO";
}

function readyAnnouncementCode(order: Order) {
  if (order.counterTicketNumber != null) {
    return `N${String(order.counterTicketNumber).padStart(3, "0")}`;
  }
  if (order.tableId) return String(order.tableId).toUpperCase();
  return orderCode(order).replace("#", "");
}

function readyAnnouncementSubtitle(order: Order) {
  if (order.counterTicketNumber != null) return "Retire seu pedido no balcão";
  if (order.orderType === "DINE_IN" && order.tableId) return "Seu pedido está pronto para servir";
  if (order.orderType === "DELIVERY") return "Pedido pronto para retirada";
  return "Seu pedido está pronto";
}

// Só anunciamos por voz pedidos de balcão/comanda (têm senha numérica).
// Mesa e delivery não têm "senha" para chamar em voz alta. `voiceEnabled` vem da
// configuração do painel — o dono pode desligar a fala e manter só o som/visual.
function announceReadyOrder(order: Order, voiceEnabled: boolean) {
  if (!voiceEnabled) return;
  if (order.counterTicketNumber == null) return;
  announceOrderReady(order.counterTicketNumber);
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
  const [readyAnnouncementQueue, setReadyAnnouncementQueue] = useState<Order[]>([]);
  const [activeReadyAnnouncement, setActiveReadyAnnouncement] = useState<Order | null>(null);
  const ordersRef = useRef<Order[]>([]);
  const displayConfigRef = useRef<DisplayPanelConfig>(DEFAULT_DISPLAY_CONFIG);
  const announcedReadyIdsRef = useRef<Set<string>>(new Set());

  const fetchOrders = async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/tenants/${slug}/orders`);
      const data = await res.json();
      const nextOrders: Order[] = Array.isArray(data) ? data : [];

      // Detecta pedidos que viraram SHIPPED desde o último fetch/evento conhecido —
      // cobre o caso do socket estar "zumbi" (conectado mas fora da room), onde o
      // polling é quem primeiro percebe a mudança e precisa disparar o aviso sonoro.
      for (const order of nextOrders) {
        const previousOrder = ordersRef.current.find((o) => o.id === order.id);
        if (order.status === "SHIPPED" && previousOrder?.status !== "SHIPPED") {
          enqueueReadyAnnouncement(order);
        }
      }

      setOrders(nextOrders);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    }
  };

  const displayConfig = useMemo(() => {
    try {
      return tenant?.displayPanelConfig
        ? { ...DEFAULT_DISPLAY_CONFIG, ...JSON.parse(tenant.displayPanelConfig) }
        : DEFAULT_DISPLAY_CONFIG;
    } catch {
      return DEFAULT_DISPLAY_CONFIG;
    }
  }, [tenant?.displayPanelConfig]);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    displayConfigRef.current = displayConfig;
  }, [displayConfig]);

  const isOrderTypeVisible = (orderType: Order["orderType"]) => {
    return isDisplayOrderVisible(orderType, displayConfig);
  };

  const enqueueReadyAnnouncement = (order: Order) => {
    if (order.status !== "SHIPPED") return;
    if (!isDisplayOrderVisible(order.orderType, displayConfigRef.current)) return;
    if (announcedReadyIdsRef.current.has(order.id)) return;

    announcedReadyIdsRef.current.add(order.id);
    setReadyAnnouncementQueue((prev) => [...prev, order]);
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

    const upsertOrder = (incomingOrder: Order) => {
      setOrders((prev) => {
        const exists = prev.some((order) => order.id === incomingOrder.id);
        if (!exists) return [incomingOrder, ...prev];
        return prev.map((order) => (order.id === incomingOrder.id ? incomingOrder : order));
      });
    };

    const handleOrderStatusUpdated = (updatedOrder: Order) => {
      const previousOrder = ordersRef.current.find((order) => order.id === updatedOrder.id);
      if (updatedOrder.status === "SHIPPED" && previousOrder?.status !== "SHIPPED") {
        enqueueReadyAnnouncement(updatedOrder);
      }
      upsertOrder(updatedOrder);
    };

    const handleNewOrder = (newOrder: Order) => {
      upsertOrder(newOrder);
    };

    // Operador pediu pra chamar de novo (cliente não apareceu/não ouviu da primeira vez) —
    // ignora o "já anunciado" e força a fila de novo.
    const handleReannounce = (order: Order) => {
      if (!isDisplayOrderVisible(order.orderType, displayConfigRef.current)) return;
      setReadyAnnouncementQueue((prev) => [...prev, order]);
    };

    fetchTenant();
    fetchOrders();

    socket.on("order-status-updated", handleOrderStatusUpdated);
    socket.on("new-order", handleNewOrder);
    socket.on("order-reannounced", handleReannounce);

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Rede de segurança: independente do socket estar conectado/na room certa,
    // rebusca os pedidos periodicamente. Isso cobre o Painel de TV rodando dentro
    // de um WebView (Fire Stick/Android TV) fixo 24h, onde ninguém percebe (nem
    // consegue dar F5 facilmente) se o socket ficar "zumbi" — conectado mas surdo.
    const pollTimer = setInterval(() => {
      fetchOrders();
    }, 15000);

    return () => {
      socket.off("order-status-updated", handleOrderStatusUpdated);
      socket.off("new-order", handleNewOrder);
      socket.off("order-reannounced", handleReannounce);
      clearInterval(timer);
      clearInterval(pollTimer);
    };
  }, [slug]);

  const visibleOrders = orders.filter((o) => isOrderTypeVisible(o.orderType));
  const preparingOrders = visibleOrders.filter((o) => o.status === "PREPARING");
  const readyOrders = visibleOrders
    .filter((o) => o.status === "SHIPPED")
    .slice(0, 8);

  useEffect(() => {
    if (activeReadyAnnouncement || readyAnnouncementQueue.length === 0) return;
    const [nextAnnouncement, ...remaining] = readyAnnouncementQueue;
    setActiveReadyAnnouncement(nextAnnouncement);
    setReadyAnnouncementQueue(remaining);
  }, [activeReadyAnnouncement, readyAnnouncementQueue]);

  useEffect(() => {
    if (!activeReadyAnnouncement) return;

    playTvPanelReadySound();
    // pequeno atraso pra voz não sobrepor o som da campainha
    const voiceTimer = window.setTimeout(() => {
      announceReadyOrder(activeReadyAnnouncement, displayConfig.voiceAnnouncement !== false);
    }, 900);
    const dismissTimer = window.setTimeout(() => {
      setActiveReadyAnnouncement(null);
    }, READY_ANNOUNCEMENT_DURATION_MS);

    return () => {
      window.clearTimeout(voiceTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [activeReadyAnnouncement]);

  /* ─── loading ─── */
  if (!tenant)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#000000",
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
  const BG = "#000000";
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
      <AnimatePresence>
        {activeReadyAnnouncement && (
          <motion.div
            key={`ready-announcement-${activeReadyAnnouncement.id}`}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.35 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              background: "#000000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(circle at center, rgba(201,162,39,0.20) 0%, rgba(201,162,39,0) 60%)",
              }}
            />
            <div
              style={{
                position: "relative",
                width: "min(92vw, 1400px)",
                minHeight: "min(78vh, 760px)",
                borderRadius: 36,
                border: "1px solid rgba(201,162,39,0.35)",
                background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                boxShadow: "0 30px 120px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
                backdropFilter: "blur(14px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "5vh 4vw",
                gap: 20,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 18px",
                  borderRadius: 999,
                  border: "1px solid rgba(34,197,94,0.25)",
                  background: "rgba(34,197,94,0.08)",
                  color: "#86efac",
                }}
              >
                <Bell style={{ width: 18, height: 18 }} />
                <span
                  style={{
                    fontSize: "clamp(0.8rem, 1.1vw, 1rem)",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.24em",
                  }}
                >
                  Pedido pronto
                </span>
              </div>

              <span
                style={{
                  fontSize: "clamp(1.25rem, 2.6vw, 2.4rem)",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.5em",
                  color: "rgba(255,255,255,0.78)",
                }}
              >
                {readyAnnouncementTitle(activeReadyAnnouncement)}
              </span>

              <span
                style={{
                  fontSize: "clamp(5rem, 17vw, 12rem)",
                  lineHeight: 0.9,
                  fontWeight: 900,
                  letterSpacing: "-0.04em",
                  background: "linear-gradient(180deg, #ffffff 0%, #f3d98a 55%, #C9A227 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 0 46px rgba(201,162,39,0.55)) drop-shadow(0 18px 40px rgba(0,0,0,0.5))",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {readyAnnouncementCode(activeReadyAnnouncement)}
              </span>

              <span
                style={{
                  fontSize: "clamp(1rem, 2vw, 1.8rem)",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: "#C9A227",
                }}
              >
                {readyAnnouncementSubtitle(activeReadyAnnouncement)}
              </span>

              <span
                style={{
                  fontSize: "clamp(0.95rem, 1.45vw, 1.25rem)",
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.62)",
                }}
              >
                {orderLocation(activeReadyAnnouncement)}
                {activeReadyAnnouncement.customerName ? ` • ${activeReadyAnnouncement.customerName}` : ""}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <header
        style={{
          background: "rgba(0,0,0,0.95)",
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
                objectFit: "cover",
                borderRadius: 12,
                background: "#000",
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
          background: "rgba(0,0,0,0.95)",
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
            {tenant.description ? `${tenant.name} — ${tenant.description}` : `${tenant.name} — Sabor que encanta, atendimento que acolhe.`}
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
