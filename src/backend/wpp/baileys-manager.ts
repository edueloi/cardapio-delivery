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
  step: "idle" | "menu" | "waiting_order";
  lastMessageAt: number;
  lastBotAt: number;
}

const sessions = new Map<string, ActiveSession>();
const convStates = new Map<string, ConvState>(); // key: tenantId:phone
const sendingLocks = new Map<string, Promise<void>>();
const SESSIONS_DIR = path.join(process.cwd(), "wpp-sessions");
const CONV_TIMEOUT_MS = 10 * 60 * 1000; // 10 min idle resets conversation

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
  const now = new Date();
  const dayKey = DAY_KEYS[now.getDay()];
  const day = hours[dayKey];
  if (!day || !day.enabled) return false;
  const [oh, om] = day.open.split(":").map(Number);
  const [ch, cm] = day.close.split(":").map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < oh * 60 + om || mins >= ch * 60 + cm) return false;
  // Check break interval
  if (day.breakEnabled && day.breakStart && day.breakEnd) {
    const [bsh, bsm] = day.breakStart.split(":").map(Number);
    const [beh, bem] = day.breakEnd.split(":").map(Number);
    if (mins >= bsh * 60 + bsm && mins < beh * 60 + bem) return false;
  }
  return true;
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
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// ─── Phone / JID helpers ─────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}
function phoneToJid(phone: string): string { return `${normalizePhone(phone)}@s.whatsapp.net`; }
function jidToPhone(jid: string): string { return jid.replace(/@.*/, "").replace(/:\d+$/, ""); }

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
  await prisma.wppInstance.updateMany({
    where: { tenantId },
    data: { status, phone, qrCode: status === "connected" ? null : qrCode, isActive: status === "connected" },
  }).catch(() => undefined);
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

// ─── Main bot handler ─────────────────────────────────────────────────────────

async function handleIncomingMessage(tenantId: string, remoteJid: string, text: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { wppBotConfig: true },
  });

  if (!tenant?.wppBotConfig?.botEnabled || !tenant.wppBotConfig.autoReplyEnabled) return;

  const session = sessions.get(tenantId);
  if (!session?.sock || session.status !== "connected") return;

  const phone = jidToPhone(remoteJid);
  const conv = getConvState(tenantId, phone);
  const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const menuLink = `${baseUrl}/${tenant.slug}`;
  const normalized = text.toLowerCase().trim();

  // Throttle: bot won't reply twice within 3s to same person
  if (Date.now() - conv.lastBotAt < 3_000) return;

  const send = async (msg: string) => {
    setConvState(tenantId, phone, { lastBotAt: Date.now() });
    await sendMessage(tenantId, phone, msg);
  };

  const openNow = isOpenNow(tenant as any);
  const hours = parseBusinessHours((tenant as any).businessHours);

  // ── Step: waiting for menu choice ─────────────────────────────────────────
  if (conv.step === "menu") {
    if (normalized === "1") {
      if (!openNow) {
        await send(
          `⚠️ *${tenant.name}* está fechado no momento.\n\n` +
          `🕐 *Horários de funcionamento:*\n${formatBusinessHours(hours)}\n\n` +
          `Volte quando estivermos abertos! 😊`
        );
      } else {
        await send(`🍽️ Aqui está nosso cardápio:\n${menuLink}\n\nFaça seu pedido por lá e a gente cuida do resto! 👌`);
      }
      setConvState(tenantId, phone, { step: "idle" });
      return;
    }

    if (normalized === "2") {
      const addr = (tenant as any).address || "Endereço não informado";
      await send(`📍 *Endereço de ${tenant.name}:*\n${addr}`);
      setConvState(tenantId, phone, { step: "idle" });
      return;
    }

    if (normalized === "3") {
      const status = openNow ? "✅ *Aberto agora*" : "🔴 *Fechado no momento*";
      await send(
        `${status}\n\n🕐 *Horários de funcionamento:*\n${formatBusinessHours(hours)}`
      );
      setConvState(tenantId, phone, { step: "idle" });
      return;
    }

    if (normalized === "0") {
      await send(`👋 Ok! Um atendente irá falar com você em breve.\n\nSe quiser, você também pode ligar: ${tenant.whatsapp || "número não informado"}`);
      setConvState(tenantId, phone, { step: "idle" });
      return;
    }

    // Didn't pick a valid option — show menu again
    await send(
      `Não entendi 😅 Por favor, escolha uma opção:\n\n` +
      `1️⃣ Ver cardápio\n2️⃣ Endereço\n3️⃣ Horários\n0️⃣ Falar com atendente`
    );
    return;
  }

  // ── Step: idle — detect trigger keywords ──────────────────────────────────
  const triggers = ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "menu",
    "cardapio", "cardápio", "pedido", "quero", "oque tem", "o que tem", "atendimento"];
  const isTriggered = triggers.some((t) => normalized.includes(t));
  if (!isTriggered) return;

  const customWelcome = tenant.wppBotConfig.welcomeMessage?.trim();

  if (customWelcome) {
    // Owner defined a custom message — just send it
    await send(customWelcome);
    return;
  }

  // Default: send greeting + menu
  const name = tenant.name;
  const statusLine = openNow
    ? "✅ Estamos *abertos* agora!"
    : "🔴 Estamos *fechados* no momento.";

  await send(
    `${greeting()}! 👋 Bem-vindo ao *${name}*.\n${statusLine}\n\n` +
    `O que você precisa?\n\n` +
    `1️⃣ Ver cardápio\n` +
    `2️⃣ Endereço\n` +
    `3️⃣ Horários de funcionamento\n` +
    `0️⃣ Falar com atendente`
  );
  setConvState(tenantId, phone, { step: "menu" });
}

