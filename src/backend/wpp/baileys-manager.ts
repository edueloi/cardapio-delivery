import fs from "fs";
import path from "path";
import { prisma } from "../../lib/prisma";

export type WppStatus =
  | "not_configured"
  | "disconnected"
  | "qr_pending"
  | "connecting"
  | "connected";

export interface SessionInfo {
  tenantId: string;
  status: WppStatus;
  phone: string | null;
  qrDataUrl: string | null;
}

interface ActiveSession {
  sock: any;
  status: WppStatus;
  phone: string | null;
  qrDataUrl: string | null;
  qrRaw: string | null;
  listeners: Set<(info: SessionInfo) => void>;
}

// Conversation state per customer
interface ConvState {
  step: "idle" | "menu" | "waiting_order" | "waiting_human_info";
  lastMessageAt: number;
  lastBotAt: number;
  pausedUntil?: number; // timestamp until bot stays silent
}

const sessions = new Map<string, ActiveSession>();
const convStates = new Map<string, ConvState>(); // key: tenantId:phone
const sendingLocks = new Map<string, Promise<void>>();
const SESSIONS_DIR = path.join(process.cwd(), "wpp-sessions");
const CONV_TIMEOUT_MS = 25 * 60 * 1000; // 25 min idle resets conversation

// ─── Business hours helpers ───────────────────────────────────────────────────

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type DayKey = (typeof DAY_KEYS)[number];

interface DaySchedule {
  enabled: boolean;
  open: string;         // "HH:MM"
  close: string;        // "HH:MM"
  breakEnabled?: boolean;
  breakStart?: string;  // "HH:MM"
  breakEnd?: string;    // "HH:MM"
}

type BusinessHours = Partial<Record<DayKey, DaySchedule>>;

function parseBusinessHours(raw: string | null): BusinessHours {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function isOpenNow(tenant: { isOpen: boolean; businessHours: string | null }): boolean {
  if (!tenant.isOpen) return false;
  const hours = parseBusinessHours(tenant.businessHours);
  
  // Converte o horário do servidor para o horário de Brasília (UTC-3)
  const now = new Date();
  const brasilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000)); 
  
  // Nota: Se o servidor já estiver em UTC-3, essa lógica pode precisar de ajuste, 
  // mas a maioria das VPS vem em UTC (Londres).
  // Uma forma mais robusta é usar o fuso fixo:
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    minute: "numeric",
    weekday: "long",
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0");
  const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0");
  const weekday = parts.find(p => p.type === "weekday")?.value.toLowerCase() || "";
  
  // Mapeia o dia da semana do Intl para as nossas chaves
  const dayMap: Record<string, DayKey> = {
    "domingo": "sun", "segunda-feira": "mon", "terça-feira": "tue", 
    "quarta-feira": "wed", "quinta-feira": "thu", "sexta-feira": "fri", "sábado": "sat"
  };
  
  const dayKey = dayMap[weekday] || DAY_KEYS[now.getDay()];
  const day = hours[dayKey];

  if (!day || !day.enabled) return false;
  
  const [oh, om] = day.open.split(":").map(Number);
  const [ch, cm] = day.close.split(":").map(Number);
  const mins = hour * 60 + minute;
  
  if (mins < oh * 60 + om || mins >= ch * 60 + cm) return false;

  if (day.breakEnabled && day.breakStart && day.breakEnd) {
    const [bsh, bsm] = day.breakStart.split(":").map(Number);
    const [beh, bem] = day.breakEnd.split(":").map(Number);
    if (mins >= bsh * 60 + bsm && mins < beh * 60 + bem) return false;
  }
  return true;
}

function formatAddress(raw: string | null): string {
  if (!raw) return "Endereço não informado";
  try {
    const addr = JSON.parse(raw);
    const parts = [];
    if (addr.street) parts.push(`${addr.street}${addr.number ? `, ${addr.number}` : ""}`);
    if (addr.complement) parts.push(addr.complement);
    if (addr.neighborhood) parts.push(addr.neighborhood);
    if (addr.city) parts.push(`${addr.city}${addr.state ? ` - ${addr.state}` : ""}`);
    if (addr.cep) parts.push(`CEP: ${addr.cep}`);
    return parts.length ? parts.join("\n") : raw;
  } catch {
    return raw;
  }
}

