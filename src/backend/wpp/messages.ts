import { prisma } from "../../lib/prisma";
import { sendMessage } from "./baileys-manager";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatOrderItems(items: Array<{ quantity: number; product?: { name?: string | null } | null }>): string {
  return items
    .map((item) => `${item.quantity}x ${item.product?.name || "Item"}`)
    .join(", ");
}

async function canSend(tenantId: string, field: "sendOrderCreated" | "sendStatusUpdates") {
  const [instance, config] = await Promise.all([
    prisma.wppInstance.findUnique({ where: { tenantId } }),
    prisma.wppBotConfig.findUnique({ where: { tenantId } }),
  ]);

  if (!instance || instance.status !== "connected") return false;
  if (!config?.botEnabled) return false;
  return !!config[field];
}

export async function sendOrderCreatedMessage(order: {
  tenantId: string;
  customerPhone: string;
  customerName: string;
  total: number;
  orderType: string;
  items: Array<{ quantity: number; product?: { name?: string | null } | null }>;
}, tenant: { name: string; slug: string }) {
  const allowed = await canSend(order.tenantId, "sendOrderCreated");
  if (!allowed) return;

  const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const text =
    `Olá, ${order.customerName}! Recebemos seu pedido em *${tenant.name}*.\n\n` +
    `Pedido: ${formatOrderItems(order.items)}\n` +
    `Total: ${formatCurrency(order.total)}\n` +
    `Tipo: ${order.orderType === "PICKUP" ? "Retirada" : "Entrega"}\n\n` +
    `Você pode acompanhar e fazer novos pedidos aqui:\n${baseUrl}/${tenant.slug}`;

  await sendMessage(order.tenantId, order.customerPhone, text);
}

export async function sendOrderStatusMessage(order: {
  tenantId: string;
  customerPhone: string;
  customerName: string;
  orderType: string;
  status: string;
}, tenant: { name: string; slug: string }) {
  const allowed = await canSend(order.tenantId, "sendStatusUpdates");
  if (!allowed) return;

  const statusLabel =
    order.status === "PENDING"
      ? "Recebido"
      : order.status === "PREPARING"
        ? "Em preparo"
        : order.status === "SHIPPED"
          ? order.orderType === "PICKUP"
            ? "Pronto para retirada"
            : "Saiu para entrega"
          : order.status === "DELIVERED"
            ? "Entregue"
            : order.status === "CANCELLED"
              ? "Cancelado"
              : order.status;

  const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const text =
    `Olá, ${order.customerName}! Atualização do seu pedido em *${tenant.name}*:\n\n` +
    `Status: *${statusLabel}*\n\n` +
    `Acompanhe o cardápio e novos pedidos aqui:\n${baseUrl}/${tenant.slug}`;

  await sendMessage(order.tenantId, order.customerPhone, text);
}