// ─── initSession ─────────────────────────────────────────────────────────────

export async function initSession(tenantId: string): Promise<void> {
  const existing = sessions.get(tenantId);
  if (existing?.sock && ["connecting", "connected", "qr_pending"].includes(existing.status)) return;

  let makeWASocket: any, useMultiFileAuthState: any, DisconnectReason: any;
  try {
    const baileys = await import("@whiskeysockets/baileys");
    makeWASocket = (baileys as any).makeWASocket || baileys.default;
    useMultiFileAuthState = (baileys as any).useMultiFileAuthState;
    DisconnectReason = (baileys as any).DisconnectReason;
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
    version: waVersion, auth: state,
    browser: ["Chrome (Linux)", "", ""],
    printQRInTerminal: false, syncFullHistory: false,
    markOnlineOnConnect: false, connectTimeoutMs: 60_000,
    retryRequestDelayMs: 2000, logger: makeLogger(),
  });
  session.sock = sock;

  sock.ev.on("connection.update", async (update: any) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      session.qrRaw = qr;
      session.status = "qr_pending";
      session.qrDataUrl = await qrToDataUrl(qr);
      await updateDb(tenantId, "qr_pending", null, session.qrDataUrl);
      broadcast(tenantId);
    }

    if (connection === "open") {
      session.status = "connected";
      session.phone = jidToPhone(sock.user?.id || "");
      session.qrDataUrl = null;
      session.qrRaw = null;
      await updateDb(tenantId, "connected", session.phone, null);
      broadcast(tenantId);
      console.log(`[Baileys][${tenantId}] Conectado como ${session.phone}`);
    }

    if (connection === "close") {
      const loggedOut = (lastDisconnect?.error as any)?.output?.statusCode === DisconnectReason.loggedOut;
      session.status = "disconnected";
      session.phone = null;
      session.qrDataUrl = null;
      await updateDb(tenantId, "disconnected", null, null);
      broadcast(tenantId);

      if (loggedOut) {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch { return; }
        sessions.delete(tenantId);
      } else {
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

export function getSessionInfo(tenantId: string): SessionInfo {
  const session = sessions.get(tenantId);
  return { tenantId, status: session?.status ?? "disconnected", phone: session?.phone ?? null, qrDataUrl: session?.qrDataUrl ?? null };
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
    const timeout = setTimeout(resolve, 3000);
    onSessionUpdate(tenantId, () => { clearTimeout(timeout); resolve(); });
  });
  return getSessionInfo(tenantId);
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

export async function sendMessage(tenantId: string, phone: string, text: string): Promise<void> {
  const session = sessions.get(tenantId);
  if (!session?.sock || session.status !== "connected") return;

  const jid = phoneToJid(phone);
  const previous = sendingLocks.get(tenantId) || Promise.resolve();
  const current = previous.then(async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 1800));
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

export { isOpenNow, parseBusinessHours, formatBusinessHours };
