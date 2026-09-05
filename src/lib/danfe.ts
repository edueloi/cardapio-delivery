/**
 * Monta os dados do DANFE-NFC-e (representação visual da nota) a partir do XML
 * autorizado salvo em Order.nfceXml (procNFe completo). A lib nfewizard-io não gera
 * DANFE nem preenche o QR Code — ambos precisam ser montados manualmente aqui,
 * seguindo o Manual de Orientação do Contribuinte (MOC) da NFC-e.
 */
import type { FiscalConfig } from "../types.js";

export interface DanfeItem {
  name: string;
  quantity: number;
  unitCom: string;
  unitPrice: number;
  total: number;
}

export interface DanfeData {
  emitName: string;
  emitCnpj: string;
  emitIe: string;
  emitAddress: string; // já formatado, uma linha
  ambiente: "homologacao" | "producao";
  numero: number;
  serie: number;
  chave: string;
  protocolo: string;
  dhEmi: string; // ISO
  dhRecbto?: string; // ISO — data/hora de autorização
  items: DanfeItem[];
  total: number;
  paymentMethod: string;
  customerName?: string;
  customerCpf?: string;
  qrCodeUrl: string;
  consultaUrl: string; // URL de consulta pública (sem os parâmetros do QR), exibida por extenso
  isSimplesNacional: boolean; // CRT 1 ou 2 — exibe o aviso legal no rodapé do cupom
}

// Extrai um valor entre tags de um XML "achatado" via regex simples — o mesmo padrão
// já usado em fiscal.ts pra ler chNFe/nProt/cStat do retorno da SEFAZ.
function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
  return match?.[1]?.trim() ?? "";
}

function extractAllDet(xml: string): DanfeItem[] {
  const items: DanfeItem[] = [];
  const detBlocks = xml.match(/<det[^>]*>[\s\S]*?<\/det>/g) ?? [];
  for (const block of detBlocks) {
    const name = extractTag(block, "xProd");
    const qCom = parseFloat(extractTag(block, "qCom") || "0");
    const vUnCom = parseFloat(extractTag(block, "vUnCom") || "0");
    const vProd = parseFloat(extractTag(block, "vProd") || "0");
    const uCom = extractTag(block, "uCom") || "UN";
    if (name) items.push({ name, quantity: qCom, unitCom: uCom, unitPrice: vUnCom, total: vProd });
  }
  return items;
}

const PAYMENT_LABELS: Record<string, string> = {
  "01": "Dinheiro", "03": "Cartão de Crédito", "04": "Cartão de Débito",
  "10": "Vale Refeição", "17": "PIX", "99": "Outros",
};

function extractPayment(xml: string): { method: string; amount: number } {
  const tPag = extractTag(xml, "tPag");
  const vPag = parseFloat(extractTag(xml, "vPag") || "0");
  return { method: PAYMENT_LABELS[tPag] ?? tPag, amount: vPag };
}

/**
 * Monta a URL do QR Code da NFC-e. Fórmula oficial (MOC NFC-e, Anexo QR Code):
 * <urlConsulta>?chNFe=...&nVersao=100&tpAmb=...&cDest=...&dhEmi=...&vNF=...&vICMS=...&digVal=...&cIdToken=...&cHash=SHA1(<params>+CSC)
 * Em produção a maioria das UFs aceita a URL curta (só chave + parâmetros + hash),
 * sem os campos de conferência (dhEmi/vNF/vICMS/digVal) quando o XML já foi transmitido on-line (padrão CT-e/NFC-e "vFacil").
 */
// QR Code v3 (NT 2025.001) — mesmo formato usado na emissão real (ver patch de
// GerarConsulta.gerarConsulta em fiscal.ts). Como este app só emite em modo normal
// (tpEmis=1, síncrono), não em contingência, o formato correto é o mais simples: sem
// CSC/hash (v2) e sem assinatura digital (só exigida em contingência, tpEmis=9).
export function buildQrCodeUrl(params: {
  consultaUrlBase: string; // ex: getUrlQrCode(uf, ambiente)
  chave: string;
  tpAmb: "1" | "2"; // convenção OFICIAL da SEFAZ: 1=produção, 2=homologação
}): string {
  return `${params.consultaUrlBase}?p=${params.chave}|3|${params.tpAmb}`;
}

export function buildDanfeData(opts: {
  fiscal: FiscalConfig;
  emitName: string;
  emitAddress: string;
  numero: number;
  serie: number;
  chave: string;
  protocolo: string;
  xmlAutorizado: string;
  consultaUrlBase: string; // URL de consulta manual por chave (getUrlChave) — exibida por extenso no cupom
  qrCodeUrlBase: string; // endpoint específico de QR Code (getUrlQrCode) — usado no cálculo de qrCodeUrl
  customerName?: string;
  customerCpf?: string;
  // Nomes reais dos produtos, na mesma ordem dos itens do pedido — usados só pra EXIBIÇÃO
  // no DANFE. Em homologação o xProd do primeiro item no XML fiscal é substituído pelo
  // texto fixo exigido pela SEFAZ ("NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO...",
  // ver fiscal.ts), então extrair o nome direto do XML mostraria esse texto genérico em
  // vez do produto de verdade no cupom impresso — a exigência é sobre o XML, não sobre a
  // representação visual.
  realItemNames?: string[];
}): DanfeData {
  const { fiscal, xmlAutorizado } = opts;
  const dhEmi = extractTag(xmlAutorizado, "dhEmi");
  const dhRecbto = extractTag(xmlAutorizado, "dhRecbto");
  const items = extractAllDet(xmlAutorizado);
  if (opts.realItemNames) {
    items.forEach((item, i) => {
      if (opts.realItemNames![i]) item.name = opts.realItemNames![i];
    });
  }
  const total = parseFloat(extractTag(xmlAutorizado, "vNF") || "0");
  const payment = extractPayment(xmlAutorizado);

  // tpAmb aqui usa a convenção OFICIAL da SEFAZ (1=produção, 2=homologação), OPOSTA à
  // convenção interna deste app (fiscal.ambiente: "homologacao"/"producao" como string,
  // sem herdar a numeração oficial) — mesma inversão já tratada em fiscal.ts.
  const qrCodeUrl = buildQrCodeUrl({
    consultaUrlBase: opts.qrCodeUrlBase,
    chave: opts.chave,
    tpAmb: fiscal.ambiente === "producao" ? "1" : "2",
  });

  return {
    emitName: opts.emitName,
    emitCnpj: fiscal.cnpj.replace(/\D/g, ""),
    emitIe: fiscal.ie.replace(/\D/g, ""),
    emitAddress: opts.emitAddress,
    ambiente: fiscal.ambiente,
    numero: opts.numero,
    serie: opts.serie,
    chave: opts.chave,
    protocolo: opts.protocolo,
    dhEmi,
    dhRecbto,
    items,
    total,
    paymentMethod: payment.method,
    customerName: opts.customerName,
    customerCpf: opts.customerCpf,
    qrCodeUrl,
    consultaUrl: opts.consultaUrlBase,
    isSimplesNacional: fiscal.crt === "1" || fiscal.crt === "2",
  };
}
