/**
 * Serviço de emissão NFC-e (modelo 65) usando nfewizard-io.
 * Cada tenant tem sua própria configuração fiscal (CNPJ, IE, CSC, certificado A1).
 * O wizard é inicializado sob demanda e cacheado por tenant.
 */

import { NFeWizard } from "nfewizard-io";
import type { FiscalConfig, NfceResult } from "../types.js";
import path from "path";
import os from "os";
import fs from "fs";
import forge from "node-forge";

// Cache de instâncias inicializadas por tenantId
const wizardCache = new Map<string, NFeWizard>();

export interface ParsedCertInfo {
  titularCnpj: string | null;
  titularCpf: string | null;
  validFrom: Date;
  validTo: Date;
}

/**
 * Abre um certificado A1 (.pfx/.p12) e extrai CNPJ/CPF do titular e validade —
 * usado pra validar senha e conferir o CNPJ ANTES de gravar o certificado, em vez
 * de só descobrir problema (senha errada, cert vencido, CNPJ diferente) na hora de
 * emitir uma nota de verdade. Lança erro com mensagem amigável se algo não bater.
 */
export function parseCertificate(certBase64: string, password: string): ParsedCertInfo {
  let pfx;
  try {
    const der = forge.util.decode64(certBase64);
    const asn1 = forge.asn1.fromDer(der);
    pfx = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  } catch {
    throw new Error("Senha do certificado incorreta ou arquivo inválido.");
  }

  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
  if (!certBags || certBags.length === 0) {
    throw new Error("Certificado inválido: nenhum certificado X.509 encontrado no arquivo.");
  }
  const allCerts = certBags.map((b) => b.cert).filter((c): c is forge.pki.Certificate => !!c);

  // O certificado do titular é o único que não é "issuer" de nenhum outro do pacote
  // (a cadeia intermediária/raiz sempre é emissora de alguém; a ponta, de ninguém).
  const issuerNames = new Set(
    allCerts.map((c) => c.issuer.attributes.map((a) => `${a.shortName}=${a.value}`).join(","))
  );
  const isIssuerOfSomeone = (c: forge.pki.Certificate) => {
    const subjectName = c.subject.attributes.map((a) => `${a.shortName}=${a.value}`).join(",");
    return issuerNames.has(subjectName);
  };
  const leaf = allCerts.find((c) => !isIssuerOfSomeone(c)) || allCerts[0];

  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag];
  if (!keyBags || keyBags.length === 0 || !keyBags[0].key) {
    throw new Error("Certificado inválido: chave privada não encontrada no arquivo.");
  }

  // CPF/CNPJ do titular embutido no CN (padrão ICP-Brasil): e-CPF traz "CN=NOME:CPF"
  // (11 dígitos) e e-CNPJ traz "CN=NOME:CPF:CNPJ" — nunca usar "OU" pra isso, pois costuma
  // trazer o CNPJ da Autoridade Certificadora, não o do titular.
  const cn = leaf.subject.getField("CN")?.value || "";
  const cpfMatch = cn.match(/:(\d{11})(?::|$)/);
  const cnpjMatch = cn.match(/:(\d{14})(?::|$)/);

  return {
    titularCnpj: cnpjMatch ? cnpjMatch[1] : null,
    titularCpf: cpfMatch ? cpfMatch[1] : null,
    validFrom: leaf.validity.notBefore,
    validTo: leaf.validity.notAfter,
  };
}

