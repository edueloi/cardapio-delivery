// Impressão térmica ESC/POS direta, sem passar pelo diálogo de impressão do navegador
// e sem depender de módulos nativos (node-gyp) que falham em compilar em várias máquinas
// Windows sem Visual Studio Build Tools completo. Em vez disso: monta os bytes ESC/POS
// manualmente e manda pro spooler do Windows via linha de comando (copy /b), que qualquer
// Windows já sabe fazer com a impressora instalada (driver "Generic / Text Only" ou o
// driver da própria térmica em modo RAW).
const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Store = require("electron-store");

const execAsync = promisify(exec);
const store = new Store();

const CHARS_PER_LINE = { 80: 42, 58: 32 };

// Comandos ESC/POS básicos — cobre tudo que o recibo precisa (negrito, alinhamento,
// tamanho de fonte, corte de papel). Referência: especificação ESC/POS da Epson.
const ESC = "\x1b";
const GS = "\x1d";
const CMD = {
  init: `${ESC}@`,
  boldOn: `${ESC}E\x01`,
  boldOff: `${ESC}E\x00`,
  alignLeft: `${ESC}a0`,
  alignCenter: `${ESC}a1`,
  alignRight: `${ESC}a2`,
  sizeNormal: `${GS}!\x00`,
  sizeDouble: `${GS}!\x11`,
  cut: `${GS}V\x01`,
  feed: (n) => "\n".repeat(n),
};

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

function twoCol(left, right, width) {
  const gap = Math.max(1, width - left.length - right.length);
  return left + " ".repeat(gap) + right + "\n";
}

// Quebra uma linha longa em várias, respeitando a largura da bobina — o ESC/POS não
// quebra sozinho, cada linha enviada é impressa como está.
function wrapLine(text, width) {
  const words = String(text).split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > width) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

function getPrinterConfig() {
  return store.get("printer", { name: "", widthMm: 80 });
}

function setPrinterConfig(config) {
  store.set("printer", config);
}

// Lista as impressoras instaladas no Windows (as mesmas que aparecem em
// Configurações > Impressoras) usando a própria API do Electron — sem módulo nativo.
async function listPrinters(mainWindow) {
  if (!mainWindow) return [];
  try {
    return await mainWindow.webContents.getPrintersAsync();
  } catch (err) {
    console.error("[printer] Failed to list printers:", err);
    return [];
  }
}