function formatBusinessHours(hours: BusinessHours): string {
  const labels: Record<DayKey, string> = {
    sun: "Dom", mon: "Seg", tue: "Ter", wed: "Qua",
    thu: "Qui", fri: "Sex", sat: "Sáb",
  };
  const lines: string[] = [];
  for (const key of DAY_KEYS) {
    const d = hours[key];
    if (!d) continue;
    if (!d.enabled) { lines.push(`${labels[key]}: Fechado`); continue; }
    const base = `${labels[key]}: ${d.open} às ${d.close}`;
    const brk = d.breakEnabled && d.breakStart && d.breakEnd
      ? ` (intervalo ${d.breakStart}–${d.breakEnd})`
      : "";
    lines.push(base + brk);
  }
  return lines.length ? lines.join("\n") : "Horários não configurados";
}

function greeting(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    hour12: false
  });
  const h = parseInt(formatter.format(now));
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

// ─── Phone / JID helpers ─────────────────────────────────────────────────────

function normalizePhoneDigits(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function getBrazilPhoneVariants(phone: string): string[] {
  const normalized = normalizePhoneDigits(phone);
  const variants = new Set<string>([normalized]);

  if (normalized.startsWith("55")) {
    const country = normalized.slice(0, 2);
    const ddd = normalized.slice(2, 4);
    const number = normalized.slice(4);

    // If it has 9 digits and starts with 9 (e.g., 55 11 988887777)
    if (number.length === 9 && number.startsWith("9")) {
      variants.add(`${country}${ddd}${number.slice(1)}`);
    }

    // If it has 8 digits (e.g., 55 11 88887777)
    if (number.length === 8) {
      variants.add(`${country}${ddd}9${number}`);
    }
  }

  return Array.from(variants);
}

function normalizePhone(phone: string): string {
  return normalizePhoneDigits(phone);
}

function phoneToJid(phone: string): string { 
  return `${normalizePhone(phone)}@s.whatsapp.net`; 
}

function jidToPhone(jid: string): string { 
  const phone = jid.replace(/@.*/, "").replace(/:[0-9]+$/, ""); 
  
  // Auto-fix Brazilian 9th digit for display/storage if it's a known mobile DDD
  // This helps matching what users expect to see
  if (phone.startsWith("55") && phone.length === 12) {
    const ddd = parseInt(phone.slice(2, 4));
    // Brazilian mobile DDDs are 11-99. 
    // Historically, only 11-28 had the 9th digit issue in WhatsApp JIDs
    if (ddd >= 11 && ddd <= 99) {
      return `55${ddd}9${phone.slice(4)}`;
    }
  }
  
  return phone;
}

function jidMatchesPhone(jid: string, phone: string): boolean {
  const jidPhone = jidToPhone(jid);
  const variants = getBrazilPhoneVariants(phone);
  const jidVariants = getBrazilPhoneVariants(jidPhone);
  
  return variants.some(v => jidVariants.includes(v));
}

// ─── Logger ──────────────────────────────────────────────────────────────────

function makeLogger(): any {
  const noop = () => undefined;
  const l: any = { level: "silent", trace: noop, debug: noop, info: noop, warn: noop, error: noop };
  l.child = () => makeLogger();
  return l;
}

// ─── QR ──────────────────────────────────────────────────────────────────────

async function qrToDataUrl(qr: string): Promise<string | null> {
  try {
    const QR = await import("qrcode");
    return await QR.default.toDataURL(qr, { width: 320, margin: 2 });
  } catch { return null; }
}

// ─── Broadcast ───────────────────────────────────────────────────────────────

function broadcast(tenantId: string) {
  const session = sessions.get(tenantId);
  if (!session) return;
  const info: SessionInfo = { tenantId, status: session.status, phone: session.phone, qrDataUrl: session.qrDataUrl };
  session.listeners.forEach((l) => { try { l(info); } catch { return; } });
}

async function updateDb(tenantId: string, status: WppStatus, phone: string | null, qrCode: string | null) {
  console.log(`[Baileys][${tenantId}] Updating DB: status=${status}, phone=${phone}`);
  await prisma.wppInstance.updateMany({
    where: { tenantId },
    data: { status, phone, qrCode: status === "connected" ? null : qrCode, isActive: status === "connected" },
  }).catch((err) => console.error(`[Baileys][${tenantId}] DB Update Error:`, err));
}

function extractMessageText(message: any): string {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    ""
  ).trim();
}

// ─── Conversation state ───────────────────────────────────────────────────────

