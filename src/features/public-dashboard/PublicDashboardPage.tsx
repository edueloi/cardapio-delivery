import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import socket from "../../lib/socket";
import { playTvPanelReadySound, primeAudioContext } from "../../lib/notificationSound";
import { announceOrderReady, primeSpeechSynthesis } from "../../lib/voiceAnnouncement";
import type { DisplayPanelConfig, DisplayPanelImage, Order, Tenant } from "../../types";
import { dineInOrderLabel } from "../../types";
import { motion, AnimatePresence } from "motion/react";
import {
  ChefHat,
  ShoppingBag,
  Bell,
  Globe,
  Utensils,
  Smartphone,
} from "lucide-react";

/* ─── helpers ─────────────────────────────────────────────── */
function orderCode(order: Order) {
  if (order.counterTicketNumber != null)
    return `#${String(order.counterTicketNumber).padStart(3, "0")}`;
  return `#${order.id.slice(-4).toUpperCase()}`;
}

// Primeiro nome do cliente, pra caber nos cards mais compactos sem estourar largura
// (ex: "Maria Eduarda Santos" -> "Maria"). Mesa/delivery sem nome cadastrado não mostra nada.
function orderFirstName(order: Order): string {
  return (order.customerName || "").trim().split(/\s+/)[0] || "";
}

