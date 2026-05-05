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

const sessions = new Map<string, ActiveSession>();
const autoReplyThrottle = new Map<string, number>();
const SESSIONS_DIR = path.join(process.cwd(), "wpp-sessions");

function normalizePhone(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function phoneToJid(phone: string): string {
  return `${normalizePhone(phone)}@s.whatsapp.net`;
}

function jidToPhone(jid: string): string {
  return jid.replace(/@.*/, "").replace(/:\d+$/, "");
}

function makeLogger(): any {
  const noop = () => undefined;
  const logger: any = {
    level: "silent",
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
  };
  logger.child = () => makeLogger();
  return logger;
}

async function qrToDataUrl(qr: string): Promise<string | null> {
  try {
    const QR = await import("qrcode");
    return await QR.default.toDataURL(qr, { width: 320, margin: 2 });
  } catch {
    return null;
  }
}

function broadcast(tenantId: string) {
  const session = sessions.get(tenantId);
  if (!session) return;

  const info: SessionInfo = {
    tenantId,
    status: session.status,
    phone: session.phone,
    qrDataUrl: session.qrDataUrl,
  };

  session.listeners.forEach((listener) => {
    try {
      listener(info);
    } catch {
      return;
    }
  });
}

async function updateDb(tenantId: string, status: WppStatus, phone: string | null, qrCode: string | null) {
  await prisma.wppInstance
    .updateMany({
      where: { tenantId },
      data: {
        status,
        phone,
        qrCode: status === "connected" ? null : qrCode,
        isActive: status === "connected",
      },
    })
    .catch(() => undefined);
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

async function maybeAutoReply(tenantId: string, remoteJid: string, text: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { wppBotConfig: true },
  });

  if (!tenant?.wppBotConfig?.botEnabled || !tenant.wppBotConfig.autoReplyEnabled) {
    return;
  }

  const throttleKey = `${tenantId}:${jidToPhone(remoteJid)}`;
  const lastReplyAt = autoReplyThrottle.get(throttleKey) ?? 0;
  if (Date.now() - lastReplyAt < 60_000) return;

  const normalized = text.toLowerCase();
  const wantsMenu =
    normalized.includes("menu") ||
    normalized.includes("cardapio") ||
    normalized.includes("cardápio") ||
    normalized.includes("pedido") ||
    normalized.includes("oi") ||
    normalized.includes("olá") ||
    normalized.includes("ola");

  if (!wantsMenu) return;

  const session = sessions.get(tenantId);
  if (!session?.sock || session.status !== "connected") return;

  const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const welcomeMessage =
    tenant.wppBotConfig.welcomeMessage?.trim() ||
    `Olá! Aqui é o assistente de ${tenant.name}. Você pode ver o cardápio e fazer seu pedido neste link:\n${baseUrl}/${tenant.slug}\n\nSe já pediu, responda por aqui que nossa equipe acompanha com você.`;

  autoReplyThrottle.set(throttleKey, Date.now());
  await session.sock.sendMessage(remoteJid, { text: welcomeMessage }).catch(() => undefined);
}

export function getSessionInfo(tenantId: string): SessionInfo {
  const session = sessions.get(tenantId);
  return {
    tenantId,
    status: session?.status ?? "disconnected",
    phone: session?.phone ?? null,
    qrDataUrl: session?.qrDataUrl ?? null,
  };
}

export function getQrCode(tenantId: string): string | null {
  return sessions.get(tenantId)?.qrDataUrl ?? null;
}

export function onSessionUpdate(tenantId: string, listener: (info: SessionInfo) => void): () => void {
  let session = sessions.get(tenantId);
  if (!session) {
    session = {
      sock: null,
      status: "disconnected",
      phone: null,
      qrDataUrl: null,
      qrRaw: null,
      listeners: new Set(),
    };
    sessions.set(tenantId, session);
  }

  session.listeners.add(listener);
  return () => session!.listeners.delete(listener);
}

export async function initSession(tenantId: string): Promise<void> {
  const existing = sessions.get(tenantId);
  if (existing?.sock && (existing.status === "connecting" || existing.status === "connected" || existing.status === "qr_pending")) {
    return;
  }

  let makeWASocket: any;
  let useMultiFileAuthState: any;
  let DisconnectReason: any;

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
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(dir);

  let waVersion: [number, number, number] = [2, 3000, 1015901307];
  try {
    const { fetchLatestBaileysVersion } = await import("@whiskeysockets/baileys");
    waVersion = (await fetchLatestBaileysVersion()).version;
  } catch {
    waVersion = [2, 3000, 1015901307];
  }

  const session: ActiveSession = {
    sock: null,
    status: "connecting",
    phone: null,
    qrDataUrl: null,
    qrRaw: null,
    listeners: existing?.listeners ?? new Set(),
  };
  sessions.set(tenantId, session);

  const sock = makeWASocket({
    version: waVersion,
    auth: state,
    browser: ["Chrome (Linux)", "", ""],
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
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch {
          return;
        }
        sessions.delete(tenantId);
      } else {
        setTimeout(() => {
          initSession(tenantId).catch(() => undefined);
        }, 5_000);
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

      await maybeAutoReply(tenantId, remoteJid, text).catch(() => undefined);
    }
  });
}

export async function connectSession(tenantId: string): Promise<SessionInfo> {
  await initSession(tenantId);
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 3000);
    onSessionUpdate(tenantId, () => {
      clearTimeout(timeout);
      resolve();
    });
  });
  return getSessionInfo(tenantId);
}

export async function disconnectSession(tenantId: string): Promise<void> {
  const session = sessions.get(tenantId);
  if (session?.sock) {
    try {
      await session.sock.logout();
    } catch {
      return;
    }

    try {
      session.sock.end();
    } catch {
      return;
    }
  }

  sessions.delete(tenantId);

  try {
    fs.rmSync(path.join(SESSIONS_DIR, tenantId), { recursive: true, force: true });
  } catch {
    return;
  }

  await updateDb(tenantId, "disconnected", null, null);
}

const sendingLocks = new Map<string, Promise<void>>();

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
  current.finally(() => {
    if (sendingLocks.get(tenantId) === current) {
      sendingLocks.delete(tenantId);
    }
  });
}

export async function restoreAllSessions(): Promise<void> {
  if (!fs.existsSync(SESSIONS_DIR)) return;

  const dirs = fs.readdirSync(SESSIONS_DIR).filter((entry) => {
    const full = path.join(SESSIONS_DIR, entry);
    return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, "creds.json"));
  });

  console.log(`[Baileys] Restaurando ${dirs.length} sessão(ões)...`);

  for (const tenantId of dirs) {
    try {
      await initSession(tenantId);
    } catch (error) {
      console.warn(`[Baileys] Erro ao restaurar ${tenantId}:`, error);
    }
  }
}
