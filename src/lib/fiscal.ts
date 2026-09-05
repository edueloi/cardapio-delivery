/**
 * Serviço de emissão NFC-e (modelo 65) usando nfewizard-io.
 * Cada tenant tem sua própria configuração fiscal (CNPJ, IE, CSC, certificado A1).
 * O wizard é inicializado sob demanda e cacheado por tenant.
 */

import { NFeWizard } from "nfewizard-io";
import { GerarConsulta, Utility } from "@nfewizard/shared";
import type { FiscalConfig, NfceResult } from "../types.js";
import path from "path";
import os from "os";
import fs from "fs";
import { randomInt } from "crypto";
import forge from "node-forge";

// Bug da nfewizard-io@1.1.2: NFEAutorizacaoService.Exec (usado por wizard.NFE_Autorizacao,
// chamado em emitirNfce) chama gerarConsulta.gerarConsulta(xmlConsulta, this.metodo) com
// só 2 argumentos — nunca passa o 5º parâmetro "mod", que por isso cai sempre no default
// "NFe" (55). Isso faz getWebServiceUrl montar a chave "NFe_SP_H" em vez de "NFCe_SP_H" e
// escolher o webservice de NF-e normal, mesmo com NFe.infNFe.ide.mod: 65 correto no XML —
// SEFAZ rejeita com "Modelo da NF-e diferente de 55" (o serviço acessado é modelo 55, o
// XML enviado é modelo 65). Um patch anterior em BaseNFE.getModelo() não resolvia porque
// NFEAutorizacaoService.Exec nunca chama getModelo() nesse fluxo — o "mod" é hardcoded na
// chamada, não decidido dinamicamente.
// Como NFEAutorizacaoService não é exportada publicamente (só instanciada internamente
// pela lib), o ponto de patch possível é GerarConsulta.gerarConsulta em si (exportada por
// @nfewizard/shared): quando "mod" vier no default "NFe" mas o XML de fato declarar
// mod=65, força "NFCe" antes de montar a URL.
const originalGerarConsulta = GerarConsulta.prototype.gerarConsulta;
(GerarConsulta.prototype as any).gerarConsulta = function (
  xmlConsulta: string,
  metodo: string,
  ambienteNacional?: boolean,
  versao?: string,
  mod?: string,
  ...rest: any[]
) {
  const modReal = (mod === undefined || mod === "NFe") && /<mod>65<\/mod>/.test(xmlConsulta)
    ? "NFCe"
    : mod;
  return originalGerarConsulta.call(this, xmlConsulta, metodo, ambienteNacional, versao, modReal, ...rest);
};

// Utility.setAmbiente (@nfewizard/shared, usado por getWebServiceUrl no fluxo de
// NFe/NFC-e, o único caminho de emitirNfce) monta a chave de URL do webservice assumindo
// a convenção OFICIAL da SEFAZ (1=produção, 2=homologação): "ambiente === 2 ? 'H' : 'P'".
// Essa lib está correta nesse ponto (confere com as outras 3 ocorrências do mesmo padrão
// no mesmo arquivo: getWebServiceUrlNFSe, getWebServiceUrl/NFSe, getWebServiceUrl/CTe,
// todas usando "=== 1 ? 'P' : 'H'"). O problema é que ESTE app usa a convenção INVERSA
// internamente (fiscal.ts, FiscalConfig, getUrlChave etc. tratam 1=homologação,
// 2=produção) — então "ambiente: 1" (que getWizard() envia pra homologação) chega na lib
// como "1=produção" e ela chama o webservice de PRODUÇÃO mesmo com tpAmb=1 no XML. A nota
// cai num CNPJ não credenciado em produção e a SEFAZ rejeita com "CNPJ Emitente não
// cadastrado" mesmo já feito o credenciamento em homologação. Em vez de inverter a
// convenção em todo o resto do app (getWizard, tpAmb no XML, getUrlChave, etc.), o patch
// aqui só recalcula a chave com a convenção deste app (1=homologação → 'H'), mantendo
// tudo mais como já está.
const originalSetAmbiente = (Utility.prototype as any).setAmbiente;
(Utility.prototype as any).setAmbiente = function (
  metodo: string,
  ambienteNacional = false,
  versao?: string,
  mod?: string
) {
  const config = (this as any).environment.getConfig();
  const ambiente = config.nfe.ambiente === 1 ? "H" : "P";
  const versaoDF = versao !== "" ? versao : config.nfe.versaoDF;
  if (ambienteNacional) {
    return { chaveMae: `${mod}_AN_${ambiente}`, chaveFilha: `${metodo}_${versaoDF}` };
  }
  return { chaveMae: `${mod}_${config.dfe.UF}_${ambiente}`, chaveFilha: `${metodo}_${versaoDF}` };
};
void originalSetAmbiente;

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