function getTempDir(tenantId: string): string {
  const dir = path.join(os.tmpdir(), "boxsys-nfce", tenantId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeCertToTemp(tenantId: string, certBase64: string): string {
  const dir = getTempDir(tenantId);
  const certPath = path.join(dir, "cert.pfx");
  fs.writeFileSync(certPath, Buffer.from(certBase64, "base64"));
  return certPath;
}

async function getWizard(tenantId: string, fiscal: FiscalConfig): Promise<NFeWizard> {
  const cached = wizardCache.get(tenantId);
  if (cached) return cached;

  if (!fiscal.certBase64) throw new Error("Certificado A1 não configurado.");

  const certPath = writeCertToTemp(tenantId, fiscal.certBase64);
  const tmpDir = getTempDir(tenantId);

  const wizard = new NFeWizard();

  await wizard.NFE_LoadEnvironment({
    config: {
      dfe: {
        pathCertificado: certPath,
        senhaCertificado: fiscal.certPassword ?? "",
        UF: fiscal.uf,
        CPFCNPJ: fiscal.cnpj.replace(/\D/g, ""),
        armazenarXMLAutorizacao: true,
        armazenarXMLRetornoAutorizacao: true,
        armazenarXMLCancelamento: true,
        pathXMLAutorizacao: path.join(tmpDir, "autorizado"),
        pathXMLRetornoAutorizacao: path.join(tmpDir, "retorno"),
        pathXMLCancelamento: path.join(tmpDir, "cancelado"),
        incluirTimestampNoNomeDosArquivos: false,
      },
      nfe: {
        // 1 = homologação, 2 = produção
        ambiente: fiscal.ambiente === "producao" ? 2 : 1,
        versaoDF: "4.00",
        idCSC: parseInt(fiscal.cscId, 10),
        tokenCSC: fiscal.csc,
        modelo: 65,
      },
      lib: {
        useForSchemaValidation: "validateSchemaJsBased",
        connection: { timeout: 30000 },
        log: {
          exibirLogNoConsole: false,
          armazenarLogs: false,
          pathLogs: path.join(tmpDir, "logs"),
        },
      },
    } as any,
  });

  wizardCache.set(tenantId, wizard);
  return wizard;
}

// Invalida cache quando config muda (ex: troca de certificado)
export function invalidateFiscalCache(tenantId: string) {
  wizardCache.delete(tenantId);
}

// ─────────────────────────────────────────────────────────────────────────────

export interface NfceOrderItem {
  productName: string;
  ncm: string;
  cfop: string;
  csosn: string;
  unitCom: string;
  origem: number;
  aliqIcms: number;
  quantity: number;
  unitPrice: number; // já com desconto unitário aplicado
}

export interface NfceOrderData {
  numero: number;      // próximo número sequencial da série
  serie: number;
  items: NfceOrderItem[];
  total: number;
  paymentMethod: string; // CASH | PIX | CREDIT | DEBIT | VR | STONE_*
  customerName?: string;
  customerCpf?: string; // opcional — CPF (11 dígitos) ou CNPJ (14 dígitos) do destinatário
  emitName: string;     // razão social / nome do estabelecimento emitente
  emitAddress: {
    street: string;
    number: string;
    neighborhood: string;
    cep: string;
  };
}

function mapPaymentCode(method: string): { tPag: string; xPag?: string } {
  const m = method.toUpperCase();
  if (m === "CASH") return { tPag: "01" };
  if (m === "DEBIT" || m.startsWith("STONE_DEBIT")) return { tPag: "04" };
  if (m === "CREDIT" || m.startsWith("STONE_CREDIT")) return { tPag: "03" };
  if (m === "PIX" || m.startsWith("STONE_PIX")) return { tPag: "17" };
  if (m === "VR") return { tPag: "10" }; // vale refeição
  return { tPag: "99", xPag: method }; // outros
}

export async function emitirNfce(
  tenantId: string,
  fiscal: FiscalConfig,
  order: NfceOrderData
): Promise<NfceResult> {
  const wizard = await getWizard(tenantId, fiscal);

  const now = new Date();
  const dhEmi = now.toISOString().replace("Z", "-03:00");
  const cnpjClean = fiscal.cnpj.replace(/\D/g, "");
  const ieClean = fiscal.ie.replace(/\D/g, "");
  // Documento do destinatário — aceita CPF (11 dígitos, pessoa física) ou CNPJ
  // (14 dígitos, pessoa jurídica); qualquer outro tamanho é ignorado (documento inválido).
  const destDocDigits = order.customerCpf?.replace(/\D/g, "") ?? "";
  const destDocClean =
    destDocDigits.length === 11 || destDocDigits.length === 14 ? destDocDigits : "";
  const destIsCnpj = destDocClean.length === 14;
  const { tPag, xPag } = mapPaymentCode(order.paymentMethod);

  const det = order.items.map((item, i) => {
    const vProd = parseFloat((item.quantity * item.unitPrice).toFixed(2));
    return {
      nItem: i + 1,
      prod: {
        cProd: String(i + 1).padStart(4, "0"),
        cEAN: "SEM GTIN",
        xProd: item.productName.slice(0, 120),
        NCM: item.ncm.replace(/\D/g, "").slice(0, 8).padStart(8, "0"),
        CFOP: item.cfop || "5102",
        uCom: item.unitCom || "UN",
        qCom: item.quantity,
        vUnCom: parseFloat(item.unitPrice.toFixed(2)),
        vProd,
        cEANTrib: "SEM GTIN",
        uTrib: item.unitCom || "UN",
        qTrib: item.quantity,
        vUnTrib: parseFloat(item.unitPrice.toFixed(2)),
        indTot: 1,
      },
      imposto: {
        ICMS: {
          dadosICMS: {
            orig: item.origem ?? 0,
            CSOSN: item.csosn || "400",
          },
        },
        PIS: {
          dadosPIS: { CST: "07" },
        },
        COFINS: {
          dadosCOFINS: { CST: "07" },
        },
      },
    };
  });

  const vNF = parseFloat(order.total.toFixed(2));

  const nfeData = {
    NFe: {
      infNFe: {
        // Identificação
        ide: {
          cUF: getCUF(fiscal.uf),
          cNF: String(order.numero).padStart(8, "0"),
          natOp: "VENDA AO CONSUMIDOR",
          mod: 65,
          serie: order.serie,
          nNF: order.numero,
          dhEmi,
          tpNF: 1,       // saída
          idDest: 1,      // operação interna
          cMunFG: parseInt(fiscal.cMun, 10),
          tpImp: 4,       // DANFE NFC-e
          tpEmis: 1,      // emissão normal
          tpAmb: fiscal.ambiente === "producao" ? 2 : 1,
          finNFe: 1,      // NF-e normal
          indFinal: 1,    // consumidor final
          indPres: 1,     // operação presencial
          procEmi: 0,     // emissão pelo contribuinte
          verProc: "1.0.0.0",
        },
        // Emitente
        emit: {
          CNPJCPF: cnpjClean,
          xNome: fiscal.ambiente === "producao" ? order.emitName.slice(0, 60) : "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL",
          IE: ieClean,
          CRT: parseInt(fiscal.crt, 10),
          enderEmit: {
            xLgr: order.emitAddress.street || "Nao informado",
            nro: order.emitAddress.number || "S/N",
            xBairro: order.emitAddress.neighborhood || "Nao informado",
            cMun: parseInt(fiscal.cMun, 10),
            xMun: fiscal.xMun,
            UF: fiscal.uf,
            CEP: order.emitAddress.cep.replace(/\D/g, "") || "00000000",
            cPais: 1058,
            xPais: "Brasil",
          },
        },
        // Destinatário — CPF (Nota Fiscal Paulista) ou CNPJ (compra em nome de empresa),
        // ambos opcionais. Para CNPJ, indIEDest=9 declara "não contribuinte" — não temos
        // captura de Inscrição Estadual do destinatário no PDV, então esse é o valor
        // seguro pra não travar a autorização por falta de IE.
        ...(destDocClean
          ? {
              dest: {
                CNPJCPF: destDocClean,
                xNome: order.customerName?.slice(0, 60) || undefined,
                ...(destIsCnpj ? { indIEDest: 9 } : {}),
              },
            }
          : {}),
        // Itens
        det,
        // Totais
        total: {
          ICMSTot: {
            vBC: 0,
            vICMS: 0,
            vICMSDeson: 0,
            vFCPUFDest: 0,
            vICMSUFDest: 0,
            vICMSUFRemet: 0,
            vFCP: 0,
            vBCST: 0,
            vST: 0,
            vFCPST: 0,
            vFCPSTRet: 0,
            vProd: vNF,
            vFrete: 0,
            vSeg: 0,
            vDesc: 0,
            vII: 0,
            vIPI: 0,
            vIPIDevol: 0,
            vPIS: 0,
            vCOFINS: 0,
            vOutro: 0,
            vNF,
          },
        },
        // Transporte (sem transportador — consumidor retira ou delivery próprio)
        transp: {
          modFrete: 9, // sem frete
        },
        // Pagamento
        pag: {
          detPag: [{ tPag, ...(xPag ? { xPag } : {}), vPag: vNF }],
        },
        // QR Code NFC-e
        infNFeSupl: {
          qrCode: "", // preenchido automaticamente pela lib
          urlChave: getUrlChave(fiscal.uf, fiscal.ambiente),
        },
      },
    },
  };

  try {
    const result = await (wizard as any).NFE_Autorizacao(nfeData);

    // result é array de XMLs autorizados
    if (!result || !result.length) {
      return { status: "REJECTED", motivo: "Sem resposta da SEFAZ" };
    }

    const xmlAutorizado: string = result[0];
    // Extrai chave e protocolo do XML retornado
    const chaveMatch = xmlAutorizado.match(/chNFe>([^<]+)/);
    const protMatch = xmlAutorizado.match(/nProt>([^<]+)/);
    const cStatMatch = xmlAutorizado.match(/cStat>([^<]+)/);

    const chave = chaveMatch?.[1]?.trim() ?? "";
    const protocolo = protMatch?.[1]?.trim() ?? "";
    const cStat = cStatMatch?.[1]?.trim() ?? "";

    // 100 = autorizado; 150 = autorizado fora de prazo
    if (cStat === "100" || cStat === "150") {
      return {
        status: "AUTHORIZED",
        chave,
        protocolo,
        numero: order.numero,
        xmlAutorizado,
      };
    }

    const motivoMatch = xmlAutorizado.match(/xMotivo>([^<]+)/);
    return {
      status: "REJECTED",
      chave,
      protocolo,
      motivo: motivoMatch?.[1]?.trim() ?? `cStat ${cStat}`,
    };
  } catch (err: any) {
    return { status: "REJECTED", motivo: err?.message ?? "Erro desconhecido" };
  }
}

export async function cancelarNfce(
  tenantId: string,
  fiscal: FiscalConfig,
  chave: string,
  protocolo: string,
  justificativa: string
): Promise<{ success: boolean; motivo?: string }> {
  const wizard = await getWizard(tenantId, fiscal);

  try {
    await (wizard as any).NFE_Cancelamento({
      chNFe: chave,
      nProt: protocolo,
      xJust: justificativa.slice(0, 255).padEnd(15, " "),
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, motivo: err?.message };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Tabela simplificada cUF (código IBGE da UF)
export function getCUF(uf: string): number {
  const map: Record<string, number> = {
    AC: 12, AL: 27, AP: 16, AM: 13, BA: 29, CE: 23, DF: 53, ES: 32,
    GO: 52, MA: 21, MT: 51, MS: 50, MG: 31, PA: 15, PB: 25, PR: 41,
    PE: 26, PI: 22, RJ: 33, RN: 24, RS: 43, RO: 11, RR: 14, SC: 42,
    SP: 35, SE: 28, TO: 17,
  };
  return map[uf.toUpperCase()] ?? 35;
}

export function getUrlChave(uf: string, ambiente: "homologacao" | "producao"): string {
  if (ambiente === "homologacao") {
    return "https://hom.sefaz.rs.gov.br/nfce/consulta"; // genérico homologação
  }
  // URLs de consulta por UF (simplificado — as mais usadas)
  const map: Record<string, string> = {
    SP: "https://www.nfce.fazenda.sp.gov.br/consulta",
    PR: "https://www.nfce.pr.gov.br/nfce/consulta",
    RJ: "https://nfce.fazenda.rj.gov.br/consulta",
    MG: "https://nfce.fazenda.mg.gov.br/portalnfce",
    RS: "https://www.sefaz.rs.gov.br/nfce/consulta",
    SC: "https://sat.sef.sc.gov.br/nfce/consulta",
    BA: "https://nfe.sefaz.ba.gov.br/servicos/nfce/consulta.aspx",
    CE: "https://nfceh.sefaz.ce.gov.br/pages/ShowNFCe.html",
    GO: "https://go.gov.br/portalnfce",
  };
  return map[uf.toUpperCase()] ?? `https://www.nfe.fazenda.gov.br/consulta`;
}