// Três tracinhos decorativos ao lado do número chamado — o mesmo detalhe "raios" da
// referência visual do estilo Artesanal (tipo emoji ✨ desenhado à mão, não um ícone padrão).
function RayBurst({ color, flip = false }: { color: string; flip?: boolean }) {
  return (
    <svg width="28" height="48" viewBox="0 0 28 48" style={{ transform: flip ? "scaleX(-1)" : undefined, flexShrink: 0 }}>
      <line x1="2" y1="8" x2="14" y2="14" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="0" y1="24" x2="16" y2="24" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="2" y1="40" x2="14" y2="34" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function orderLocation(order: Order) {
  if (order.orderType === "DINE_IN") return dineInOrderLabel(order);
  if (order.orderType === "DELIVERY") return "Delivery";
  return "Balcão";
}

// Paleta fixa do estilo "Artesanal" — identidade visual própria (bege + marrom escuro),
// igual à referência de padaria/lanchonete artesanal. Ao contrário dos outros 5 estilos,
// não usa preparingColor/readyColor configuráveis do tenant — o visual é sempre este.
const ARTESANAL_DEFAULTS = {
  cream: "#F7F0E4",
  brown: "#3E2415",
};

// Clareia um hex por um fator (0-1) — usado pra derivar o "brownMid" (raios decorativos)
// a partir da cor marrom escolhida, sem precisar de um terceiro seletor de cor na tela
// de configuração.
function lightenHex(hex: string, factor: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * factor);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

// Paleta do estilo "Artesanal" — bege + marrom fixos por padrão (identidade visual
// própria, diferente das cores configuráveis preparingColor/readyColor dos outros 5
// estilos), mas o dono pode trocar as duas cores em Config. Painel TV e restaurar o
// padrão a qualquer momento.
function getArtesanalPalette(config: DisplayPanelConfig) {
  const cream = config.artesanalCreamColor || ARTESANAL_DEFAULTS.cream;
  const brown = config.artesanalBrownColor || ARTESANAL_DEFAULTS.brown;
  return { cream, brown, brownMid: lightenHex(brown, 0.25) };
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
  minimalMode: false,
  ticketCardSize: "normal",
  cardStyle: "floating",
};

const TICKET_CARD_SIZES: Record<NonNullable<DisplayPanelConfig["ticketCardSize"]>, { code: number; name: number; label: number; padding: string; gap: number }> = {
  normal: { code: 34, name: 17, label: 11, padding: "18px 20px", gap: 10 },
  large: { code: 64, name: 20, label: 12, padding: "28px 32px", gap: 16 },
  xlarge: { code: 96, name: 24, label: 13, padding: "40px 32px", gap: 20 },
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
  announceOrderReady(order.counterTicketNumber, { voiceName: config.voiceName, text: config.voiceText, customerName: order.customerName });
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

type CardRole = "preparing" | "ready";

interface OrderCardProps {
  order: Order;
  role: CardRole;
  isFirst: boolean;
  theme: PanelTheme;
  accentColor: string;
  size: DisplayPanelConfig["ticketCardSize"];
  cardStyle: DisplayPanelConfig["cardStyle"];
  minimal?: boolean;
}

function OrderCard({ order, role, isFirst, theme, accentColor, size, cardStyle, minimal }: OrderCardProps) {
  const s = TICKET_CARD_SIZES[size || "normal"];
  const isReady = role === "ready";
  const highlight = !isReady && isFirst; // "próximo da fila" só existe na coluna Em Preparo
  const motionProps = {
    layout: true as const,
    key: order.id,
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.35 },
  };

  if (minimal) {
    const firstName = orderFirstName(order);

    if (cardStyle === "ticket") {
      return (
        <motion.div
          {...motionProps}
          style={{
            background: theme.cardBg,
            border: `2px dashed ${isReady || highlight ? accentColor : theme.divider}`,
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: s.padding,
            position: "relative",
            fontFamily: "'Courier New', monospace",
          }}
        >
          <span style={{ fontSize: s.code, fontWeight: 900, color: isReady ? accentColor : theme.textPrimary, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {orderCode(order)}
          </span>
          {firstName && (
            <span style={{ fontSize: s.label, fontWeight: 700, color: theme.textMuted, marginTop: 4, textTransform: "uppercase" }}>
              {firstName}
            </span>
          )}
        </motion.div>
      );
    }

    if (cardStyle === "scoreboard") {
      return (
        <motion.div
          {...motionProps}
          style={{
            background: "#000000",
            border: `1px solid ${accentColor}50`,
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: s.padding,
            position: "relative",
            boxShadow: `inset 0 0 30px ${accentColor}15, 0 0 24px ${accentColor}25`,
          }}
        >
          <span
            style={{
              fontSize: s.code,
              fontWeight: 900,
              letterSpacing: "0.05em",
              color: accentColor,
              fontFamily: "'Courier New', monospace",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
              textShadow: `0 0 18px ${accentColor}, 0 0 36px ${accentColor}80`,
            }}
          >
            {orderCode(order)}
          </span>
          {firstName && (
            <span style={{ fontSize: s.label, fontWeight: 700, color: `${accentColor}CC`, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {firstName}
            </span>
          )}
        </motion.div>
      );
    }

    if (cardStyle === "fastfood") {
      return (
        <motion.div
          {...motionProps}
          style={{
            background: highlight ? `${accentColor}18` : theme.cardBg,
            borderLeft: `6px solid ${accentColor}`,
            borderRadius: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: s.padding,
            position: "relative",
          }}
        >
          <span
            style={{
              fontSize: s.code,
              fontWeight: 900,
              letterSpacing: "-0.5px",
              color: accentColor,
              fontFamily: "'Arial Narrow', 'Inter', sans-serif",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {orderCode(order)}
          </span>
          {firstName && (
            <span style={{ fontSize: s.label, fontWeight: 700, color: theme.textMuted, marginTop: 4, textTransform: "uppercase" }}>
              {firstName}
            </span>
          )}
        </motion.div>
      );
    }

    // floating (padrão)
    return (
      <motion.div
        {...motionProps}
        style={{
          background: highlight ? `linear-gradient(135deg, ${accentColor}30 0%, ${theme.cardBg} 100%)` : theme.cardBg,
          border: highlight ? `1.5px solid ${accentColor}` : `1.5px solid ${accentColor}${isReady ? "60" : "30"}`,
          borderRadius: 20,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: s.padding,
          position: "relative",
          backdropFilter: "blur(8px)",
          boxShadow: highlight ? `0 4px 32px 0 ${accentColor}30` : `0 2px 20px 0 ${accentColor}20`,
        }}
      >
        <span
          style={{
            fontSize: s.code,
            fontWeight: 900,
            letterSpacing: "-2px",
            color: isReady ? accentColor : theme.textPrimary,
            fontFamily: "'Inter', monospace",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {orderCode(order)}
        </span>
        {firstName && (
          <span style={{ fontSize: s.label, fontWeight: 700, color: theme.textMuted, marginTop: 4, textTransform: "uppercase" }}>
            {firstName}
          </span>
        )}
      </motion.div>
    );
  }

  switch (cardStyle) {
    case "ticket":
      return (
        <motion.div
          {...motionProps}
          style={{
            background: theme.cardBg,
            border: `2px dashed ${isReady ? accentColor : highlight ? accentColor : theme.divider}`,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            padding: s.padding,
            position: "relative",
            fontFamily: "'Courier New', monospace",
          }}
        >
          <span
            style={{
              fontSize: s.code,
              fontWeight: 900,
              color: isReady ? accentColor : theme.textPrimary,
              minWidth: s.code * 3,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {orderCode(order)}
          </span>
          <div style={{ flex: 1, marginLeft: 16, borderLeft: `1.5px dashed ${theme.divider}`, paddingLeft: 16 }}>
            <p style={{ fontWeight: 700, fontSize: s.name, color: theme.textPrimary, margin: 0, lineHeight: 1.1 }}>
              {order.customerName || "—"}
            </p>
            <p style={{ fontWeight: 600, fontSize: s.label, color: theme.textMuted, margin: "3px 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {orderLocation(order)}
            </p>
          </div>
          {isReady && (
            <span style={{ fontSize: s.label, fontWeight: 900, color: accentColor, textTransform: "uppercase", letterSpacing: "0.1em", flexShrink: 0 }}>
              ✓ Pronto
            </span>
          )}
        </motion.div>
      );

    case "scoreboard":
      return (
        <motion.div
          {...motionProps}
          style={{
            background: "#000000",
            border: `1px solid ${accentColor}50`,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            padding: s.padding,
            position: "relative",
            boxShadow: `inset 0 0 30px ${accentColor}15, 0 0 24px ${accentColor}25`,
          }}
        >
          <span
            style={{
              fontSize: s.code,
              fontWeight: 900,
              letterSpacing: "0.05em",
              color: accentColor,
              minWidth: s.code * 3.4,
              fontFamily: "'Courier New', monospace",
              fontVariantNumeric: "tabular-nums",
              textShadow: `0 0 18px ${accentColor}, 0 0 36px ${accentColor}80`,
            }}
          >
            {orderCode(order)}
          </span>
          <div style={{ flex: 1, marginLeft: 16 }}>
            <p style={{ fontWeight: 800, fontSize: s.name, color: "#e5e7eb", margin: 0, lineHeight: 1.1, textTransform: "uppercase" }}>
              {order.customerName || "—"}
            </p>
            <p style={{ fontWeight: 700, fontSize: s.label, color: `${accentColor}90`, margin: "3px 0 0", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {orderLocation(order)}
            </p>
          </div>
        </motion.div>
      );

    case "fastfood":
      return (
        <motion.div
          {...motionProps}
          style={{
            background: highlight ? `${accentColor}18` : theme.cardBg,
            borderLeft: `6px solid ${accentColor}`,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            padding: `${parseInt(s.padding) * 0.55}px 18px`,
            position: "relative",
          }}
        >
          <span
            style={{
              fontSize: s.code * 0.72,
              fontWeight: 900,
              letterSpacing: "-0.5px",
              color: accentColor,
              minWidth: s.code * 2.2,
              fontFamily: "'Arial Narrow', 'Inter', sans-serif",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {orderCode(order)}
          </span>
          <p style={{ flex: 1, marginLeft: 14, fontWeight: 800, fontSize: s.name, color: theme.textPrimary, margin: "0 0 0 14px", textTransform: "uppercase", letterSpacing: "0.02em" }}>
            {order.customerName || orderLocation(order)}
          </p>
          {isReady && <Bell style={{ width: s.label + 6, height: s.label + 6, color: accentColor, flexShrink: 0 }} />}
        </motion.div>
      );

    case "floating":
    default:
      return (
        <motion.div
          {...motionProps}
          style={{
            background: highlight
              ? `linear-gradient(135deg, ${accentColor}30 0%, ${theme.cardBg} 100%)`
              : theme.cardBg,
            border: highlight ? `1.5px solid ${accentColor}` : `1.5px solid ${isReady ? `${accentColor}40` : theme.divider}`,
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            padding: s.padding,
            position: "relative",
            backdropFilter: "blur(8px)",
            boxShadow: highlight ? `0 4px 32px 0 ${accentColor}30` : "0 2px 12px 0 rgba(0,0,0,0.15)",
          }}
        >
          <span
            style={{
              fontSize: s.code,
              fontWeight: 900,
              letterSpacing: "-1px",
              color: isReady ? accentColor : theme.textPrimary,
              minWidth: s.code * 3.2,
              fontFamily: "'Inter', monospace",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {orderCode(order)}
          </span>

          <div style={{ flex: 1, marginLeft: 16 }}>
            <p style={{ fontWeight: 800, fontSize: s.name, color: theme.textPrimary, margin: 0, lineHeight: 1.1 }}>
              {order.customerName || "—"}
            </p>
            <p
              style={{
                fontWeight: 700,
                fontSize: s.label,
                color: theme.textMuted,
                margin: "3px 0 0",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {orderLocation(order)}
            </p>
          </div>

          {isReady && (
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
          )}
        </motion.div>
      );
  }
}

// Layout "grade de senhas" — estilo painel físico de lanchonete/drive-thru: bloco inteiro
// com fundo sólido colorido, números brancos empilhados numa lista vertical única.
const GRID_NUMBER_SIZES: Record<NonNullable<DisplayPanelConfig["ticketCardSize"]>, number> = {
  normal: 80,
  large: 110,
  xlarge: 150,
};

interface GridColumnProps {
  orders: Order[];
  accentColor: string;
  size: DisplayPanelConfig["ticketCardSize"];
}
function GridColumn({ orders, accentColor, size }: GridColumnProps) {
  // Poucos pedidos = mais espaço sobrando na coluna, então a fonte cresce pra preencher;
  // muitos pedidos = precisa encolher pra caber sem cortar.
  const baseSize = GRID_NUMBER_SIZES[size || "normal"];
  const fontSize = orders.length <= 3 ? baseSize : orders.length <= 6 ? baseSize * 0.75 : baseSize * 0.55;
  return (
    <div style={{ background: accentColor, flex: 1, margin: "-16px -20px", padding: "24px 20px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
      <AnimatePresence mode="popLayout">
        {orders.map((order) => {
          const firstName = orderFirstName(order);
          return (
            <motion.div
              layout
              key={order.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ textAlign: "center", lineHeight: 1 }}
            >
              <div
                style={{
                  fontSize,
                  fontWeight: 900,
                  color: "#ffffff",
                  fontFamily: "'Arial Narrow', 'Inter', sans-serif",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {orderCode(order).replace("#", "")}
              </div>
              {firstName && (
                <div style={{ fontSize: fontSize * 0.22, fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", marginTop: 2 }}>
                  {firstName}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// Layout "Artesanal" — lista compacta "NOME número" numa linha por pedido (ex: "EDU
// 01"), estilo caderno de padaria/lanchonete artesanal. Sem nome cadastrado, mostra só
// o número. Fonte Fredoka (ver useEffect que injeta o link do Google Fonts).
const ARTESANAL_NUMBER_SIZES: Record<NonNullable<DisplayPanelConfig["ticketCardSize"]>, number> = {
  normal: 56,
  large: 72,
  xlarge: 92,
};
interface ArtesanalColumnProps {
  orders: Order[];
  textColor: string;
  size: DisplayPanelConfig["ticketCardSize"];
  sizePx?: number | null;
}
function ArtesanalColumn({ orders, textColor, size, sizePx }: ArtesanalColumnProps) {
  // ticketCardSizePx (campo "Tamanho personalizado (px)" na Config. Painel TV) sempre
  // sobrepõe o preset Normal/Grande/Extra Grande quando o dono preenche um valor.
  const baseSize = sizePx && sizePx > 0 ? sizePx : ARTESANAL_NUMBER_SIZES[size || "normal"];
  // vw como teto do clamp() faz o nome encolher sozinho em telas estreitas ou nomes
  // longos (ex: "Alexandre 007"), em vez de cortar/estourar a coluna como um px fixo faria.
  const scale = orders.length <= 4 ? 1 : orders.length <= 8 ? 0.75 : 0.55;
  const fontSize = `clamp(1rem, ${(baseSize / 16) * scale}vw, ${baseSize * scale}px)`;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: baseSize * scale * 0.35, padding: "8px 16px" }}>
      <AnimatePresence mode="popLayout">
        {orders.map((order) => {
          const firstName = orderFirstName(order);
          const code = orderCode(order);
          return (
            <motion.div
              layout
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                fontSize,
                fontWeight: 700,
                color: textColor,
                fontFamily: "'Fredoka', 'Arial Rounded MT Bold', sans-serif",
                textAlign: "center",
                lineHeight: 1.1,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {firstName ? `${code} - ${firstName}` : code}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
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
  const [audioUnlocked, setAudioUnlocked] = useState(false);
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
  const isArtesanal = displayConfig.cardStyle === "artesanal";
  const ARTESANAL_PALETTE = useMemo(() => getArtesanalPalette(displayConfig), [displayConfig.artesanalCreamColor, displayConfig.artesanalBrownColor]);

  // Fonte do estilo "Artesanal" — Fredoka (Google Fonts, gratuita), usada no lugar da
  // Cooper Black pedida como referência: mesmo visual arredondado/"gordinho", sem
  // depender de licenciamento nem de instalar fonte no computador que roda a TV.
  // Só carrega quando o estilo é usado, pra não pesar o painel em quem usa outro estilo.
  useEffect(() => {
    if (displayConfig.cardStyle !== "artesanal") return;
    const id = "artesanal-font-link";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&display=swap";
    document.head.appendChild(link);
  }, [displayConfig.cardStyle]);

  // O Painel de TV normalmente fica aberto numa tela sem ninguém tocar — e o navegador só
  // libera som/voz depois de um gesto real (clique/toque) NESSA aba especificamente. Sem
  // isso, "Chamar novamente" feito no painel de pedidos (outra aba/dispositivo) nunca produz
  // som aqui, mesmo funcionando o resto do fluxo. Um único clique/toque em qualquer lugar
  // da tela do painel destrava o resto da sessão.
  useEffect(() => {
    if (audioUnlocked) return;
    const unlock = () => {
      primeAudioContext();
      primeSpeechSynthesis();
      setAudioUnlocked(true);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [audioUnlocked]);

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
        height: "100vh",
        background: theme.bg,
        color: theme.textPrimary,
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── AVISO PRA DESTRAVAR SOM/VOZ ────────────────────────
          Navegador só libera áudio/fala nesta aba depois de 1 clique/toque real
          nela — some sozinho assim que o gesto acontece (ver useEffect acima). */}
      {!audioUnlocked && (
        <div
          style={{
            position: "fixed",
            top: 14,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(0,0,0,0.82)",
            color: "#ffffff",
            padding: "10px 20px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          <Bell style={{ width: 16, height: 16 }} />
          Toque na tela para ativar o som e a voz das chamadas
        </div>
      )}

      {/* ── CHAMADA DE SENHA ──────────────────────────────────── */}
      <AnimatePresence>
        {activeReadyAnnouncement && isArtesanal && (
          <motion.div
            key={`ready-announcement-artesanal-${activeReadyAnnouncement.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Wrapper próprio só pra animação de escala/posição — misturar um
                transform manual (translate de centralização) no MESMO elemento que
                a Framer Motion anima via scale fazia o transform manual ser
                sobrescrito pela lib assim que a animação rodava, jogando o card
                pro canto em vez de ficar centralizado. */}
            <motion.div
              initial={{ scale: 0.9, y: -20 }}
              animate={{ scale: [1, 1.02, 1], y: 0 }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 20,
              }}
            >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "clamp(12px, 2.5vw, 32px)",
                background: ARTESANAL_PALETTE.cream,
                border: `3px solid ${ARTESANAL_PALETTE.brown}`,
                borderRadius: 999,
                padding: "clamp(16px, 3vw, 32px) clamp(28px, 5vw, 64px)",
                boxShadow: "0 30px 90px rgba(0,0,0,0.45)",
                maxWidth: "88vw",
              }}
            >
              <RayBurst color={ARTESANAL_PALETTE.brownMid} />
              <span
                style={{
                  // vw como teto do clamp encolhe sozinho pra nomes longos não estourarem
                  // a largura da tela — só usar px fixo aqui já causou corte real em teste.
                  fontSize: "clamp(2rem, 7vw, 6rem)",
                  fontWeight: 700,
                  color: ARTESANAL_PALETTE.brown,
                  fontFamily: "'Fredoka', 'Arial Rounded MT Bold', sans-serif",
                  textTransform: "uppercase",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {activeReadyAnnouncement.customerName
                  ? `${orderFirstName(activeReadyAnnouncement).toUpperCase()} ${orderCode(activeReadyAnnouncement).replace("#", "")}`
                  : orderCode(activeReadyAnnouncement).replace("#", "")}
              </span>
              <RayBurst color={ARTESANAL_PALETTE.brownMid} flip />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: ARTESANAL_PALETTE.brown,
                borderRadius: 999,
                padding: "14px 32px",
              }}
            >
              <Bell style={{ width: 22, height: 22, color: ARTESANAL_PALETTE.cream }} />
              <span style={{ fontSize: "clamp(1rem, 2vw, 1.5rem)", fontWeight: 700, color: ARTESANAL_PALETTE.cream, fontFamily: "'Fredoka', 'Arial Rounded MT Bold', sans-serif" }}>
                {readyAnnouncementSubtitle(activeReadyAnnouncement)}
              </span>
            </div>
            </motion.div>
          </motion.div>
        )}
        {activeReadyAnnouncement && !isArtesanal && (
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
                borderRadius: displayConfig.cardStyle === "ticket" ? 10 : displayConfig.cardStyle === "fastfood" || displayConfig.cardStyle === "grid" ? 4 : displayConfig.cardStyle === "scoreboard" ? 8 : 36,
                border:
                  displayConfig.cardStyle === "ticket"
                    ? `3px dashed #ffffff`
                    : displayConfig.cardStyle === "fastfood" || displayConfig.cardStyle === "grid"
                    ? "none"
                    : displayConfig.cardStyle === "scoreboard"
                    ? `1px solid ${readyColor}50`
                    : `1px solid ${readyColor}55`,
                borderLeft: displayConfig.cardStyle === "fastfood" ? `10px solid ${readyColor}` : undefined,
                background:
                  displayConfig.cardStyle === "grid"
                    ? readyColor
                    : displayConfig.cardStyle === "scoreboard"
                    ? "#000000"
                    : displayConfig.cardStyle === "fastfood"
                    ? theme.cardBg
                    : displayConfig.theme === "light"
                    ? "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.75) 100%)"
                    : "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                boxShadow:
                  displayConfig.cardStyle === "grid"
                    ? "0 30px 120px rgba(0,0,0,0.6)"
                    : displayConfig.cardStyle === "scoreboard"
                    ? `inset 0 0 80px ${readyColor}18, 0 0 60px ${readyColor}30`
                    : `0 30px 120px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 90px ${readyColor}25`,
                backdropFilter: displayConfig.cardStyle === "scoreboard" || displayConfig.cardStyle === "grid" ? undefined : "blur(14px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "5vh 4vw",
                gap: 20,
                fontFamily: displayConfig.cardStyle === "ticket" || displayConfig.cardStyle === "scoreboard" ? "'Courier New', monospace" : undefined,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 18px",
                  borderRadius: 999,
                  border: `1px solid ${displayConfig.cardStyle === "grid" ? "#ffffff" : readyColor}40`,
                  background: displayConfig.cardStyle === "grid" ? "rgba(255,255,255,0.15)" : `${readyColor}18`,
                  color: displayConfig.cardStyle === "grid" ? "#ffffff" : readyColor,
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
                  color: displayConfig.cardStyle === "grid" ? "rgba(255,255,255,0.7)" : theme.textMuted,
                }}
              >
                {readyAnnouncementTitle(activeReadyAnnouncement)}
              </span>

              <span
                style={
                  displayConfig.cardStyle === "grid"
                    ? {
                        fontSize: "clamp(5rem, 17vw, 12rem)",
                        lineHeight: 0.9,
                        fontWeight: 900,
                        letterSpacing: "-0.02em",
                        color: "#ffffff",
                        fontVariantNumeric: "tabular-nums",
                      }
                    : displayConfig.cardStyle === "scoreboard"
                    ? {
                        fontSize: "clamp(5rem, 17vw, 12rem)",
                        lineHeight: 0.9,
                        fontWeight: 900,
                        letterSpacing: "0.05em",
                        color: readyColor,
                        textShadow: `0 0 40px ${readyColor}, 0 0 90px ${readyColor}90`,
                        fontVariantNumeric: "tabular-nums",
                      }
                    : displayConfig.cardStyle === "ticket" || displayConfig.cardStyle === "fastfood"
                    ? {
                        fontSize: "clamp(5rem, 17vw, 12rem)",
                        lineHeight: 0.9,
                        fontWeight: 900,
                        letterSpacing: "-0.02em",
                        color: readyColor,
                        fontVariantNumeric: "tabular-nums",
                      }
                    : {
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
                      }
                }
              >
                {readyAnnouncementCode(activeReadyAnnouncement)}
              </span>

              <span style={{ fontSize: "clamp(1rem, 2vw, 1.8rem)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em", color: displayConfig.cardStyle === "grid" ? "#ffffff" : readyColor }}>
                {readyAnnouncementSubtitle(activeReadyAnnouncement)}
              </span>

              <span style={{ fontSize: "clamp(0.95rem, 1.45vw, 1.25rem)", fontWeight: 700, color: displayConfig.cardStyle === "grid" ? "rgba(255,255,255,0.75)" : theme.textMuted }}>
                {orderLocation(activeReadyAnnouncement)}
                {activeReadyAnnouncement.customerName ? ` • ${activeReadyAnnouncement.customerName}` : ""}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HEADER — o estilo Artesanal não tem cabeçalho, PREPARANDO/PRONTOS já
          ocupam o topo da tela (ver referência visual) ─────────────────────── */}
      {!isArtesanal && !displayConfig.minimalMode && (
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
      )}

      {/* ── COLUNAS + CARROSSEL ────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, overflow: "hidden" }}>
          {/* ── EM PREPARO ─── */}
          <div style={{ display: "flex", flexDirection: "column", borderRight: isArtesanal ? "none" : `1px solid ${theme.divider}`, overflow: "hidden", background: isArtesanal ? ARTESANAL_PALETTE.cream : undefined }}>
            <div
              style={{
                padding: isArtesanal ? "28px 24px 14px" : "16px 24px",
                background: isArtesanal ? "transparent" : `${preparingColor}14`,
                borderBottom: isArtesanal ? "none" : `2px solid ${preparingColor}4d`,
                display: "flex",
                alignItems: "center",
                justifyContent: isArtesanal ? "center" : "flex-start",
                gap: 12,
                flexShrink: 0,
              }}
            >
              {!isArtesanal && (
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${preparingColor}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ChefHat style={{ width: 20, height: 20, color: preparingColor }} />
                </div>
              )}
              <h2
                style={
                  isArtesanal
                    ? { margin: 0, fontSize: "clamp(1.6rem, 3.2vw, 2.6rem)", fontWeight: 700, textTransform: "uppercase", color: ARTESANAL_PALETTE.brown, fontFamily: "'Fredoka', 'Arial Rounded MT Bold', sans-serif" }
                    : { margin: 0, fontSize: 22, fontWeight: 900, textTransform: "uppercase", color: preparingColor, fontStyle: "italic", letterSpacing: "-0.3px" }
                }
              >
                {isArtesanal ? "Preparando" : "Em Preparo"}
              </h2>
            </div>
            {isArtesanal && <div style={{ height: 1, background: `${ARTESANAL_PALETTE.brown}30`, margin: "0 auto", width: "60%" }} />}

            <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              {preparingOrders.length === 0 ? (
                isArtesanal ? null : (
                <motion.div
                  key="empty-prep"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ textAlign: "center", padding: "48px 24px", color: theme.textFaint, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}
                >
                  Nenhum pedido em preparo
                </motion.div>
                )
              ) : displayConfig.cardStyle === "grid" ? (
                <GridColumn orders={preparingOrders} accentColor={preparingColor} size={displayConfig.ticketCardSize} />
              ) : displayConfig.cardStyle === "artesanal" ? (
                <ArtesanalColumn orders={preparingOrders} textColor={ARTESANAL_PALETTE.brown} size={displayConfig.ticketCardSize} sizePx={displayConfig.ticketCardSizePx} />
              ) : (
                <AnimatePresence mode="popLayout">
                  {preparingOrders.map((order, i) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      role="preparing"
                      isFirst={i === 0}
                      theme={theme}
                      accentColor={preparingColor}
                      size={displayConfig.ticketCardSize}
                      cardStyle={displayConfig.cardStyle}
                      minimal={displayConfig.minimalMode}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* ── PRONTO / RETIRE ─── */}
          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: isArtesanal ? ARTESANAL_PALETTE.brown : undefined }}>
            <div
              style={{
                padding: isArtesanal ? "28px 24px 14px" : "16px 24px",
                background: isArtesanal ? "transparent" : `${readyColor}12`,
                borderBottom: isArtesanal ? "none" : `2px solid ${readyColor}40`,
                display: "flex",
                alignItems: "center",
                justifyContent: isArtesanal ? "center" : "flex-start",
                gap: 12,
                flexShrink: 0,
              }}
            >
              {!isArtesanal && (
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${readyColor}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShoppingBag style={{ width: 20, height: 20, color: readyColor }} />
                </div>
              )}
              <h2
                style={
                  isArtesanal
                    ? { margin: 0, fontSize: "clamp(1.6rem, 3.2vw, 2.6rem)", fontWeight: 700, textTransform: "uppercase", color: "#ffffff", fontFamily: "'Fredoka', 'Arial Rounded MT Bold', sans-serif" }
                    : { margin: 0, fontSize: 22, fontWeight: 900, textTransform: "uppercase", color: readyColor, fontStyle: "italic", letterSpacing: "-0.3px" }
                }
              >
                {isArtesanal ? "Prontos" : "Pronto / Retire"}
              </h2>
            </div>
            {isArtesanal && <div style={{ height: 1, background: "rgba(255,255,255,0.25)", margin: "0 auto", width: "60%" }} />}

            <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              {readyOrders.length === 0 ? (
                isArtesanal ? null : (
                <motion.div
                  key="empty-ready"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ textAlign: "center", padding: "48px 24px", color: theme.textFaint, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}
                >
                  Nenhum pedido pronto
                </motion.div>
                )
              ) : displayConfig.cardStyle === "grid" ? (
                <GridColumn orders={readyOrders} accentColor={readyColor} size={displayConfig.ticketCardSize} />
              ) : displayConfig.cardStyle === "artesanal" ? (
                <ArtesanalColumn orders={readyOrders} textColor="#ffffff" size={displayConfig.ticketCardSize} sizePx={displayConfig.ticketCardSizePx} />
              ) : (
                <AnimatePresence mode="popLayout">
                  {readyOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      role="ready"
                      isFirst={false}
                      theme={theme}
                      accentColor={readyColor}
                      size={displayConfig.ticketCardSize}
                      cardStyle={displayConfig.cardStyle}
                      minimal={displayConfig.minimalMode}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>

        {showCarousel && (
          <PromoCarousel images={promoImages} intervalSeconds={displayConfig.carouselIntervalSeconds || 8} theme={theme} />
        )}
      </div>

      {/* ── FOOTER "ARTESANAL" — QR code do balcão, mesmo padrão de URL usado em
          Mesas e QR Code (Table Management), pra abrir o cardápio digital ─────── */}
      {isArtesanal && !displayConfig.minimalMode && displayConfig.artesanalShowQrFooter !== false && (
        <footer
          style={{
            background: ARTESANAL_PALETTE.brown,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "22px 40px",
            gap: 28,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Smartphone style={{ width: 28, height: 28, color: "#ffffff" }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#ffffff", fontFamily: "'Fredoka', 'Arial Rounded MT Bold', sans-serif", letterSpacing: "0.02em" }}>
                Acesse nosso cardápio digital
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 15, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
                Escaneie o QR Code ao lado e confira nosso cardápio completo!
              </p>
            </div>
          </div>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(`${window.location.origin}/${tenant.slug}/balcao`)}`}
            alt="QR Code do cardápio"
            style={{ width: 140, height: 140, borderRadius: 12, background: "#ffffff", padding: 8, flexShrink: 0 }}
          />
        </footer>
      )}

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      {!isArtesanal && !displayConfig.minimalMode && (
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
      )}
    </div>
  );
}