function getConvState(tenantId: string, phone: string): ConvState {
  const key = `${tenantId}:${phone}`;
  const existing = convStates.get(key);
  if (existing && Date.now() - existing.lastMessageAt < CONV_TIMEOUT_MS) return existing;
  const fresh: ConvState = { step: "idle", lastMessageAt: Date.now(), lastBotAt: 0 };
  convStates.set(key, fresh);
  return fresh;
}

function setConvState(tenantId: string, phone: string, update: Partial<ConvState>) {
  const key = `${tenantId}:${phone}`;
  const current = convStates.get(key) ?? { step: "idle", lastMessageAt: Date.now(), lastBotAt: 0 };
  convStates.set(key, { ...current, ...update, lastMessageAt: Date.now() });
}

// ─── Intent detection ─────────────────────────────────────────────────────────

function detectIntent(text: string): "menu" | "address" | "hours" | "human" | "order" | "greeting" | "exit" | null {
  const t = text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^\w\s]/g, " ").trim();

  const has = (...words: string[]) => words.some(w => t.includes(w));

  if (has("sair", "encerrar", "obrigado", "obrigada", "valeu", "tchau", "ate logo", "finalizar", "nada mais") || t === "0")
    return "exit";

  if (has("falar com", "atendente", "humano", "pessoa", "funcionario", "dono", "gerente", "responsavel") || t === "4")
    return "human";

  if (has("endereco", "localizacao", "onde fica", "onde voces ficam", "como chegar", "localizacao", "bairro", "rua", "avenida", "maps", "mapa", "localizacao") || t === "2")
    return "address";

  if (has("horario", "hora", "funcionamento", "abre", "fecha", "aberto", "fechado", "que horas", "funcionando", "atende") || t === "3")
    return "hours";

  if (has("cardapio", "menu", "pedido", "pedir", "quero", "o que tem", "oque tem", "comida", "lanche", "marmita", "prato", "ver cardapio", "fazer pedido", "comprar", "produto", "combo", "opcao", "opcoes") || t === "1")
    return "order";

  if (has("oi", "ola", "boa noite", "boa tarde", "bom dia", "bom dia", "oiee", "oii", "hey", "ola", "ei ", "e ai", "eai", "tudo bem", "tudo bom"))
    return "greeting";

  return null;
}

// ─── Main bot handler ─────────────────────────────────────────────────────────