// now.toISOString() sempre retorna a hora em UTC (ex: "2026-09-05T13:24:43.000Z"). Um bug
// anterior só trocava o "Z" por "-03:00" mantendo os dígitos em UTC — isso muda a SEMÂNTICA
// do timestamp (de "13:24 UTC" para "13:24 no fuso -03:00", que equivale a 16:24 UTC),
// adiantando o relógio em 3h e fazendo a SEFAZ rejeitar com "Data-Hora de Emissão posterior
// ao horário de recebimento" (rejeição 234). Aqui deslocamos o Date em -3h e lemos os
// campos via getUTC*, o que dá a hora real de Brasília sem depender do timezone do SO.
function dhEmiBrasilia(date: Date): string {
  const shifted = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = shifted.getUTCFullYear();
  const MM = pad(shifted.getUTCMonth() + 1);
  const dd = pad(shifted.getUTCDate());
  const HH = pad(shifted.getUTCHours());
  const mm = pad(shifted.getUTCMinutes());
  const ss = pad(shifted.getUTCSeconds());
  return `${yyyy}-${MM}-${dd}T${HH}:${mm}:${ss}-03:00`;
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

// cNF precisa ser aleatório (não derivado de nNF/data/etc.) — existe só para evitar
// colisão de chave de acesso entre notas com o mesmo número (comum em contingência ou
// mudança de série). Usar um valor previsível (ex: igual a nNF) é rejeitado pela SEFAZ
// (rejeição 217: "Código numérico (cNF) inválido") mesmo passando na validação de schema,
// que só checa o formato de 8 dígitos.
function gerarCNF(): string {
  return String(randomInt(1, 100_000_000)).padStart(8, "0");
}

export async function emitirNfce(
  tenantId: string,
  fiscal: FiscalConfig,
  order: NfceOrderData
): Promise<NfceResult> {
  const wizard = await getWizard(tenantId, fiscal);

  const now = new Date();
  const dhEmi = dhEmiBrasilia(now);
  const cnpjClean = fiscal.cnpj.replace(/\D/g, "");
  const ieClean = fiscal.ie.replace(/\D/g, "");
  // Documento do destinatário — aceita CPF (11 dígitos, pessoa física) ou CNPJ
  // (14 dígitos, pessoa jurídica); qualquer outro tamanho é ignorado (documento inválido).
  const destDocDigits = order.customerCpf?.replace(/\D/g, "") ?? "";
  const destDocClean =
    destDocDigits.length === 11 || destDocDigits.length === 14 ? destDocDigits : "";
  const { tPag, xPag } = mapPaymentCode(order.paymentMethod);

  // Acumulado do grupo IBS/CBS de todos os itens, usado no totalizador da nota
  // (total.IBSCBSTot) — a SEFAZ exige esse total além do grupo em cada item.
  let vBCIBSCBSTotal = 0;
  let vIBSUFTotal = 0;
  let vCBSTotal = 0;

  const det = order.items.map((item, i) => {
    const vProd = parseFloat((item.quantity * item.unitPrice).toFixed(2));
    // nItem NÃO deve ser propriedade do objeto aqui — nItem é um ATRIBUTO XML de <det>
    // (<det nItem="1">), não um elemento filho. A lib (nfewizard-io, gerarXmlNFeAutorizacao)
    // já injeta { $: { nItem: index + 1 } } automaticamente ao montar cada item via
    // ...det — mas se "nItem" existisse aqui como propriedade solta, ela sobrevivia ao
    // spread ao lado de "$" e o xml2js serializava as duas coisas: o atributo (correto)
    // E um <nItem> como elemento filho solto antes de <prod> (rejeitado pelo XSD).
    return {
      prod: {
        cProd: String(i + 1).padStart(4, "0"),
        cEAN: "SEM GTIN",
        // Em homologação a SEFAZ exige que o xProd do PRIMEIRO item seja exatamente esse
        // texto fixo (mesma exigência que já tratávamos só no xNome do emitente) — regra
        // de negócio específica de homologação, não parte do XSD.
        xProd:
          fiscal.ambiente !== "producao" && i === 0
            ? "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"
            : item.productName.slice(0, 120),
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
            // mountICMS (nfewizard-io) usa este valor pra decidir o grupo ICMS (ICMSMap)
            // E grava ele, sem modificação, no campo <CSOSN> final do XML — então precisa
            // ser exatamente o código de 3 dígitos puro (sem padding), já que o XSD só
            // aceita "102"/"103"/"300"/"400" etc., não "0102". CSOSN de 3 dígitos já bate
            // direto com as chaves do ICMSMap da lib, sem precisar de nenhum ajuste.
            // "400" era o default antigo do cadastro de produto, mas não existe no
            // ICMSMap da lib (cai no fallback ICMS00, que exige CST e gera XML inválido)
            // — produtos salvos antes do fix caem aqui, tratados como se fosse "102".
            // 102 = Tributada pelo Simples Nacional sem permissão de crédito — padrão
            // para venda de produtos por optante do Simples Nacional (ex: lanchonete).
            CSOSN: item.csosn && item.csosn !== "400" ? item.csosn : "102",
          },
        },
        PIS: {
          dadosPIS: { CST: "07" },
        },
        COFINS: {
          dadosCOFINS: { CST: "07" },
        },
        // Grupo da Reforma Tributária (IBS/CBS, NT 2025.002) — SEFAZ-SP já valida esse
        // grupo em homologação mesmo a obrigatoriedade oficial em produção para o Simples
        // Nacional (CRT=1) só começando em 2027 (LC 214/2025 art. 348, III, "c" isenta
        // optantes do Simples da cobrança em 2026). A lib (nfewizard-io) ainda não tem
        // lógica própria de montagem pra esse grupo (só os tipos existem em
        // @nfewizard/types), então montamos o objeto na mão, na posição exigida pelo XSD
        // (depois de ICMS/PIS/COFINS, dentro de <imposto>). As alíquotas de 2026 são fixas
        // por lei (art. 343/346 da LC 214/2025): pIBSUF=0,1% e pCBS=0,9% — são "alíquotas
        // de teste" do período de transição (ensaio operacional, sem aumento real de
        // carga: o valor recolhido é compensado/dispensado), zerar em vez de usar esses
        // valores fixos é o que causa "Alíquota do IBS da UF inválida".
        ...(() => {
          // O XSD exige pIBSUF/pCBS com no mínimo 2 casas decimais (padrão
          // "0|0\.[0-9]{2,4}|...") — "0.1" como number serializa sem o zero à direita e
          // quebra a validação ("value '0.1' is not accepted by the pattern"). Só nesses
          // dois campos de alíquota enviamos string já formatada com toFixed(2).
          const pIBSUF = 0.1;
          const pCBS = 0.9;
          const vIBSUF = parseFloat(((vProd * pIBSUF) / 100).toFixed(2));
          const vCBS = parseFloat(((vProd * pCBS) / 100).toFixed(2));
          vBCIBSCBSTotal = parseFloat((vBCIBSCBSTotal + vProd).toFixed(2));
          vIBSUFTotal = parseFloat((vIBSUFTotal + vIBSUF).toFixed(2));
          vCBSTotal = parseFloat((vCBSTotal + vCBS).toFixed(2));
          return {
            IBSCBS: {
              CST: "000",
              cClassTrib: "000001",
              gIBSCBS: {
                vBC: vProd,
                gIBSUF: { pIBSUF: pIBSUF.toFixed(2), vIBSUF },
                gIBSMun: { pIBSMun: (0).toFixed(2), vIBSMun: 0 },
                vIBS: vIBSUF,
                gCBS: { pCBS: pCBS.toFixed(2), vCBS },
              },
            },
          };
        })(),
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
          cNF: gerarCNF(),
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
          // Placeholder — a lib sobrescreve com o dígito verificador calculado da chave
          // de acesso (NFe.infNFe.ide.cDV = dv). Precisa já existir aqui, na posição exigida
          // pelo XSD (entre tpEmis e tpAmb): reatribuir uma chave existente preserva a posição,
          // mas se a chave não existisse a lib a inseriria no fim do objeto (ordem de inserção
          // é o que o xml2js usa pra serializar), quebrando a sequência exigida pela SEFAZ.
          cDV: 0,
          // tpAmb é o campo oficial do XSD/SEFAZ (1=Produção, 2=Homologação — convenção
          // OPOSTA à que este app usa internamente em fiscal.ambiente, que trata
          // "homologacao"/"producao" como string e não herda a numeração oficial). Antes
          // enviávamos "producao"→2/"homologacao"→1, invertido, e a nota chegava no
          // webservice certo (após o patch de setAmbiente) mas com tpAmb divergente do
          // ambiente real do servidor — SEFAZ rejeita com "Ambiente informado diverge do
          // Ambiente de recebimento".
          tpAmb: fiscal.ambiente === "producao" ? 1 : 2,
          finNFe: 1,      // NF-e normal
          indFinal: 1,    // consumidor final
          indPres: 1,     // operação presencial
          procEmi: 0,     // emissão pelo contribuinte
          verProc: "1.0.0.0",
        },
        // Emitente — ordem exigida pelo XSD (TEmit): CNPJ/CPF, xNome, xFant?, enderEmit,
        // IE, IEST?, IM?, CNAE?, CRT. enderEmit precisa vir ANTES de IE/CRT, não depois
        // (mesma classe de bug do cDV: a lib reconstrói só a chave de documento via
        // Object.assign, o resto mantém a ordem de inserção deste objeto).
        emit: {
          CNPJCPF: cnpjClean,
          xNome: fiscal.ambiente === "producao" ? order.emitName.slice(0, 60) : "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL",
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
          IE: ieClean,
          CRT: parseInt(fiscal.crt, 10),
        },
        // Destinatário — CPF (Nota Fiscal Paulista) ou CNPJ (compra em nome de empresa),
        // ambos opcionais. indIEDest é obrigatório no XSD sempre que "dest" existe (não é
        // opcional lá) — usamos 9 ("não contribuinte") tanto para CPF quanto CNPJ, já que
        // em venda a consumidor final o destinatário nunca é contribuinte de ICMS e não
        // capturamos Inscrição Estadual do destinatário no PDV.
        ...(destDocClean
          ? {
              dest: {
                CNPJCPF: destDocClean,
                xNome: order.customerName?.slice(0, 60) || undefined,
                indIEDest: 9,
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
          // Totalizador do grupo IBS/CBS (Reforma Tributária) — irmão de ICMSTot dentro
          // de <total>, exigido pela SEFAZ além do grupo já preenchido em cada item
          // ("Total de IBS e CBS não informado" sem isso). vBCIBSCBS/vIBSUF/vCBS são os
          // únicos campos obrigatórios de TIBSCBSMonoTot fora do minOccurs="0" — dentro de
          // gIBS/gCBS, porém, vDif/vDevTrib são obrigatórios assim que o bloco existe.
          IBSCBSTot: {
            vBCIBSCBS: vBCIBSCBSTotal,
            gIBS: {
              gIBSUF: { vDif: 0, vDevTrib: 0, vIBSUF: vIBSUFTotal },
              gIBSMun: { vDif: 0, vDevTrib: 0, vIBSMun: 0 },
              vIBS: vIBSUFTotal,
              vCredPres: 0,
              vCredPresCondSus: 0,
            },
            gCBS: {
              vDif: 0,
              vDevTrib: 0,
              vCBS: vCBSTotal,
              vCredPres: 0,
              vCredPresCondSus: 0,
            },
          },
        },
        // Transporte (sem transportador — consumidor retira ou delivery próprio)
        transp: {
          modFrete: 9, // sem frete
        },
        // Pagamento
        // Grupo "card" é exigido pela SEFAZ (regra de negócio, não XSD) sempre que
        // tPag = 03 (crédito) ou 04 (débito) — sem ele a nota é rejeitada com "Não
        // informados os dados do cartão de crédito / débito". Único campo obrigatório
        // do grupo é tpIntegra; usamos "2" (não integrado, tipo POS simples) como
        // padrão seguro, já que hoje o PDV não tem garantia de que o pagamento passou
        // por uma maquininha de fato integrada via API (TEF/POS) no momento da venda.
        pag: {
          detPag: [
            {
              tPag,
              ...(xPag ? { xPag } : {}),
              vPag: vNF,
              ...(tPag === "03" || tPag === "04" ? { card: { tpIntegra: "2" } } : {}),
            },
          ],
        },
      },
      // infNFeSupl (QR Code) é irmão de infNFe dentro de NFe, NÃO filho de infNFe —
      // o XSD (TNFe) só tem dois elementos de primeiro nível: infNFe e infNFeSupl.
      // A sequência interna de infNFe termina em elementos opcionais (agropecuario etc.),
      // então aninhar infNFeSupl ali dentro é rejeitado pelo validador da SEFAZ.
      infNFeSupl: {
        qrCode: "", // preenchido automaticamente pela lib
        urlChave: getUrlChave(fiscal.uf, fiscal.ambiente),
      },
    },
  };

  try {
    // idLote é exigido pela SEFAZ (numérico, 1-15 dígitos) mas não faz parte do tipo
    // público de NFE_Autorizacao nem é gerado pela lib — sem isso ela serializa
    // "<idLote></idLote>" vazio e a nota é rejeitada na validação do XML.
    // indSinc=1 (emissão síncrona) é o padrão exigido para NFC-e (modelo 65).
    console.log(
      "[Fiscal] Emitindo NFC-e — mod no XML:", nfeData.NFe.infNFe.ide.mod,
      "| ambiente:", fiscal.ambiente,
      "| uf:", fiscal.uf
    );
    const result = await (wizard as any).NFE_Autorizacao({
      idLote: String(Date.now()).slice(-15),
      indSinc: 1,
      ...nfeData,
    });

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
    console.error("[Fiscal] NFE_Autorizacao rejeitada/falhou:", err?.message ?? err);
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

// URLs de consulta pública de homologação por UF — a maioria dos estados só tem uma
// URL de produção mesmo (o ambiente de teste usa parâmetro/estado interno do próprio
// site), mas alguns têm domínio de homologação dedicado. Sem essa entrada específica,
// TODOS os estados caíam no fallback genérico do RS abaixo — o que faz o QR Code/link
// "Consulte pela Chave de Acesso" de uma nota de homologação de outro estado apontar
// pro portal errado (a consulta simplesmente não encontra a chave).
const HOMOLOG_URL_MAP: Record<string, string> = {
  SP: "https://www.homologacao.nfce.fazenda.sp.gov.br/consulta",
};

export function getUrlChave(uf: string, ambiente: "homologacao" | "producao"): string {
  if (ambiente === "homologacao") {
    return HOMOLOG_URL_MAP[uf.toUpperCase()] ?? "https://hom.sefaz.rs.gov.br/nfce/consulta"; // genérico homologação
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
