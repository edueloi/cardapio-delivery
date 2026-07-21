import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import socket from "../../lib/socket";
import { playTvPanelReadySound } from "../../lib/notificationSound";
import { announceOrderReady } from "../../lib/voiceAnnouncement";
import type { DisplayPanelConfig, DisplayPanelImage, Order, Tenant } from "../../types";
import { dineInOrderLabel } from "../../types";
import { motion, AnimatePresence } from "motion/react";
import {
  ChefHat,
  ShoppingBag,
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

const DEFAULT_DISPLAY_CONFIG: DisplayPanelConfig = {
  showDelivery: false,
  showPickup: true,
  showDineIn: true,
  voiceAnnouncement: true,
  theme: "dark",
  preparingColor: "#f97316",
  readyColor: "#22c55e",
  showLogo: true,
  readySoundFile: "/alerts/som_painel_cozinha.mp3",
  voiceName: null,
  carouselEnabled: true,
  carouselIntervalSeconds: 8,
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
function announceReadyOrder(order: Order, config: DisplayPanelConfig) {
  if (config.voiceAnnouncement === false) return;
  if (order.counterTicketNumber == null) return;
  announceOrderReady(order.counterTicketNumber, { voiceName: config.voiceName, text: config.voiceText });
}

/* ─── theme ───────────────────────────────────────────────── */
interface PanelTheme {
  bg: string;
  headerBg: string;
  cardBg: string;
  divider: string;
  textPrimary: string;
  textMuted: string;
  textFaint: string;
}

function buildTheme(mode: "dark" | "light"): PanelTheme {
  if (mode === "light") {
    return {
      bg: "#f4f5f7",
      headerBg: "rgba(255,255,255,0.92)",
      cardBg: "rgba(255,255,255,0.9)",
      divider: "rgba(15,23,42,0.08)",
      textPrimary: "#0f172a",
      textMuted: "rgba(15,23,42,0.45)",
      textFaint: "rgba(15,23,42,0.28)",
    };
  }
  return {
    bg: "#000000",
    headerBg: "rgba(0,0,0,0.95)",
    cardBg: "rgba(15,23,42,0.75)",
    divider: "rgba(255,255,255,0.06)",
    textPrimary: "#ffffff",
    textMuted: "rgba(255,255,255,0.35)",
    textFaint: "rgba(255,255,255,0.15)",
  };
}

/* ─── sub-components ──────────────────────────────────────── */

interface PreparingCardProps {
  order: Order;
  isFirst: boolean;
  theme: PanelTheme;
  accentColor: string;
}
function PreparingCard({ order, isFirst, theme, accentColor }: PreparingCardProps) {
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
          ? `linear-gradient(135deg, ${accentColor}30 0%, ${theme.cardBg} 100%)`
          : theme.cardBg,
        border: isFirst ? `1.5px solid ${accentColor}` : `1.5px solid ${theme.divider}`,
        borderRadius: 16,
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "18px 20px",
        position: "relative",
        backdropFilter: "blur(8px)",
        boxShadow: isFirst ? `0 4px 32px 0 ${accentColor}30` : "0 2px 12px 0 rgba(0,0,0,0.15)",
      }}
    >
      <span
        style={{
          fontSize: 34,
          fontWeight: 900,
          letterSpacing: "-1px",
          color: theme.textPrimary,
          minWidth: 110,
          fontFamily: "'Inter', monospace",
        }}
      >
        {orderCode(order)}
      </span>

      <div style={{ flex: 1, marginLeft: 16 }}>
        <p style={{ fontWeight: 800, fontSize: 17, color: theme.textPrimary, margin: 0, lineHeight: 1.1 }}>
          {order.customerName || "—"}
        </p>
        <p
          style={{
            fontWeight: 700,
            fontSize: 11,
            color: theme.textMuted,
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
  theme: PanelTheme;
  accentColor: string;
}
function ReadyCard({ order, theme, accentColor }: ReadyCardProps) {
  return (
    <motion.div
      layout
      key={order.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35 }}
      style={{
        background: theme.cardBg,
        border: `1.5px solid ${accentColor}40`,
        borderRadius: 16,
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "18px 20px",
        position: "relative",
        backdropFilter: "blur(8px)",
        boxShadow: "0 2px 12px 0 rgba(0,0,0,0.15)",
      }}
    >
      <span
        style={{
          fontSize: 34,
          fontWeight: 900,
          letterSpacing: "-1px",
          color: accentColor,
          minWidth: 110,
          fontFamily: "'Inter', monospace",
        }}
      >
        {orderCode(order)}
      </span>

      <div style={{ flex: 1, marginLeft: 16 }}>
        <p style={{ fontWeight: 800, fontSize: 17, color: theme.textPrimary, margin: 0, lineHeight: 1.1 }}>
          {order.customerName || "—"}
        </p>
        <p
          style={{
            fontWeight: 700,
            fontSize: 11,
            color: theme.textMuted,
            margin: "3px 0 0",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {orderLocation(order)}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          background: `${accentColor}20`,
          border: `1px solid ${accentColor}50`,
          borderRadius: 8,
          padding: "5px 10px",
          flexShrink: 0,
        }}
      >
        <Bell style={{ width: 12, height: 12, color: accentColor }} />
        <span style={{ fontWeight: 800, fontSize: 11, color: accentColor, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Pronto
        </span>
      </div>
    </motion.div>
  );
}

// Faixa de propaganda — alterna as imagens ativas a cada N segundos com fade. Se não
// houver imagens, o chamador simplesmente não renderiza este componente (as colunas de
// pedidos ocupam a tela inteira).
interface PromoCarouselProps {
  images: DisplayPanelImage[];
  intervalSeconds: number;
  theme: PanelTheme;
}
function PromoCarousel({ images, intervalSeconds, theme }: PromoCarouselProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [images.length]);

  useEffect(() => {
    if (images.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % images.length), Math.max(2, intervalSeconds) * 1000);
    return () => clearInterval(t);
  }, [images.length, intervalSeconds]);

  if (images.length === 0) return null;
  const current = images[index];

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        borderLeft: `1px solid ${theme.divider}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.img
          key={current.id}
          src={current.imageUrl}
          alt=""
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.6 }}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
      </AnimatePresence>
    </div>
  );
}

/* ─── main page ───────────────────────────────────────────── */
export default function PublicDashboardPage() {
  const { slug } = useParams();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [promoImages, setPromoImages] = useState<DisplayPanelImage[]>([]);
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

  const theme = useMemo(() => buildTheme(displayConfig.theme === "light" ? "light" : "dark"), [displayConfig.theme]);
  const preparingColor = displayConfig.preparingColor || DEFAULT_DISPLAY_CONFIG.preparingColor!;
  const readyColor = displayConfig.readyColor || DEFAULT_DISPLAY_CONFIG.readyColor!;

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

    const fetchPromoImages = async () => {
      if (!slug) return;
      try {
        const res = await fetch(`/api/tenants/${slug}/display-panel/images/public`);
        const data = await res.json();
        setPromoImages(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch promo images:", err);
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
    fetchPromoImages();

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

  const showCarousel = displayConfig.carouselEnabled !== false && promoImages.length > 0;

  useEffect(() => {
    if (activeReadyAnnouncement || readyAnnouncementQueue.length === 0) return;
    const [nextAnnouncement, ...remaining] = readyAnnouncementQueue;
    setActiveReadyAnnouncement(nextAnnouncement);
    setReadyAnnouncementQueue(remaining);
  }, [activeReadyAnnouncement, readyAnnouncementQueue]);

  useEffect(() => {
    if (!activeReadyAnnouncement) return;

    playTvPanelReadySound(displayConfig.readySoundFile);
    // pequeno atraso pra voz não sobrepor o som da campainha
    const voiceTimer = window.setTimeout(() => {
      announceReadyOrder(activeReadyAnnouncement, displayConfig);
    }, 900);
    const dismissTimer = window.setTimeout(() => {
      setActiveReadyAnnouncement(null);
    }, READY_ANNOUNCEMENT_DURATION_MS);

    return () => {
      window.clearTimeout(voiceTimer);
      window.clearTimeout(dismissTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReadyAnnouncement]);

  /* ─── loading ─── */
  if (!tenant)
    return (
      <div style={{ minHeight: "100vh", background: "#000000", display: "flex", alignItems: "center", justifyContent: "center" }}>
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.bg,
        color: theme.textPrimary,
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── CHAMADA DE SENHA ──────────────────────────────────── */}
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
              background: theme.bg,
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
                background: `radial-gradient(circle at center, ${readyColor}25 0%, ${readyColor}00 60%)`,
              }}
            />
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: [1, 1.015, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "relative",
                width: "min(92vw, 1400px)",
                minHeight: "min(78vh, 760px)",
                borderRadius: 36,
                border: `1px solid ${readyColor}55`,
                background: displayConfig.theme === "light"
                  ? "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.75) 100%)"
                  : "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                boxShadow: `0 30px 120px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 90px ${readyColor}25`,
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
                  border: `1px solid ${readyColor}40`,
                  background: `${readyColor}18`,
                  color: readyColor,
                }}
              >
                <Bell style={{ width: 18, height: 18 }} />
                <span style={{ fontSize: "clamp(0.8rem, 1.1vw, 1rem)", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.24em" }}>
                  Pedido pronto
                </span>
              </div>

              <span
                style={{
                  fontSize: "clamp(1.25rem, 2.6vw, 2.4rem)",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.5em",
                  color: theme.textMuted,
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
                  background: `linear-gradient(180deg, ${theme.textPrimary} 0%, ${readyColor} 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  filter: `drop-shadow(0 0 46px ${readyColor}90) drop-shadow(0 18px 40px rgba(0,0,0,0.5))`,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {readyAnnouncementCode(activeReadyAnnouncement)}
              </span>

              <span style={{ fontSize: "clamp(1rem, 2vw, 1.8rem)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em", color: readyColor }}>
                {readyAnnouncementSubtitle(activeReadyAnnouncement)}
              </span>

              <span style={{ fontSize: "clamp(0.95rem, 1.45vw, 1.25rem)", fontWeight: 700, color: theme.textMuted }}>
                {orderLocation(activeReadyAnnouncement)}
                {activeReadyAnnouncement.customerName ? ` • ${activeReadyAnnouncement.customerName}` : ""}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header
        style={{
          background: theme.headerBg,
          borderBottom: `1px solid ${theme.divider}`,
          padding: "0 28px",
          height: 76,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          backdropFilter: "blur(20px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {displayConfig.showLogo !== false && (
            tenant.logoUrl ? (
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
                style={{ height: 52, width: 52, objectFit: "cover", borderRadius: 12, background: theme.bg }}
              />
            ) : (
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  background: `${preparingColor}25`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Utensils style={{ width: 26, height: 26, color: preparingColor }} />
              </div>
            )
          )}

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: "-0.5px",
                textTransform: "uppercase",
                color: theme.textPrimary,
                lineHeight: 1,
              }}
            >
              {tenant.name}
            </h1>
            <p style={{ margin: "3px 0 0", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", color: theme.textMuted }}>
              Painel de Atendimento Digital
            </p>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-2px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end", marginTop: 2 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: readyColor, boxShadow: `0 0 6px ${readyColor}` }} />
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em", color: readyColor }}>
              Tempo Real
            </span>
          </div>
        </div>
      </header>

      {/* ── COLUNAS + CARROSSEL ────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, overflow: "hidden" }}>
          {/* ── EM PREPARO ─── */}
          <div style={{ display: "flex", flexDirection: "column", borderRight: `1px solid ${theme.divider}`, overflow: "hidden" }}>
            <div
              style={{
                padding: "16px 24px",
                background: `${preparingColor}14`,
                borderBottom: `2px solid ${preparingColor}4d`,
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexShrink: 0,
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${preparingColor}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChefHat style={{ width: 20, height: 20, color: preparingColor }} />
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, textTransform: "uppercase", color: preparingColor, fontStyle: "italic", letterSpacing: "-0.3px" }}>
                Em Preparo
              </h2>
            </div>

            <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              <AnimatePresence mode="popLayout">
                {preparingOrders.length === 0 ? (
                  <motion.div
                    key="empty-prep"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ textAlign: "center", padding: "48px 24px", color: theme.textFaint, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}
                  >
                    Nenhum pedido em preparo
                  </motion.div>
                ) : (
                  preparingOrders.map((order, i) => (
                    <PreparingCard key={order.id} order={order} isFirst={i === 0} theme={theme} accentColor={preparingColor} />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── PRONTO / RETIRE ─── */}
          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div
              style={{
                padding: "16px 24px",
                background: `${readyColor}12`,
                borderBottom: `2px solid ${readyColor}40`,
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexShrink: 0,
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${readyColor}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShoppingBag style={{ width: 20, height: 20, color: readyColor }} />
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, textTransform: "uppercase", color: readyColor, fontStyle: "italic", letterSpacing: "-0.3px" }}>
                Pronto / Retire
              </h2>
            </div>

            <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              <AnimatePresence mode="popLayout">
                {readyOrders.length === 0 ? (
                  <motion.div
                    key="empty-ready"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ textAlign: "center", padding: "48px 24px", color: theme.textFaint, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}
                  >
                    Nenhum pedido pronto
                  </motion.div>
                ) : (
                  readyOrders.map((order) => (
                    <ReadyCard key={order.id} order={order} theme={theme} accentColor={readyColor} />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {showCarousel && (
          <PromoCarousel images={promoImages} intervalSeconds={displayConfig.carouselIntervalSeconds || 8} theme={theme} />
        )}
      </div>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer
        style={{
          height: 46,
          background: theme.headerBg,
          borderTop: `1px solid ${theme.divider}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontStyle: "italic", color: theme.textMuted, fontWeight: 600 }}>
            {tenant.description ? `${tenant.name} — ${tenant.description}` : `${tenant.name} — Sabor que encanta, atendimento que acolhe.`}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: readyColor, boxShadow: `0 0 6px ${readyColor}` }} />
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em", color: theme.textMuted }}>
            Sistema de Filas Inteligente
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Globe style={{ width: 12, height: 12, color: theme.textMuted }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            {tenant?.slug}
          </span>
        </div>
      </footer>
    </div>
  );
}