async function handleIncomingMessage(tenantId: string, remoteJid: string, text: string) {
  console.log(`[Baileys][${tenantId}] 💬 Mensagem recebida de ${remoteJid}: "${text}"`);
  
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { wppBotConfig: true },
  });

  if (!tenant) {
    console.log(`[Baileys][${tenantId}] ❌ Tenant não encontrado no banco.`);
    return;
  }

  if (!tenant.wppBotConfig?.botEnabled) {
    console.log(`[Baileys][${tenantId}] ⚠️ Bot desativado nas configurações (botEnabled: false).`);
    return;
  }

  if (!tenant.wppBotConfig.autoReplyEnabled) {
    console.log(`[Baileys][${tenantId}] ⚠️ Auto-atendimento desativado (autoReplyEnabled: false).`);
    return;
  }

  const session = sessions.get(tenantId);
  if (!session?.sock || session.status !== "connected") {
    console.log(`[Baileys][${tenantId}] ⚠️ Sessão não está pronta ou não está conectada.`);
    return;
  }

  const phone = jidToPhone(remoteJid);
  const conv = getConvState(tenantId, phone);

  // Trava de Atendimento Humano (Glow-Cut Style)
  if (conv.pausedUntil && Date.now() < conv.pausedUntil) {
    console.log(`[Baileys][${tenantId}] 🤐 Robô pausado para atendimento humano com ${phone}.`);
    return;
  }

  const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const menuLink = `${baseUrl}/${tenant.slug}`;
  const normalized = text.toLowerCase().trim();

  // Throttle: bot won't reply twice within 3s to same person
  if (Date.now() - conv.lastBotAt < 3_000) {
    console.log(`[Baileys][${tenantId}] ⏳ Ignorando mensagem por throttle (menos de 3s).`);
    return;
  }

  const send = async (msg: string, delay = 0) => {
    console.log(`[Baileys][${tenantId}] 🤖 Enviando resposta para ${remoteJid} (delay: ${delay}ms)...`);
    setConvState(tenantId, phone, { lastBotAt: Date.now() });
    await sendMessage(tenantId, remoteJid, msg, delay);
  };

  const openNow = isOpenNow(tenant as any);
  const hours = parseBusinessHours((tenant as any).businessHours);
  const addr = (tenant as any).address;
  const name = tenant.name;

  const sendMenu = async () => {
    const statusLine = openNow 
      ? "✅ *Estamos abertos e prontos para te atender!*" 
      : "🔴 *No momento estamos fechados, mas você pode ver nosso cardápio e deixar seu pedido agendado!*";
    
    // 1. Saudação inicial vinda do painel ou padrão
    const welcome = tenant.wppBotConfig?.welcomeMessage?.trim() || `${greeting()}! 👋 Seja muito bem-vindo ao *${name}*`;
    await send(`${welcome}.\n\n${statusLine}`);
    
    // 2. Menu de opções renovado
    await send(
      `Como podemos te ajudar hoje?\n\n` +
      `1️⃣ *Ver Cardápio Online*\n` +
      `2️⃣ *Endereço / Localização*\n` +
      `3️⃣ *Horários de Funcionamento*\n` +
      `4️⃣ *Falar com um Atendente*\n` +
      `0️⃣ *Encerrar / Sair*\n\n` +
      `_Digite apenas o número da opção desejada._`,
      2200
    );
    setConvState(tenantId, phone, { step: "menu" });
  };

  const sendOrderInfo = async () => {
    if (!openNow) {
      await send(`⚠️ *${name}* está fechado no momento, mas você pode ver o cardápio e agendar aqui:\n${menuLink}`, 1500);
    } else {
      await send(`🍽️ Aqui está nosso cardápio:\n${menuLink}\n\nFaça seu pedido por lá! 👌`, 1500);
    }
    // Loop de volta para o menu após 3 segundos
    setTimeout(() => sendMenu(), 3500);
  };

  const sendAddress = async () => {
    await send(`📍 *Endereço de ${name}:*\n\n${formatAddress(addr)}`, 1500);
    // Loop de volta para o menu após 3 segundos
    setTimeout(() => sendMenu(), 3500);
  };

  const sendHours = async () => {
    const status = openNow ? "✅ *Aberto agora*" : "🔴 *Fechado no momento*";
    await send(`${status}\n\n🕐 *Horários de funcionamento:*\n${formatBusinessHours(hours)}`, 1500);
    // Loop de volta para o menu após 3 segundos
    setTimeout(() => sendMenu(), 3500);
  };

  const sendHuman = async () => {
    await send(
      `🤝 *Para agilizar seu atendimento, por favor me informe em uma única mensagem:*\n\n` +
      `👤 *Seu Nome:*\n` +
      `📞 *Telefone para Contato:*\n` +
      `📝 *Assunto / Dúvida:*\n\n` +
      `_Assim que você enviar, um atendente humano irá assumir._`,
      1500
    );
    setConvState(tenantId, phone, { step: "waiting_human_info" });
  };

  const sendExit = async () => {
    await send(`😊 Foi um prazer te atender! Se precisar de algo mais, é só me chamar.\n\nTenha um ótimo dia! 🙏`, 1200);
    setConvState(tenantId, phone, { step: "idle" });
  };

  const intent = detectIntent(normalized);

  // ── Step: coletando dados para o humano ───────────────────────────────────
  if (conv.step === "waiting_human_info") {
    const rawOwnerPhone = tenant.whatsapp || "";
    const cleanOwnerPhone = rawOwnerPhone.replace(/\D/g, "");
    
    // Responde ao cliente
    await send(`✅ *Obrigado! Seus dados foram enviados. Aguarde um instante que já vamos te chamar.*`, 1200);
    
    // Pausa o robô (Estilo Glow-Cut)
    setConvState(tenantId, phone, { step: "idle", pausedUntil: Date.now() + (60 * 60 * 1000) });

    // Notifica o dono com os detalhes enviados
    if (cleanOwnerPhone) {
      const notifyMsg = `🚨 *NOVO CHAMADO DE ATENDIMENTO*\n\n` +
        `📱 *Cliente:* ${phone}\n` +
        `📋 *Dados Informados:* \n"${text}"\n\n` +
        `🔗 *Clique para atender agora:* \nhttps://wa.me/${phone}`;
      
      await sendMessage(tenantId, cleanOwnerPhone, notifyMsg);
    }
    return;
  }

  if (conv.step === "menu") {
    if (normalized === "1") { await sendOrderInfo(); return; }
    if (normalized === "2") { await sendAddress(); return; }
    if (normalized === "3") { await sendHours(); return; }
    if (normalized === "4") { await sendHuman(); return; }
    if (normalized === "0") { await sendExit(); return; }

    if (intent === "order") { await sendOrderInfo(); return; }
    if (intent === "address") { await sendAddress(); return; }
    if (intent === "hours") { await sendHours(); return; }
    if (intent === "human") { await sendHuman(); return; }
    if (intent === "exit") { await sendExit(); return; }
    if (intent === "greeting") { await sendMenu(); return; }

    await send(
      `Não entendi 😅 Pode digitar o número ou escolher abaixo:\n\n` +
      `1️⃣ Cardápio\n2️⃣ Endereço\n3️⃣ Horários\n4️⃣ Atendente\n0️⃣ Sair`
    );
    return;
  }

  if (intent === "order") { await sendOrderInfo(); return; }
  if (intent === "address") { await sendAddress(); return; }
  if (intent === "hours") { await sendHours(); return; }
  if (intent === "human") { await sendHuman(); return; }
  if (intent === "exit") { await sendExit(); return; }

  if (intent === "greeting" || intent !== null) {
    await sendMenu();
    return;
  }

  // No intent matched — ignore silently (spam, stickers, reactions)
}

