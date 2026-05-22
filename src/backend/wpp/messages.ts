import { prisma } from "../../lib/prisma";
import { sendMessage } from "./baileys-manager";

function fmt(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function formatItems(items: Array<{ quantity: number; price: number; notes?: string | null; product?: { name?: string | null } | null; productVariant?: { name?: string | null } | null }>): string {
  return items.map((item) => {
    const variantName = item.productVariant?.name ? ` (${item.productVariant.name})` : "";
    const notes = item.notes ? ` — _${item.notes}_` : "";
    return `• ${item.quantity}x ${item.product?.name || "Item"}${variantName} ${fmt(item.price * item.quantity)}${notes}`;
  }).join("\n");
}

async function canSend(tenantId: string, field: "sendOrderCreated" | "sendStatusUpdates"): Promise<{ allowed: boolean; config: any }> {
  const [instance, config] = await Promise.all([
    prisma.wppInstance.findUnique({ where: { tenantId } }),
    prisma.wppBotConfig.findUnique({ where: { tenantId } }),
  ]);
  if (!instance || instance.status !== "connected") return { allowed: false, config };
  if (!config?.botEnabled) return { allowed: false, config };
  return { allowed: !!config[field], config };
}

// ─── Customer: order created ──────────────────────────────────────────────────

export async function sendOrderCreatedMessage(order: {
  tenantId: string;
  customerPhone: string;
  customerName: string;
  total: number;
  orderType: string;
  paymentMethod?: string;
  address?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  items: Array<{ quantity: number; price: number; notes?: string | null; product?: { name?: string | null } | null; productVariant?: { name?: string | null } | null }>;
}, tenant: { name: string; slug: string }) {
  const { allowed, config } = await canSend(order.tenantId, "sendOrderCreated");
  if (!allowed) return;

  const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const typeLabel = order.orderType === "PICKUP" ? "🏪 Retirada no balcão" : "🛵 Entrega";
  const payLabel: Record<string, string> = { PIX: "PIX", CREDIT: "Cartão de crédito", DEBIT: "Cartão de débito", MEAL: "Vale-refeição", CASH: "Dinheiro" };

  let dateStr = "";
  let scheduledLine = "";
  if (order.scheduledDate) {
    const d = new Date(order.scheduledDate + "T12:00:00");
    dateStr = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    const timeStr = order.scheduledTime ? ` às ${order.scheduledTime}` : "";
    scheduledLine = `\n📅 *Encomenda para:* ${dateStr}${timeStr}`;
  }

  // Se é encomenda e o dono configurou mensagem customizada, usá-la
  if (order.scheduledDate && config?.preorderMessage) {
    const customText = config.preorderMessage
      .replace(/\{nome\}/g, order.customerName)
      .replace(/\{data\}/g, dateStr)
      .replace(/\{hora\}/g, order.scheduledTime || "")
      .replace(/\{total\}/g, fmt(order.total));
    await sendMessage(order.tenantId, order.customerPhone, customText);
    return;
  }

  const text =
    `${order.scheduledDate ? "📦" : "✅"} *Pedido recebido em ${tenant.name}!*\n\n` +
    `Olá, ${order.customerName}! Seu pedido foi ${order.scheduledDate ? "registrado como encomenda" : "enviado para a cozinha 👨‍🍳"}.\n\n` +
    `📋 *Resumo:*\n${formatItems(order.items)}\n\n` +
    `💰 *Total:* ${fmt(order.total)}\n` +
    `${typeLabel}\n` +
    (order.orderType === "DELIVERY" && order.address ? `📍 Entrega em: ${order.address}\n` : "") +
    `💳 Pagamento: ${payLabel[order.paymentMethod || ""] || order.paymentMethod || "Não informado"}` +
    scheduledLine + `\n\n` +
    `Acompanhe seu pedido aqui:\n${baseUrl}/${tenant.slug}`;

  await sendMessage(order.tenantId, order.customerPhone, text);
}

// ─── Owner: new order alert ───────────────────────────────────────────────────

export async function sendOwnerOrderAlert(order: {
  tenantId: string;
  customerName: string;
  customerPhone: string;
  total: number;
  orderType: string;
  address?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  items: Array<{ quantity: number; price: number; notes?: string | null; product?: { name?: string | null } | null; productVariant?: { name?: string | null } | null }>;
}, tenant: { name: string; slug: string; whatsapp?: string | null }) {
  if (!tenant.whatsapp) return;

  const instance = await prisma.wppInstance.findUnique({ where: { tenantId: order.tenantId } });
  const config = await prisma.wppBotConfig.findUnique({ where: { tenantId: order.tenantId } });
  if (!instance || instance.status !== "connected" || !config?.botEnabled) return;

  const typeLabel = order.orderType === "PICKUP" ? "🏪 Retirada" : "🛵 Entrega";

  let scheduledLine = "";
  if (order.scheduledDate) {
    const d = new Date(order.scheduledDate + "T12:00:00");
    const dateStr = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    const timeStr = order.scheduledTime ? ` às ${order.scheduledTime}` : "";
    scheduledLine = `\n📅 *ENCOMENDA para:* ${dateStr}${timeStr}`;
  }

  const text =
    `${order.scheduledDate ? "📦" : "🔔"} *${order.scheduledDate ? "Nova encomenda" : "Novo pedido"} recebido!*\n\n` +
    `👤 Cliente: ${order.customerName} (${order.customerPhone})\n` +
    `${typeLabel}${order.orderType === "DELIVERY" && order.address ? ` → ${order.address}` : ""}` +
    scheduledLine + `\n\n` +
    `📋 *Itens:*\n${formatItems(order.items)}\n\n` +
    `💰 *Total: ${fmt(order.total)}*`;

  await sendMessage(order.tenantId, tenant.whatsapp, text);
}

// ─── Customer: status update ──────────────────────────────────────────────────

export async function sendOrderStatusMessage(order: {
  tenantId: string;
  customerPhone: string;
  customerName: string;
  orderType: string;
  status: string;
}, tenant: { name: string; slug: string }) {
  const { allowed } = await canSend(order.tenantId, "sendStatusUpdates");
  if (!allowed) return;

  const statusMap: Record<string, { label: string; emoji: string; detail: string }> = {
    PENDING:    { label: "Recebido",              emoji: "✅", detail: "Seu pedido foi recebido e aguarda confirmação." },
    PREPARING:  { label: "Em preparo",            emoji: "👨‍🍳", detail: "Nossa equipe já está preparando tudo com carinho!" },
    SHIPPED:    order.orderType === "PICKUP"
      ? { label: "Pronto para retirada", emoji: "🏪", detail: "Pode vir buscar! Seu pedido está pronto no balcão." }
      : { label: "Saiu para entrega",   emoji: "🛵", detail: "O entregador está a caminho. Fique de olho!" },
    DELIVERED:  { label: "Entregue",              emoji: "🎉", detail: "Pedido entregue! Bom apetite! 😋" },
    CANCELLED:  { label: "Cancelado",             emoji: "❌", detail: "Seu pedido foi cancelado. Em caso de dúvidas, entre em contato." },
  };

  const s = statusMap[order.status] ?? { label: order.status, emoji: "📦", detail: "" };
  const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

  const text =
    `${s.emoji} *${s.label}* — ${tenant.name}\n\n` +
    `Olá, ${order.customerName}! ${s.detail}\n\n` +
    `Acompanhe aqui:\n${baseUrl}/${tenant.slug}`;

  await sendMessage(order.tenantId, order.customerPhone, text);
}
