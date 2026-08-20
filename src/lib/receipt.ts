import { jsPDF } from "jspdf";
import type { DanfeData } from "../types.js";

export interface ReceiptItem {
  quantity: number;
  name: string;
  price: number;
  notes?: string;
}

export interface ReceiptData {
  tenantName: string;
  tenantAddress?: string;
  tenantCnpj?: string;
  tenantPhone?: string;
  orderId?: string;
  tableId?: string | null;
  counterTicketNumber?: number | null;
  /** "EAT_IN" (comer no local) ou "TAKEOUT" (para viagem) — só pedidos de Balcão. */
  consumptionType?: "EAT_IN" | "TAKEOUT" | null;
  createdAt?: Date;
  customerName?: string;
  isPreCheckout?: boolean;
  paperWidthMm?: 58 | 80;
  /** "CLIENTE" ou "ESTABELECIMENTO" — impresso em destaque junto com a senha, quando presente. */
  copyLabel?: "CLIENTE" | "ESTABELECIMENTO";
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
  paymentSplits?: Array<{ method: string; amount: number; cardBrand?: string; installments?: number }>;
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

// tenant.address é salvo como JSON estruturado ({cep, street, number, ...}), não texto livre —
// sem isso, o cupom imprime o JSON cru no cabeçalho.
function formatTenantAddress(raw?: string): string {
  if (!raw) return "";
  try {
    const addr = JSON.parse(raw);
    const parts: string[] = [];
    if (addr.street) parts.push(`${addr.street}${addr.number ? `, ${addr.number}` : ""}`);
    if (addr.neighborhood) parts.push(addr.neighborhood);
    if (addr.city) parts.push(`${addr.city}${addr.state ? ` - ${addr.state}` : ""}`);
    return parts.join(" · ");
  } catch {
    return raw;
  }
}

function formatCnpj(raw?: string): string {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// Estima a altura necessária (mm) somando as mesmas linhas que buildReceiptPdf desenha,
// pra não sobrar papel em branco nem cortar conteúdo. nameLines/addressLines já vêm
// quebrados pelo jsPDF (splitTextToSize), então o número de linhas reais é conhecido de antemão.
function estimateHeight(data: ReceiptData, nameLines: string[], addressLines: string[]): number {
  let y = 8;
  y += nameLines.length * 5; // nome da loja (pode quebrar em mais de 1 linha)
  y += addressLines.length * 4;
  if (data.tenantCnpj) y += 4;
  if (data.tenantPhone) y += 4;
  y += 4; // data
  if (data.orderId) y += 4;
  if (data.tableId) y += 6;
  else if (data.counterTicketNumber != null) y += 18;
  if (data.consumptionType) y += 5;
  if (data.customerName) y += 4;
  y += 1 + 5; // linha + espaço
  for (const item of data.items) {
    y += 4;
    if (item.notes) y += 4;
  }
  y += 1 + 5; // linha + espaço
  y += 4; // subtotal
  if (data.discountAmount && data.discountAmount > 0) y += 4;
  if (data.feeAmount && data.feeAmount > 0) y += 4;
  if (data.serviceFeeAmount && data.serviceFeeAmount > 0) y += 4;
  y += 1 + 6; // linha + espaço
  y += 6; // total
  y += 4; // quantidade de itens
  if (!data.isPreCheckout) {
    if (data.paymentMethod === "SPLIT" && data.paymentSplits?.length) {
      y += 4 + data.paymentSplits.length * 4;
    } else if (data.paymentMethod) {
      y += 4;
    }
    if (data.paymentMethod === "CASH" && data.amountReceived !== undefined) y += 8;
  }
  y += 2 + 6; // linha + espaço
  y += 6; // rodapé
  return y + 8; // margem final
}

export function buildReceiptPdf(data: ReceiptData): jsPDF {
  const width = data.paperWidthMm === 58 ? 58 : 80;
  const margin = width === 58 ? 3 : 5;
  const contentWidth = width - margin * 2;

  // Doc de medição: só pra quebrar nome/endereço em linhas antes de saber a altura final da página.
  const measureDoc = new jsPDF({ unit: "mm", format: [width, 100] });
  measureDoc.setFont("courier", "bold");
  measureDoc.setFontSize(width === 58 ? 10 : 12);
  const nameLines: string[] = measureDoc.splitTextToSize(data.tenantName, contentWidth);
  measureDoc.setFont("courier", "normal");
  measureDoc.setFontSize(8);
  const addressText = formatTenantAddress(data.tenantAddress);
  const addressLines: string[] = addressText ? measureDoc.splitTextToSize(addressText, contentWidth) : [];

  const doc = new jsPDF({ unit: "mm", format: [width, estimateHeight(data, nameLines, addressLines)] });
  let y = 8;

  doc.setFont("courier", "bold");
  doc.setFontSize(width === 58 ? 10 : 12);
  doc.text(nameLines, width / 2, y, { align: "center" });
  y += nameLines.length * 5;

  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  if (addressLines.length) {
    doc.text(addressLines, width / 2, y, { align: "center" });
    y += addressLines.length * 4;
  }
  if (data.tenantCnpj) {
    doc.text(`CNPJ: ${formatCnpj(data.tenantCnpj)}`, width / 2, y, { align: "center" });
    y += 4;
  }
  if (data.tenantPhone) {
    doc.text(`Tel: ${data.tenantPhone}`, width / 2, y, { align: "center" });
    y += 4;
  }

  const dateStr = (data.createdAt || new Date()).toLocaleString("pt-BR");
  doc.text(dateStr, width / 2, y, { align: "center" });
  y += 4;
  if (data.orderId) {
    doc.text(`Pedido #${data.orderId.slice(-8).toUpperCase()}`, width / 2, y, { align: "center" });
    y += 4;
  }
  if (data.tableId) {
    doc.setFont("courier", "bold");
    doc.setFontSize(width === 58 ? 12 : 14);
    doc.text(`MESA ${data.tableId}`, width / 2, y + 2, { align: "center" });
    y += 6;
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
  } else if (data.counterTicketNumber != null) {
    // Senha em destaque bem maior — é a referência que o cliente usa pra buscar o pedido
    // no balcão/painel, precisa ser visível de longe, bem mais que o resto do cupom.
    doc.setFont("courier", "bold");
    doc.setFontSize(width === 58 ? 22 : 28);
    doc.text(String(data.counterTicketNumber).padStart(2, "0"), width / 2, y + 8, { align: "center" });
    y += 10;
    doc.setFont("courier", "normal");
    doc.setFontSize(width === 58 ? 8 : 9);
    doc.text("SENHA", width / 2, y, { align: "center" });
    y += 4;
    doc.setFontSize(8);
  }
  if (data.consumptionType) {
    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.text(data.consumptionType === "EAT_IN" ? "COMER NO LOCAL" : "PARA VIAGEM", width / 2, y, { align: "center" });
    y += 5;
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
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
    doc.text(label, margin, y, { maxWidth: contentWidth - (width === 58 ? 14 : 20) });
    doc.text(priceStr, width - margin, y, { align: "right" });
    y += 4;
    if (item.notes) {
      doc.setFont("courier", "bolditalic");
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
  const itemCount = data.items.reduce((acc, i) => acc + i.quantity, 0);
  doc.text(`Qtd. Itens: ${itemCount}`, margin, y);
  y += 4;
  if (!data.isPreCheckout) {
    if (data.paymentMethod === "SPLIT" && data.paymentSplits?.length) {
      doc.text("Pagamento (dividido):", margin, y);
      y += 4;
      for (const split of data.paymentSplits) {
        const label = `${paymentLabel(split.method)}${split.cardBrand ? ` | ${split.cardBrand}` : ""}${split.method === "CREDIT" && split.installments ? ` | ${split.installments}x` : ""}`;
        doc.text(`  ${label}`, margin, y);
        doc.text(fmtMoney(split.amount), width - margin, y, { align: "right" });
        y += 4;
      }
    } else if (data.paymentMethod) {
      doc.text(`Pagamento: ${paymentLabel(data.paymentMethod)}`, margin, y);
      y += 4;
    }
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

export interface CashClosingSummary {
  openedAt: string | Date;
  closedAt?: string | Date;
  openingBalance: number;
  closingBalance: number;
  expectedBalance: number;
  ordersCount: number;
  grossTotal: number;
  salesByMethod: Array<{ method: string; total: number }>;
  movements: Array<{ type: string; amount: number; description?: string | null }>;
}

const CASH_METHOD_LABELS: Record<string, string> = {
  CASH: "Dinheiro",
  PIX: "PIX",
  CREDIT: "Cartão de Crédito",
  DEBIT: "Cartão de Débito",
  VR: "Vale Refeição",
};

function cashMethodLabel(method: string): string {
  if (method.startsWith("STONE_")) return `Maquininha (${method.replace("STONE_", "")})`;
  return CASH_METHOD_LABELS[method] || method;
}

export function buildCashClosingReportPdf(
  tenantName: string,
  summary: CashClosingSummary,
  paperWidthMm?: 58 | 80
): jsPDF {
  const width = paperWidthMm === 58 ? 58 : 80;
  const margin = width === 58 ? 3 : 5;
  const cols = width === 58 ? 32 : 42;

  const sangrias = summary.movements.filter((m) => m.type === "SANGRIA");
  const suprimentos = summary.movements.filter((m) => m.type === "SUPRIMENTO");
  const sangriaTotal = sangrias.reduce((s, m) => s + m.amount, 0);
  const suprimentoTotal = suprimentos.reduce((s, m) => s + m.amount, 0);

  let lines = 14; // cabeçalho + totais fixos
  lines += summary.salesByMethod.length;
  lines += sangrias.length + suprimentos.length + 2;

  const doc = new jsPDF({ unit: "mm", format: [width, 20 + lines * 4.5] });
  let y = 8;

  doc.setFont("courier", "bold");
  doc.setFontSize(width === 58 ? 10 : 12);
  doc.text(tenantName, width / 2, y, { align: "center" });
  y += 5;
  doc.text("FECHAMENTO DE CAIXA", width / 2, y, { align: "center" });
  y += 5;

  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  const openedStr = new Date(summary.openedAt).toLocaleString("pt-BR");
  const closedStr = summary.closedAt ? new Date(summary.closedAt).toLocaleString("pt-BR") : new Date().toLocaleString("pt-BR");
  doc.text(`Abertura: ${openedStr}`, margin, y); y += 4;
  doc.text(`Fechamento: ${closedStr}`, margin, y); y += 4;

  y += 1;
  doc.line(margin, y, width - margin, y);
  y += 5;

  doc.text(`Pedidos no turno: ${summary.ordersCount}`, margin, y); y += 4;
  doc.text("Total vendido", margin, y);
  doc.text(fmtMoney(summary.grossTotal), width - margin, y, { align: "right" });
  y += 5;

  if (summary.salesByMethod.length > 0) {
    doc.setFont("courier", "bold");
    doc.text("Por forma de pagamento:", margin, y);
    doc.setFont("courier", "normal");
    y += 4;
    for (const entry of summary.salesByMethod) {
      doc.text(`  ${cashMethodLabel(entry.method)}`, margin, y);
      doc.text(fmtMoney(entry.total), width - margin, y, { align: "right" });
      y += 4;
    }
    y += 1;
  }

  doc.line(margin, y, width - margin, y);
  y += 5;

  doc.text("Fundo de abertura", margin, y);
  doc.text(fmtMoney(summary.openingBalance), width - margin, y, { align: "right" });
  y += 4;

  if (sangrias.length > 0) {
    doc.text("Sangrias", margin, y);
    doc.text(`-${fmtMoney(sangriaTotal)}`, width - margin, y, { align: "right" });
    y += 4;
  }
  if (suprimentos.length > 0) {
    doc.text("Suprimentos", margin, y);
    doc.text(`+${fmtMoney(suprimentoTotal)}`, width - margin, y, { align: "right" });
    y += 4;
  }

  y += 1;
  doc.line(margin, y, width - margin, y);
  y += 6;

  doc.setFont("courier", "bold");
  doc.setFontSize(10);
  doc.text("Esperado em caixa", margin, y);
  doc.text(fmtMoney(summary.expectedBalance), width - margin, y, { align: "right" });
  y += 5;
  doc.text("Contado", margin, y);
  doc.text(fmtMoney(summary.closingBalance), width - margin, y, { align: "right" });
  y += 5;
  const diff = summary.closingBalance - summary.expectedBalance;
  doc.text(diff < 0 ? "Falta" : "Sobra", margin, y);
  doc.text(fmtMoney(Math.abs(diff)), width - margin, y, { align: "right" });
  y += 6;

  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.line(margin, y, width - margin, y);
  y += 5;
  doc.text("Use este resumo para conferir o caixa.", width / 2, y, { align: "center" });

  return doc;
}

export function printCashClosingReportPdf(tenantName: string, summary: CashClosingSummary, paperWidthMm?: 58 | 80) {
  const doc = buildCashClosingReportPdf(tenantName, summary, paperWidthMm);
  doc.autoPrint();
  const blobUrl = doc.output("bloburl");
  window.open(blobUrl as unknown as string, "_blank");
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

// ─── DANFE (cupom fiscal da NFC-e, com QR Code) ──────────────────────────────

const PAYMENT_WIDTH_LIMIT = 999; // sem quebra especial — nomes de pagamento já vêm curtos do backend

function cpfMask(cpf?: string): string {
  if (!cpf) return "";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function estimateDanfeHeight(data: DanfeData, nameLines: string[], addressLines: string[]): number {
  let y = 8;
  y += nameLines.length * 5;
  y += addressLines.length * 4;
  y += 4; // CNPJ/IE
  y += 5; // "DOCUMENTO AUXILIAR..."
  y += 4; // ambiente homologação (se aplicável, aproximação segura somando sempre)
  y += 1 + 5; // linha + espaço
  for (const item of data.items) y += 8; // nome (pode quebrar) + linha qtd/valor — aproximado
  y += 1 + 6; // linha + espaço
  y += 6; // total
  y += 4; // forma de pagamento
  if (data.customerCpf || data.customerName) y += 4;
  y += 1 + 5;
  y += 4 * 3; // número/série/emissão
  y += 4 * 2; // chave (quebrada em 2 linhas)
  y += 4; // protocolo
  y += 5; // "Consulte pela Chave de Acesso em"
  y += 4; // url
  y += 4 + 60; // "QRCODE" + imagem (60mm de lado é suficiente pra 200px)
  y += 6; // rodapé
  return y + 10;
}

export function buildDanfePdf(data: DanfeData, paperWidthMm?: 58 | 80): jsPDF {
  const width = paperWidthMm === 58 ? 58 : 80;
  const margin = width === 58 ? 3 : 5;
  const contentWidth = width - margin * 2;

  const measureDoc = new jsPDF({ unit: "mm", format: [width, 100] });
  measureDoc.setFont("courier", "bold");
  measureDoc.setFontSize(width === 58 ? 10 : 12);
  const nameLines: string[] = measureDoc.splitTextToSize(data.emitName, contentWidth);
  measureDoc.setFont("courier", "normal");
  measureDoc.setFontSize(7);
  const addressLines: string[] = data.emitAddress ? measureDoc.splitTextToSize(data.emitAddress, contentWidth) : [];

  const doc = new jsPDF({ unit: "mm", format: [width, estimateDanfeHeight(data, nameLines, addressLines)] });
  let y = 8;

  doc.setFont("courier", "bold");
  doc.setFontSize(width === 58 ? 10 : 12);
  doc.text(nameLines, width / 2, y, { align: "center" });
  y += nameLines.length * 5;

  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  if (addressLines.length) {
    doc.text(addressLines, width / 2, y, { align: "center" });
    y += addressLines.length * 4;
  }

  const cnpjFmt = data.emitCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  doc.text(`CNPJ: ${cnpjFmt}  IE: ${data.emitIe}`, width / 2, y, { align: "center" });
  y += 4;

  doc.setFont("courier", "bold");
  doc.text("DANFE NFC-e - Documento Auxiliar da", width / 2, y, { align: "center" });
  y += 3.5;
  doc.text("Nota Fiscal de Consumidor Eletrônica", width / 2, y, { align: "center" });
  y += 4.5;
  doc.setFont("courier", "normal");

  if (data.ambiente === "homologacao") {
    doc.setFont("courier", "bold");
    doc.setFontSize(8);
    doc.text("EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO", width / 2, y, { align: "center" });
    y += 3.5;
    doc.text("SEM VALOR FISCAL", width / 2, y, { align: "center" });
    y += 4.5;
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
  }

  y += 1;
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, width - margin, y);
  y += 5;

  doc.setFontSize(7);
  for (const item of data.items) {
    const nameLinesItem = doc.splitTextToSize(item.name, contentWidth);
    doc.text(nameLinesItem, margin, y);
    y += nameLinesItem.length * 3.5;
    const qtyStr = `${item.quantity} ${item.unitCom} x ${fmtMoney(item.unitPrice)}`;
    const totalStr = fmtMoney(item.total);
    doc.text(qtyStr, margin, y);
    doc.text(totalStr, width - margin, y, { align: "right" });
    y += 4;
  }

  y += 1;
  doc.line(margin, y, width - margin, y);
  y += 6;

  doc.setFont("courier", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL", margin, y);
  doc.text(fmtMoney(data.total), width - margin, y, { align: "right" });
  y += 5;

  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  doc.text(`Pagamento: ${data.paymentMethod}`, margin, y, { maxWidth: PAYMENT_WIDTH_LIMIT });
  y += 4;

  if (data.customerCpf) {
    doc.text(`CPF Consumidor: ${cpfMask(data.customerCpf)}`, margin, y);
    y += 4;
  } else if (data.customerName) {
    doc.text(`Cliente: ${data.customerName}`, margin, y);
    y += 4;
  }

  y += 1;
  doc.line(margin, y, width - margin, y);
  y += 5;

  const dataEmi = data.dhEmi ? new Date(data.dhEmi).toLocaleString("pt-BR") : "";
  doc.text(`NFC-e nº ${data.numero}  Série ${data.serie}`, margin, y);
  y += 4;
  doc.text(`Emissão: ${dataEmi}`, margin, y);
  y += 4;
  doc.text(`Protocolo: ${data.protocolo}`, margin, y, { maxWidth: contentWidth });
  y += 4;

  doc.text("Chave de acesso:", margin, y);
  y += 4;
  const chaveFmt = (data.chave.match(/.{1,4}/g) ?? []).join(" ");
  const chaveLines = doc.splitTextToSize(chaveFmt, contentWidth);
  doc.text(chaveLines, margin, y);
  y += chaveLines.length * 4;

  y += 1;
  doc.setFont("courier", "bold");
  doc.text("Consulte pela Chave de Acesso em:", width / 2, y, { align: "center" });
  y += 4;
  doc.setFont("courier", "normal");
  const urlLines = doc.splitTextToSize(data.consultaUrl, contentWidth);
  doc.text(urlLines, width / 2, y, { align: "center" });
  y += urlLines.length * 3.5 + 3;

  if (data.qrCodeDataUrl) {
    const qrSize = width === 58 ? 40 : 50;
    try {
      doc.addImage(data.qrCodeDataUrl, "PNG", (width - qrSize) / 2, y, qrSize, qrSize);
      y += qrSize + 4;
    } catch {
      /* imagem inválida — segue sem QR Code impresso, resto do cupom continua legível */
    }
  }

  doc.line(margin, y, width - margin, y);
  y += 5;
  if (data.isSimplesNacional) {
    doc.setFont("courier", "italic");
    doc.setFontSize(7);
    doc.text("Documento emitido por ME/EPP optante pelo", width / 2, y, { align: "center" });
    y += 3.5;
    doc.text("Simples Nacional", width / 2, y, { align: "center" });
  }

  return doc;
}

export function downloadDanfePdf(data: DanfeData, paperWidthMm?: 58 | 80) {
  const doc = buildDanfePdf(data, paperWidthMm);
  doc.save(`danfe-${data.numero}.pdf`);
}

export function printDanfePdf(data: DanfeData, paperWidthMm?: 58 | 80) {
  const doc = buildDanfePdf(data, paperWidthMm);
  doc.autoPrint();
  const blobUrl = doc.output("bloburl");
  window.open(blobUrl as unknown as string, "_blank");
}
