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
const iconv = require("iconv-lite");
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
  // Página de código 860 (Português) — sem isso, a impressora usa CP437 (inglês) por
  // padrão e qualquer acento (ã, ç, é...) sai como símbolo quebrado no papel.
  codepagePortuguese: `${ESC}t\x02`,
  boldOn: `${ESC}E\x01`,
  boldOff: `${ESC}E\x00`,
  alignLeft: `${ESC}a0`,
  alignCenter: `${ESC}a1`,
  alignRight: `${ESC}a2`,
  sizeNormal: `${GS}!\x00`,
  sizeDouble: `${GS}!\x11`,
  sizeTriple: `${GS}!\x22`,
  cut: `${GS}V\x01`,
  feed: (n) => "\n".repeat(n),
};

// Comandos GS ( k — impressão de QR Code nativa da impressora (ESC/POS 2D barcode),
// suportada pela grande maioria das térmicas (Epson TM-T20, Bematech, Elgin, Tanca etc.).
// Referência: especificação ESC/POS "Function 165: 2D symbol - QR Code".
function qrCodeCommand(data, moduleSize = 6) {
  const dataBuf = Buffer.from(data, "utf8");
  const store = Buffer.concat([
    Buffer.from([0x1d, 0x28, 0x6b, (dataBuf.length + 3) & 0xff, ((dataBuf.length + 3) >> 8) & 0xff, 0x31, 0x50, 0x30]),
    dataBuf,
  ]);
  const model = Buffer.from([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]); // modelo 2
  const size = Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduleSize]); // tamanho do módulo
  const errorCorrection = Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]); // nível M
  const print = Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]); // imprime o buffer
  return Buffer.concat([model, size, errorCorrection, store, print]);
}

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

  let out = CMD.init + CMD.codepagePortuguese;
  out += CMD.alignCenter + CMD.boldOn;
  for (const line of wrapLine(data.tenantName || "", cols)) out += line + "\n";
  out += CMD.boldOff;

  const address = formatTenantAddress(data.tenantAddress);
  if (address) for (const line of wrapLine(address, cols)) out += line + "\n";

  const dateStr = data.createdAt ? new Date(data.createdAt).toLocaleString("pt-BR") : new Date().toLocaleString("pt-BR");
  out += dateStr + "\n";
  if (data.orderId) out += `Pedido #${String(data.orderId).slice(-8).toUpperCase()}\n`;

  if (data.copyLabel) {
    out += CMD.boldOn + `VIA DO ${data.copyLabel}\n` + CMD.boldOff;
  }

  if (data.counterTicketNumber != null) {
    // Senha bem grande — é o que o cliente usa pra identificar o pedido no balcão/painel.
    out += "\n" + CMD.boldOn + CMD.sizeTriple;
    out += `${String(data.counterTicketNumber).padStart(2, "0")}\n`;
    out += CMD.sizeNormal;
    out += "SENHA\n";
    out += CMD.boldOff;
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
      out += CMD.boldOn;
      for (const line of wrapLine(`  Obs: ${item.notes}`, cols)) out += line + "\n";
      out += CMD.boldOff;
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
  // Avanço generoso antes do corte — sem isso, a lâmina corta em cima da última linha
  // impressa em impressoras que não avançam papel sozinhas antes do GS V (corte).
  out += CMD.feed(5);
  out += CMD.cut;

  // CP860 (Português) preserva os bytes de controle ESC/GS (0x00-0x7F, mesmo intervalo do
  // ASCII) e só remapeia acentos (0x80+) — por isso dá pra converter a string inteira de
  // uma vez, sem quebrar os comandos ESC/POS misturados no meio do texto.
  return iconv.encode(out, "cp860");
}

