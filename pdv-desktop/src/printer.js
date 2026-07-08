// Impressão térmica ESC/POS direta (USB/Serial), sem passar pelo diálogo de impressão
// do navegador. Suporta impressoras 80mm e 58mm — a largura vem junto com os dados do
// recibo (paperWidthMm), a mesma config que a loja já define em Configurações no painel web.
const { ThermalPrinter, PrinterTypes } = require("node-thermal-printer");
const Store = require("electron-store");

const store = new Store();

const CHARS_PER_LINE = { 80: 42, 58: 32 };

function fmtMoney(v) {
  return `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
}

function paymentLabel(method) {
  if (!method) return "";
  if (method.startsWith("STONE_")) return `Maquininha (${method.replace("STONE_", "")})`;
  const labels = { CASH: "Dinheiro", PIX: "PIX", CREDIT: "Cartão de Crédito", DEBIT: "Cartão de Débito", VR: "Vale Refeição" };
  return labels[method] || method;
}

function formatTenantAddress(raw) {
  if (!raw) return "";
  try {
    const addr = JSON.parse(raw);
    const parts = [];
    if (addr.street) parts.push(`${addr.street}${addr.number ? `, ${addr.number}` : ""}`);
    if (addr.neighborhood) parts.push(addr.neighborhood);
    if (addr.city) parts.push(`${addr.city}${addr.state ? ` - ${addr.state}` : ""}`);
    return parts.join(" · ");
  } catch {
    return raw;
  }
}

// Interface de linha "esquerda ... direita" respeitando a largura da bobina —
// usada pra alinhar nome do item / valor sem depender de tabs (ESC/POS não confia neles).
function twoCol(printer, left, right, width) {
  const gap = Math.max(1, width - left.length - right.length);
  printer.println(left + " ".repeat(gap) + right);
}

function getPrinterConfig() {
  return store.get("printer", { type: "usb", interface: "", widthMm: 80 });
}

function setPrinterConfig(config) {
  store.set("printer", config);
}

async function listSerialPorts() {
  try {
    const { SerialPort } = require("serialport");
    const ports = await SerialPort.list();
    return ports.map((p) => ({ path: p.path, manufacturer: p.manufacturer || "" }));
  } catch (err) {
    console.error("[printer] Failed to list serial ports:", err);
    return [];
  }
}

async function printReceipt(data) {
  const config = getPrinterConfig();
  const width = config.widthMm === 58 ? 58 : 80;
  const cols = CHARS_PER_LINE[width];

  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: config.interface || "usb",
    width: cols,
    removeSpecialCharacters: false,
    options: { timeout: 5000 },
  });

  const isConnected = await printer.isPrinterConnected().catch(() => false);
  if (!isConnected) {
    throw new Error("Impressora não conectada. Verifique o cabo e a configuração em Configurações > Impressora.");
  }

  printer.alignCenter();
  printer.bold(true);
  printer.setTextSize(0, 0);
  printer.println(data.tenantName || "");
  printer.bold(false);

  const address = formatTenantAddress(data.tenantAddress);
  if (address) printer.println(address);

  const dateStr = data.createdAt ? new Date(data.createdAt).toLocaleString("pt-BR") : new Date().toLocaleString("pt-BR");
  printer.println(dateStr);
  if (data.orderId) printer.println(`Pedido #${String(data.orderId).slice(-8).toUpperCase()}`);

  if (data.counterTicketNumber != null) {
    printer.newLine();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println(`SENHA ${String(data.counterTicketNumber).padStart(2, "0")}`);
    printer.setTextSize(0, 0);
    printer.bold(false);
  }

  if (data.customerName) printer.println(`Cliente: ${data.customerName}`);

  printer.alignLeft();
  printer.drawLine();

  for (const item of data.items || []) {
    const label = `${item.quantity}x ${item.name}`;
    const priceStr = fmtMoney(item.price * item.quantity);
    if (label.length + priceStr.length + 1 > cols) {
      printer.println(label);
      printer.alignRight();
      printer.println(priceStr);
      printer.alignLeft();
    } else {
      twoCol(printer, label, priceStr, cols);
    }
    if (item.notes) {
      printer.println(`  Obs: ${item.notes}`);
    }
  }

  printer.drawLine();
  twoCol(printer, "Subtotal", fmtMoney(data.subtotal), cols);

  if (data.discountAmount > 0) {
    twoCol(printer, "Desconto", `-${fmtMoney(data.discountAmount)}`, cols);
  }
  if (data.feeAmount > 0) {
    const pct = data.feePercent ? ` (${Number(data.feePercent).toFixed(2).replace(".", ",")}%)` : "";
    const sign = data.feePassedToCustomer ? "+" : "";
    twoCol(printer, `Taxa maquininha${pct}`, `${sign}${fmtMoney(data.feeAmount)}`, cols);
  }
  if (data.serviceFeeAmount > 0) {
    const pct = data.serviceFeePercent ? ` (${Number(data.serviceFeePercent).toFixed(0)}%)` : "";
    twoCol(printer, `Taxa de serviço${pct}`, `+${fmtMoney(data.serviceFeeAmount)}`, cols);
  }

  printer.drawLine();
  printer.bold(true);
  printer.setTextSize(0, 1);
  twoCol(printer, "TOTAL", fmtMoney(data.total), cols);
  printer.setTextSize(0, 0);
  printer.bold(false);

  if (!data.isPreCheckout) {
    if (data.paymentMethod === "SPLIT" && data.paymentSplits?.length) {
      printer.println("Pagamento (dividido):");
      for (const split of data.paymentSplits) {
        const label = `  ${paymentLabel(split.method)}${split.cardBrand ? ` · ${split.cardBrand}` : ""}`;
        twoCol(printer, label, fmtMoney(split.amount), cols);
      }
    } else if (data.paymentMethod) {
      printer.println(`Pagamento: ${paymentLabel(data.paymentMethod)}`);
    }
  }
  if (data.paymentMethod === "CASH" && data.amountReceived !== undefined) {
    printer.println(`Recebido: ${fmtMoney(data.amountReceived)}`);
    printer.println(`Troco: ${fmtMoney(data.change || 0)}`);
  }

  printer.drawLine();
  printer.alignCenter();
  printer.println("Obrigado pela preferência!");
  printer.newLine();
  printer.cut();

  await printer.execute();
}

async function testPrint() {
  await printReceipt({
    tenantName: "Teste de Impressão",
    tenantAddress: "",
    createdAt: new Date(),
    items: [{ quantity: 1, name: "Item de teste", price: 10, notes: "" }],
    subtotal: 10,
    total: 10,
    paymentMethod: "CASH",
    amountReceived: 10,
    change: 0,
    isPreCheckout: false,
  });
}

module.exports = { printReceipt, testPrint, getPrinterConfig, setPrinterConfig, listSerialPorts };
