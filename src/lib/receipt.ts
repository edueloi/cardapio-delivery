import { jsPDF } from "jspdf";

export interface ReceiptItem {
  quantity: number;
  name: string;
  price: number;
  notes?: string;
}

export interface ReceiptData {
  tenantName: string;
  orderId?: string;
  createdAt?: Date;
  customerName?: string;
  items: ReceiptItem[];
  subtotal: number;
  discountAmount?: number;
  feeAmount?: number;
  feePercent?: number;
  feePassedToCustomer?: boolean;
  serviceFeeAmount?: number;
  serviceFeePercent?: number;
  total: number;
  paymentMethod?: string;
  amountReceived?: number;
  change?: number;
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Dinheiro",
  PIX: "PIX",
  CREDIT: "Cartão de Crédito",
  DEBIT: "Cartão de Débito",
  VR: "Vale Refeição",
};

function paymentLabel(method?: string): string {
  if (!method) return "";
  if (method.startsWith("STONE_")) return `Maquininha (${method.replace("STONE_", "")})`;
  return PAYMENT_LABELS[method] || method;
}

const fmtMoney = (v: number) =>
  `R$ ${v.toFixed(2).replace(".", ",")}`;

export function buildReceiptPdf(data: ReceiptData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: [80, 200 + data.items.length * 8] });
  const width = 80;
  const margin = 5;
  let y = 8;

  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.text(data.tenantName, width / 2, y, { align: "center" });
  y += 6;

  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  const dateStr = (data.createdAt || new Date()).toLocaleString("pt-BR");
  doc.text(dateStr, width / 2, y, { align: "center" });
  y += 4;
  if (data.orderId) {
    doc.text(`Pedido #${data.orderId.slice(-8).toUpperCase()}`, width / 2, y, { align: "center" });
    y += 4;
  }
  if (data.customerName) {
    doc.text(`Cliente: ${data.customerName}`, width / 2, y, { align: "center" });
    y += 4;
  }

  y += 1;
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, width - margin, y);
  y += 5;

  doc.setFontSize(8);
  for (const item of data.items) {
    const label = `${item.quantity}x ${item.name}`;
    const priceStr = fmtMoney(item.price * item.quantity);
    doc.text(label, margin, y, { maxWidth: width - margin * 2 - 20 });
    doc.text(priceStr, width - margin, y, { align: "right" });
    y += 4;
    if (item.notes) {
      doc.setFont("courier", "italic");
      doc.text(`  Obs: ${item.notes}`, margin, y, { maxWidth: width - margin * 2 });
      doc.setFont("courier", "normal");
      y += 4;
    }
  }

  y += 1;
  doc.line(margin, y, width - margin, y);
  y += 5;

  doc.text("Subtotal", margin, y);
  doc.text(fmtMoney(data.subtotal), width - margin, y, { align: "right" });
  y += 4;

  if (data.discountAmount && data.discountAmount > 0) {
    doc.text("Desconto", margin, y);
    doc.text(`-${fmtMoney(data.discountAmount)}`, width - margin, y, { align: "right" });
    y += 4;
  }

  if (data.feeAmount && data.feeAmount > 0) {
    const pct = data.feePercent ? ` (${data.feePercent.toFixed(2).replace(".", ",")}%)` : "";
    doc.text(`Taxa maquininha${pct}`, margin, y, { maxWidth: width - margin * 2 - 20 });
    const sign = data.feePassedToCustomer ? "+" : "";
    doc.text(`${sign}${fmtMoney(data.feeAmount)}`, width - margin, y, { align: "right" });
    y += 4;
  }

  if (data.serviceFeeAmount && data.serviceFeeAmount > 0) {
    const pct = data.serviceFeePercent ? ` (${data.serviceFeePercent.toFixed(0)}%)` : "";
    doc.text(`Taxa de serviço${pct}`, margin, y, { maxWidth: width - margin * 2 - 20 });
    doc.text(`+${fmtMoney(data.serviceFeeAmount)}`, width - margin, y, { align: "right" });
    y += 4;
  }

  y += 1;
  doc.line(margin, y, width - margin, y);
  y += 6;

  doc.setFont("courier", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL", margin, y);
  doc.text(fmtMoney(data.total), width - margin, y, { align: "right" });
  y += 6;

  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  if (data.paymentMethod) {
    doc.text(`Pagamento: ${paymentLabel(data.paymentMethod)}`, margin, y);
    y += 4;
  }
  if (data.paymentMethod === "CASH" && data.amountReceived !== undefined) {
    doc.text(`Recebido: ${fmtMoney(data.amountReceived)}`, margin, y);
    y += 4;
    doc.text(`Troco: ${fmtMoney(data.change || 0)}`, margin, y);
    y += 4;
  }

  y += 2;
  doc.line(margin, y, width - margin, y);
  y += 6;

  doc.setFont("courier", "italic");
  doc.text("Obrigado pela preferência!", width / 2, y, { align: "center" });

  return doc;
}

export function downloadReceiptPdf(data: ReceiptData) {
  const doc = buildReceiptPdf(data);
  const filename = `recibo-${data.orderId ? data.orderId.slice(-8) : Date.now()}.pdf`;
  doc.save(filename);
}

export function printReceiptPdf(data: ReceiptData) {
  const doc = buildReceiptPdf(data);
  doc.autoPrint();
  const blobUrl = doc.output("bloburl");
  window.open(blobUrl as unknown as string, "_blank");
}