async function sendRawToPrinter(buffer, printerName) {
  if (!printerName) {
    throw new Error("Nenhuma impressora selecionada. Configure em Configurações > Impressora (F9).");
  }

  const tmpFile = path.join(os.tmpdir(), `boxsys-receipt-${Date.now()}.prn`);
  fs.writeFileSync(tmpFile, buffer);

  try {
    // "\\localhost\Nome" só funciona se a impressora estiver marcada como compartilhada
    // no Windows — a maioria das térmicas instaladas via USB não está. Em vez disso,
    // manda os bytes crus direto pro spooler via .NET (RawPrinterHelper com
    // OpenPrinter/WritePrinter), que funciona com qualquer impressora local instalada,
    // compartilhada ou não. Roda via PowerShell pra não precisar de módulo nativo.
    const escapedPath = tmpFile.replace(/'/g, "''");
    const escapedPrinter = printerName.replace(/'/g, "''");
    const script = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential)]
  public struct DOCINFOA { [MarshalAs(UnmanagedType.LPStr)] public string pDocName; [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPStr)] public string pDataType; }
  [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] ref DOCINFOA di);
  [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  public static bool SendBytesToPrinter(string szPrinterName, byte[] bytes) {
    IntPtr hPrinter; DOCINFOA di = new DOCINFOA(); bool success = false;
    di.pDocName = "Box Sys - Recibo"; di.pDataType = "RAW";
    if (!OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) return false;
    try {
      if (!StartDocPrinter(hPrinter, 1, ref di)) return false;
      try {
        if (!StartPagePrinter(hPrinter)) return false;
        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
        int written;
        success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out written);
        Marshal.FreeCoTaskMem(pUnmanagedBytes);
        EndPagePrinter(hPrinter);
      } finally { EndDocPrinter(hPrinter); }
    } finally { ClosePrinter(hPrinter); }
    return success;
  }
}
"@
$bytes = [System.IO.File]::ReadAllBytes('${escapedPath}')
$ok = [RawPrinterHelper]::SendBytesToPrinter('${escapedPrinter}', $bytes)
if (-not $ok) { throw "WritePrinter falhou (impressora offline ou nome incorreto)." }
`.trim();

    const psFile = path.join(os.tmpdir(), `boxsys-print-${Date.now()}.ps1`);
    fs.writeFileSync(psFile, script, "utf8");
    try {
      await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`, { shell: "cmd.exe" });
    } finally {
      fs.unlink(psFile, () => {});
    }
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