// ─── initSession ─────────────────────────────────────────────────────────────

export async function initSession(tenantId: string): Promise<void> {
  const existing = sessions.get(tenantId);
  if (existing?.sock && ["connecting", "connected", "qr_pending"].includes(existing.status)) return;

  let makeWASocket: any, useMultiFileAuthState: any, DisconnectReason: any, makeCacheableSignalKeyStore: any, Browsers: any;
  try {
    const baileys = await import("@whiskeysockets/baileys");
    makeWASocket = (baileys as any).makeWASocket || baileys.default;
    useMultiFileAuthState = (baileys as any).useMultiFileAuthState;
    DisconnectReason = (baileys as any).DisconnectReason;
    makeCacheableSignalKeyStore = (baileys as any).makeCacheableSignalKeyStore;
    Browsers = (baileys as any).Browsers;
  } catch (error: any) {
    console.error("[Baileys] Não instalado:", error?.message);
    await updateDb(tenantId, "disconnected", null, null);
    return;
  }

  const dir = path.join(SESSIONS_DIR, tenantId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(dir);

  let waVersion: [number, number, number] = [2, 3000, 1015901307];
  try {
    const { fetchLatestBaileysVersion } = await import("@whiskeysockets/baileys");
    waVersion = (await fetchLatestBaileysVersion()).version;
  } catch { waVersion = [2, 3000, 1015901307]; }

  const session: ActiveSession = {
    sock: null, status: "connecting", phone: null, qrDataUrl: null, qrRaw: null,
    listeners: existing?.listeners ?? new Set(),
  };
  sessions.set(tenantId, session);

  const sock = makeWASocket({
    version: waVersion,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore ? makeCacheableSignalKeyStore(state.keys, makeLogger()) : state.keys,
    },
    browser: Browsers ? Browsers.macOS("Desktop") : ["Chrome (Mac)", "Desktop", "10.15.7"],
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    connectTimeoutMs: 60_000,
    retryRequestDelayMs: 2000,
    logger: makeLogger(),
  });
  session.sock = sock;

  sock.ev.on("connection.update", async (update: any) => {
    const { connection, lastDisconnect, qr } = update;
    
    console.log(`[Baileys][${tenantId}] Connection Update:`, { connection, hasQR: !!qr });

    if (qr) {
      session.qrRaw = qr;
      session.status = "qr_pending";
      session.qrDataUrl = await qrToDataUrl(qr);
      await updateDb(tenantId, "qr_pending", null, session.qrDataUrl);
      broadcast(tenantId);
    }

    if (connection === "open") {
      const user = sock.user || (sock.authState as any)?.creds?.me;
      session.status = "connected";
      session.phone = jidToPhone(user?.id || "");
      session.qrDataUrl = null;
      session.qrRaw = null;
      await updateDb(tenantId, "connected", session.phone, null);
      broadcast(tenantId);
      console.log(`[Baileys][${tenantId}] ✅ CONECTADO COM SUCESSO! Telefone: ${session.phone}`);
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      const reason = lastDisconnect?.error?.message || "Unknown";
      
      console.log(`[Baileys][${tenantId}] ❌ Conexão fechada. Status: ${statusCode}, LoggedOut: ${loggedOut}, Reason: ${reason}`);

      session.status = "disconnected";
      session.phone = null;
      session.qrDataUrl = null;
      await updateDb(tenantId, "disconnected", null, null);
      broadcast(tenantId);

      if (loggedOut) {
        console.log(`[Baileys][${tenantId}] 🗑️ Sessão encerrada pelo usuário. Limpando dados.`);
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch { return; }
        sessions.delete(tenantId);
      } else {
        console.log(`[Baileys][${tenantId}] 🔄 Tentando reconectar em 5 segundos...`);
        setTimeout(() => { initSession(tenantId).catch(() => undefined); }, 5_000);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async (event: any) => {
    if (event?.type !== "notify") return;
    for (const msg of event.messages || []) {
      if (!msg.message || msg.key?.fromMe) continue;
      const remoteJid = msg.key?.remoteJid;
      if (!remoteJid || String(remoteJid).includes("@g.us")) continue;
      const text = extractMessageText(msg.message);
      if (!text) continue;
      await handleIncomingMessage(tenantId, remoteJid, text).catch(() => undefined);
    }
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getSessionInfo(tenantId: string): SessionInfo | null {
  const session = sessions.get(tenantId);
  if (!session) return null;
  return { tenantId, status: session.status, phone: session.phone, qrDataUrl: session.qrDataUrl };
}

export function getQrCode(tenantId: string): string | null {
  return sessions.get(tenantId)?.qrDataUrl ?? null;
}

export function onSessionUpdate(tenantId: string, listener: (info: SessionInfo) => void): () => void {
  let session = sessions.get(tenantId);
  if (!session) {
    session = { sock: null, status: "disconnected", phone: null, qrDataUrl: null, qrRaw: null, listeners: new Set() };
    sessions.set(tenantId, session);
  }
  session.listeners.add(listener);
  return () => session!.listeners.delete(listener);
}

export async function connectSession(tenantId: string): Promise<SessionInfo> {
  await initSession(tenantId);
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 5000); // increased timeout
    const unsub = onSessionUpdate(tenantId, (info) => {
      if (info.status === "connected" || info.qrDataUrl) {
        clearTimeout(timeout);
        unsub();
        resolve();
      }
    });
  });
  return getSessionInfo(tenantId) ?? { tenantId, status: "disconnected", phone: null, qrDataUrl: null };
}

export async function disconnectSession(tenantId: string): Promise<void> {
  const session = sessions.get(tenantId);
  if (session?.sock) {
    try { await session.sock.logout(); } catch { return; }
    try { session.sock.end(); } catch { return; }
  }
  sessions.delete(tenantId);
  try { fs.rmSync(path.join(SESSIONS_DIR, tenantId), { recursive: true, force: true }); } catch { return; }
  await updateDb(tenantId, "disconnected", null, null);
}

export async function sendMessage(tenantId: string, to: string, text: string, delayMs = 0): Promise<void> {
  const session = sessions.get(tenantId);
  if (!session?.sock || session.status !== "connected") return;

  const jid = to.includes("@") ? to : phoneToJid(to);
  const previous = sendingLocks.get(tenantId) || Promise.resolve();
  const current = previous.then(async () => {
    try {
      // Simulate typing if delay is requested
      if (delayMs > 0) {
        await session.sock.sendPresenceUpdate("composing", jid);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        await session.sock.sendPresenceUpdate("paused", jid);
      } else {
        // Natural small delay to avoid being flagged as spam
        await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1000));
      }

      await session.sock.sendMessage(jid, { text });
    } catch (error) {
      console.warn("[Baileys] sendMessage error:", error);
    }
  });
  sendingLocks.set(tenantId, current);
  current.finally(() => { if (sendingLocks.get(tenantId) === current) sendingLocks.delete(tenantId); });
}

export async function restoreAllSessions(): Promise<void> {
  if (!fs.existsSync(SESSIONS_DIR)) return;
  const dirs = fs.readdirSync(SESSIONS_DIR).filter((entry) => {
    const full = path.join(SESSIONS_DIR, entry);
    return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, "creds.json"));
  });
  console.log(`[Baileys] Restaurando ${dirs.length} sessão(ões)...`);
  for (const tenantId of dirs) {
    try { await initSession(tenantId); } catch (error) { console.warn(`[Baileys] Erro ao restaurar ${tenantId}:`, error); }
  }
}

export { isOpenNow, parseBusinessHours, formatBusinessHours, jidMatchesPhone, getBrazilPhoneVariants };