function buildEscPosBuffer(data) {
  const config = getPrinterConfig();
  const width = config.widthMm === 58 ? 58 : 80;
  const cols = CHARS_PER_LINE[width];

  let out = CMD.init;
  out += CMD.alignCenter + CMD.boldOn;
  for (const line of wrapLine(data.tenantName || "", cols)) out += line + "\n";
  out += CMD.boldOff;

  const address = formatTenantAddress(data.tenantAddress);
  if (address) for (const line of wrapLine(address, cols)) out += line + "\n";

  const dateStr = data.createdAt ? new Date(data.createdAt).toLocaleString("pt-BR") : new Date().toLocaleString("pt-BR");
  out += dateStr + "\n";
  if (data.orderId) out += `Pedido #${String(data.orderId).slice(-8).toUpperCase()}\n`;

  if (data.counterTicketNumber != null) {
    out += "\n" + CMD.boldOn + CMD.sizeDouble;
    out += `SENHA ${String(data.counterTicketNumber).padStart(2, "0")}\n`;
    out += CMD.sizeNormal + CMD.boldOff;
  }

  if (data.customerName) out += `Cliente: ${data.customerName}\n`;

  out += CMD.alignLeft;
  out += "-".repeat(cols) + "\n";

  for (const item of data.items || []) {
    const label = `${item.quantity}x ${item.name}`;
    const priceStr = fmtMoney(item.price * item.quantity);
    if (label.length + priceStr.length + 1 > cols) {
      for (const line of wrapLine(label, cols)) out += line + "\n";
      out += " ".repeat(Math.max(0, cols - priceStr.length)) + priceStr + "\n";
    } else {
      out += twoCol(label, priceStr, cols);
    }
    if (item.notes) {
      for (const line of wrapLine(`  Obs: ${item.notes}`, cols)) out += line + "\n";
    }
  }

  out += "-".repeat(cols) + "\n";
  out += twoCol("Subtotal", fmtMoney(data.subtotal), cols);

  if (data.discountAmount > 0) out += twoCol("Desconto", `-${fmtMoney(data.discountAmount)}`, cols);
  if (data.feeAmount > 0) {
    const pct = data.feePercent ? ` (${Number(data.feePercent).toFixed(2).replace(".", ",")}%)` : "";
    const sign = data.feePassedToCustomer ? "+" : "";
    out += twoCol(`Taxa maquininha${pct}`, `${sign}${fmtMoney(data.feeAmount)}`, cols);
  }
  if (data.serviceFeeAmount > 0) {
    const pct = data.serviceFeePercent ? ` (${Number(data.serviceFeePercent).toFixed(0)}%)` : "";
    out += twoCol(`Taxa de serviço${pct}`, `+${fmtMoney(data.serviceFeeAmount)}`, cols);
  }

  out += "-".repeat(cols) + "\n";
  out += CMD.boldOn + CMD.sizeDouble;
  out += twoCol("TOTAL", fmtMoney(data.total), Math.floor(cols / 2));
  out += CMD.sizeNormal + CMD.boldOff;

  if (!data.isPreCheckout) {
    if (data.paymentMethod === "SPLIT" && data.paymentSplits?.length) {
      out += "Pagamento (dividido):\n";
      for (const split of data.paymentSplits) {
        const label = `  ${paymentLabel(split.method)}${split.cardBrand ? ` · ${split.cardBrand}` : ""}`;
        out += twoCol(label, fmtMoney(split.amount), cols);
      }
    } else if (data.paymentMethod) {
      out += `Pagamento: ${paymentLabel(data.paymentMethod)}\n`;
    }
  }
  if (data.paymentMethod === "CASH" && data.amountReceived !== undefined) {
    out += `Recebido: ${fmtMoney(data.amountReceived)}\n`;
    out += `Troco: ${fmtMoney(data.change || 0)}\n`;
  }

  out += "-".repeat(cols) + "\n";
  out += CMD.alignCenter;
  out += "Obrigado pela preferência!\n";
  out += CMD.feed(3);
  out += CMD.cut;

  return Buffer.from(out, "binary");
}

async function sendRawToPrinter(buffer, printerName) {
  if (!printerName) {
    throw new Error("Nenhuma impressora selecionada. Configure em Configurações > Impressora (F9).");
  }

  const tmpFile = path.join(os.tmpdir(), `boxsys-receipt-${Date.now()}.prn`);
  fs.writeFileSync(tmpFile, buffer);

  try {
    // "copy /b" manda o arquivo em modo binário direto pro spooler da impressora
    // compartilhada localmente — funciona com qualquer impressora instalada no Windows,
    // sem precisar de driver especial nem módulo nativo compilado.
    const escapedPath = tmpFile.replace(/\//g, "\\");
    const escapedPrinter = printerName.replace(/"/g, '\\"');
    await execAsync(`copy /b "${escapedPath}" "\\\\localhost\\${escapedPrinter}"`, { shell: "cmd.exe" });
  } finally {
    fs.unlink(tmpFile, () => {});
  }
}

async function printReceipt(data, mainWindow) {
  const config = getPrinterConfig();
  if (!config.name) {
    throw new Error("Nenhuma impressora configurada. Aperte F9 para escolher a impressora térmica.");
  }
  const buffer = buildEscPosBuffer(data);
  await sendRawToPrinter(buffer, config.name);
}

async function testPrint(mainWindow) {
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
  }, mainWindow);
}

module.exports = { printReceipt, testPrint, getPrinterConfig, setPrinterConfig, listPrinters };