function cpfMask(cpf) {
  if (!cpf) return "";
  const d = String(cpf).replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// DANFE-NFC-e (cupom fiscal) em ESC/POS — mesmo padrão de buildEscPosBuffer, mas o
// texto CP860 e o comando binário do QR Code são montados como Buffers separados e
// concatenados no final, já que o QR Code não pode ser convertido junto com o texto.
function buildDanfeEscPosBuffer(data) {
  const config = getPrinterConfig();
  const width = config.widthMm === 58 ? 58 : 80;
  const cols = CHARS_PER_LINE[width];

  let out = CMD.init + CMD.codepagePortuguese;
  out += CMD.alignCenter + CMD.boldOn;
  for (const line of wrapLine(data.emitName || "", cols)) out += line + "\n";
  out += CMD.boldOff;

  if (data.emitAddress) for (const line of wrapLine(data.emitAddress, cols)) out += line + "\n";

  const cnpjFmt = String(data.emitCnpj || "").replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  out += `CNPJ: ${cnpjFmt}  IE: ${data.emitIe}\n`;

  out += CMD.boldOn;
  out += "DANFE NFC-e - Documento Auxiliar da\n";
  out += "Nota Fiscal de Consumidor Eletrônica\n";
  out += CMD.boldOff;

  if (data.ambiente === "homologacao") {
    out += CMD.boldOn;
    out += "EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO\n";
    out += "SEM VALOR FISCAL\n";
    out += CMD.boldOff;
  }

  out += CMD.alignLeft;
  out += "-".repeat(cols) + "\n";

  for (const item of data.items || []) {
    for (const line of wrapLine(item.name, cols)) out += line + "\n";
    const qtyStr = `${item.quantity} ${item.unitCom} x ${fmtMoney(item.unitPrice)}`;
    out += twoCol(qtyStr, fmtMoney(item.total), cols);
  }

  out += "-".repeat(cols) + "\n";
  out += CMD.boldOn + CMD.sizeDouble;
  out += twoCol("TOTAL", fmtMoney(data.total), Math.floor(cols / 2));
  out += CMD.sizeNormal + CMD.boldOff;

  out += `Pagamento: ${data.paymentMethod}\n`;
  if (data.customerCpf) {
    out += `CPF Consumidor: ${cpfMask(data.customerCpf)}\n`;
  } else if (data.customerName) {
    out += `Cliente: ${data.customerName}\n`;
  }

  out += "-".repeat(cols) + "\n";
  const dataEmi = data.dhEmi ? new Date(data.dhEmi).toLocaleString("pt-BR") : "";
  out += `NFC-e nº ${data.numero}  Série ${data.serie}\n`;
  out += `Emissão: ${dataEmi}\n`;
  for (const line of wrapLine(`Protocolo: ${data.protocolo}`, cols)) out += line + "\n";
  out += "Chave de acesso:\n";
  const chaveFmt = (String(data.chave).match(/.{1,4}/g) || []).join(" ");
  for (const line of wrapLine(chaveFmt, cols)) out += line + "\n";

  out += CMD.alignCenter + CMD.boldOn;
  out += "Consulte pela Chave de Acesso em:\n";
  out += CMD.boldOff;
  for (const line of wrapLine(data.consultaUrl, cols)) out += line + "\n";
  out += "\n";

  const textBuffer = iconv.encode(out, "cp860");
  const qrBuffer = data.qrCodeUrl ? qrCodeCommand(data.qrCodeUrl) : Buffer.alloc(0);

  let footer = "\n" + CMD.alignCenter;
  if (data.isSimplesNacional) {
    footer += "Documento emitido por ME/EPP optante pelo\n";
    footer += "Simples Nacional\n";
  }
  footer += CMD.feed(5) + CMD.cut;
  const footerBuffer = iconv.encode(footer, "cp860");

  return Buffer.concat([textBuffer, qrBuffer, footerBuffer]);
}

async function printDanfe(data) {
  const config = getPrinterConfig();
  if (!config.name) {
    throw new Error("Nenhuma impressora configurada. Aperte F9 para escolher a impressora térmica.");
  }
  const buffer = buildDanfeEscPosBuffer(data);
  await sendRawToPrinter(buffer, config.name);
}

function buildCashClosingEscPosBuffer(tenantName, summary) {
  const config = getPrinterConfig();
  const width = config.widthMm === 58 ? 58 : 80;
  const cols = CHARS_PER_LINE[width];

  const sangrias = (summary.movements || []).filter((m) => m.type === "SANGRIA");
  const suprimentos = (summary.movements || []).filter((m) => m.type === "SUPRIMENTO");
  const sangriaTotal = sangrias.reduce((s, m) => s + m.amount, 0);
  const suprimentoTotal = suprimentos.reduce((s, m) => s + m.amount, 0);

  let out = CMD.init + CMD.codepagePortuguese;
  out += CMD.alignCenter + CMD.boldOn;
  out += tenantName + "\n";
  out += "FECHAMENTO DE CAIXA\n";
  out += CMD.boldOff + CMD.alignLeft;

  out += `Abertura: ${new Date(summary.openedAt).toLocaleString("pt-BR")}\n`;
  out += `Fechamento: ${new Date(summary.closedAt || Date.now()).toLocaleString("pt-BR")}\n`;
  out += "-".repeat(cols) + "\n";

  out += `Pedidos no turno: ${summary.ordersCount}\n`;
  out += twoCol("Total vendido", fmtMoney(summary.grossTotal), cols);

  if ((summary.salesByMethod || []).length > 0) {
    out += CMD.boldOn + "Por forma de pagamento:\n" + CMD.boldOff;
    for (const entry of summary.salesByMethod) {
      out += twoCol(`  ${paymentLabel(entry.method)}`, fmtMoney(entry.total), cols);
    }
  }

  out += "-".repeat(cols) + "\n";
  out += twoCol("Fundo de abertura", fmtMoney(summary.openingBalance), cols);
  if (sangrias.length > 0) out += twoCol("Sangrias", `-${fmtMoney(sangriaTotal)}`, cols);
  if (suprimentos.length > 0) out += twoCol("Suprimentos", `+${fmtMoney(suprimentoTotal)}`, cols);

  out += "-".repeat(cols) + "\n";
  out += CMD.boldOn;
  out += twoCol("Esperado em caixa", fmtMoney(summary.expectedBalance), cols);
  out += twoCol("Contado", fmtMoney(summary.closingBalance), cols);
  const diff = summary.closingBalance - summary.expectedBalance;
  out += twoCol(diff < 0 ? "Falta" : "Sobra", fmtMoney(Math.abs(diff)), cols);
  out += CMD.boldOff;

  out += CMD.feed(5);
  out += CMD.cut;

  return iconv.encode(out, "cp860");
}

async function printCashClosingReport(tenantName, summary) {
  const config = getPrinterConfig();
  if (!config.name) {
    throw new Error("Nenhuma impressora configurada. Aperte F9 para escolher a impressora térmica.");
  }
  const buffer = buildCashClosingEscPosBuffer(tenantName, summary);
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

module.exports = { printReceipt, printCashClosingReport, printDanfe, testPrint, getPrinterConfig, setPrinterConfig, listPrinters };
