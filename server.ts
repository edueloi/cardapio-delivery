import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "fs";
import { createServer } from "http";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import { prisma as _prisma } from "./src/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;
import {
  authMiddleware,
  createAuthSession,
  deleteAuthSession,
  getAuthorizedTenantById,
  getAuthorizedTenantBySlug,
  hashPassword,
  listAccountTenants,
  requireAuth,
  type AuthenticatedRequest,
  verifyPassword,
} from "./src/backend/auth";
import { parseProductionRecipeRecord } from "./src/backend/production";
import { registerProductionRoutes } from "./src/backend/production-routes";
import { sendInviteEmail, sendPasswordResetEmail } from "./src/backend/mailer";
import {
  connectSession,
  disconnectSession,
  getQrCode,
  getSessionInfo,
  restoreAllSessions,
  sendMessage,
} from "./src/backend/wpp/baileys-manager";
import { sendOrderCreatedMessage, sendOrderStatusMessage, sendOwnerOrderAlert } from "./src/backend/wpp/messages";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join-tenant", (tenantId) => {
    socket.join(`tenant-${tenantId}`);
    console.log(`Socket ${socket.id} joined tenant room: ${tenantId}`);
  });

  socket.on("join-table", (tableRoom) => {
    // tableRoom format: "tenantId-mesa-tableId"
    socket.join(tableRoom);
    console.log(`Socket ${socket.id} joined table room: ${tableRoom}`);
  });

  socket.on("request-checkout", ({ tenantId, tableId, customerName }) => {
    console.log(`Table ${tableId} of tenant ${tenantId} requested checkout`);
    io.to(`tenant-${tenantId}`).emit("checkout-requested", { tableId, customerName });
  });

  socket.on("request-waiter", ({ tenantId, tableId, customerName, note, requestBill }) => {
    console.log(`Table ${tableId} called waiter (bill=${requestBill})`);
    io.to(`tenant-${tenantId}`).emit("waiter-called", { tableId, customerName, note, requestBill });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

function sanitizeSlug(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeEmail(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function currentAccount(req: express.Request) {
  return (req as AuthenticatedRequest).account ?? null;
}

function currentSessionToken(req: express.Request) {
  return (req as AuthenticatedRequest).sessionToken ?? null;
}

async function ensureWppSetup(tenantId: string, tenantName: string) {
  const [instance, config] = await Promise.all([
    prisma.wppInstance.upsert({
      where: { tenantId },
      create: {
        tenantId,
        instanceName: `${tenantName} Bot`,
        status: "not_configured",
      },
      update: {},
    }),
    prisma.wppBotConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        botEnabled: true,
        autoReplyEnabled: true,
        sendOrderCreated: true,
        sendStatusUpdates: true,
      },
      update: {},
    }),
  ]);

  return { instance, config };
}

async function requireTenantById(req: express.Request, res: express.Response, tenantId: string) {
  const account = currentAccount(req);
  if (!account) {
    res.status(401).json({ error: "Login obrigatório." });
    return null;
  }

  const result = await getAuthorizedTenantById(account.id, tenantId);
  if (!result) {
    res.status(403).json({ error: "Você não tem acesso a este estabelecimento." });
    return null;
  }

  return result.tenant;
}

async function requireTenantBySlug(req: express.Request, res: express.Response, slug: string) {
  const account = currentAccount(req);
  if (!account) {
    res.status(401).json({ error: "Login obrigatório." });
    return null;
  }

  const result = await getAuthorizedTenantBySlug(account.id, slug);
  if (!result) {
    res.status(403).json({ error: "Você não tem acesso a este estabelecimento." });
    return null;
  }

  return result.tenant;
}

async function requireTenantFromProduct(req: express.Request, res: express.Response, productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { tenant: true },
  });

  if (!product) {
    res.status(404).json({ error: "Produto não encontrado." });
    return null;
  }

  const tenant = await requireTenantById(req, res, product.tenantId);
  if (!tenant) return null;

  return { product, tenant };
}

async function requireTenantFromOrder(req: express.Request, res: express.Response, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      tenant: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    res.status(404).json({ error: "Pedido não encontrado." });
    return null;
  }

  const tenant = await requireTenantById(req, res, order.tenantId);
  if (!tenant) return null;

  return { order, tenant };
}

async function requireTenantFromInventoryItem(req: express.Request, res: express.Response, itemId: string) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) {
    res.status(404).json({ error: "Item não encontrado." });
    return null;
  }

  const tenant = await requireTenantById(req, res, item.tenantId);
  if (!tenant) return null;

  return { item, tenant };
}

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadDir));
app.use("/downloads", express.static(path.join(process.cwd(), "public", "downloads")));
app.use(authMiddleware);
registerProductionRoutes({
  app,
  io,
  prisma,
  requireAuth,
  requireTenantBySlug,
  currentAccount,
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join-tenant", (tenantId: string) => {
    socket.join(`tenant-${tenantId}`);
    console.log(`User joined tenant room: tenant-${tenantId}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

app.post("/api/auth/register", async (req, res) => {
  const {
    name,
    email,
    password,
    establishmentName,
    establishmentSlug,
    description,
    address,
    whatsapp,
    claimSlug,
  } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
  }

  try {
    const normalizedEmail = normalizeEmail(email);
    const existingAccount = await prisma.account.findUnique({ where: { email: normalizedEmail } });
    if (existingAccount) {
      return res.status(400).json({ error: "E-mail já cadastrado." });
    }

    const ownerName = String(name).trim();
    const passwordHash = hashPassword(String(password));
    let claimTenant = null;
    let createTenantData: {
      name: string;
      slug: string;
      description: string | null;
      address: string | null;
      whatsapp: string | null;
    } | null = null;

    if (claimSlug) {
      const slug = sanitizeSlug(claimSlug);
      claimTenant = await prisma.tenant.findUnique({ where: { slug } });

      if (!claimTenant) {
        return res.status(404).json({ error: "Estabelecimento não encontrado para vincular." });
      }

      const existingMembership = await prisma.tenantMembership.findFirst({
        where: { tenantId: claimTenant.id },
      });

      if (existingMembership) {
        return res.status(400).json({ error: "Este estabelecimento já possui um dono vinculado." });
      }
    } else {
      if (!establishmentName) {
        return res.status(400).json({ error: "Informe o nome do estabelecimento." });
      }

      const slug = sanitizeSlug(establishmentSlug || establishmentName);
      if (!slug) {
        return res.status(400).json({ error: "Slug inválido para o estabelecimento." });
      }

      const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
      if (existingTenant) {
        return res.status(400).json({ error: "Esse link do estabelecimento já está em uso." });
      }

      createTenantData = {
        name: String(establishmentName).trim(),
        slug,
        description: description || null,
        address: address || null,
        whatsapp: whatsapp || null,
      };
    }

    const { account, tenant } = await prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          name: ownerName,
          email: normalizedEmail,
          passwordHash,
        },
      });

      const tenant =
        claimTenant ||
        (await tx.tenant.create({
          data: createTenantData!,
        }));

      await tx.tenantMembership.create({
        data: {
          accountId: account.id,
          tenantId: tenant.id,
          role: "OWNER",
        },
      });

      return { account, tenant };
    });

    try {
      await ensureWppSetup(tenant.id, tenant.name);
    } catch (wppError) {
      console.error("Erro ao configurar WhatsApp inicial (não crítico):", wppError);
    }

    const token = await createAuthSession(account.id);
    const tenants = await listAccountTenants(account.id);

    res.json({
      token,
      account: { id: account.id, name: account.name, email: account.email, isSuperAdmin: account.isSuperAdmin ?? false },
      tenants,
    });
  } catch (error) {
    console.error("ERRO NO CADASTRO:", error);
    res.status(500).json({ 
      error: "Falha ao cadastrar usuário.",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
  }

  try {
    const account = await prisma.account.findUnique({
      where: { email: normalizeEmail(email) },
    });

    if (!account || !verifyPassword(String(password), account.passwordHash)) {
      return res.status(401).json({ error: "E-mail ou senha inválidos." });
    }

    const token = await createAuthSession(account.id);
    const tenants = await listAccountTenants(account.id);

    res.json({
      token,
      account: { id: account.id, name: account.name, email: account.email, isSuperAdmin: account.isSuperAdmin ?? false },
      tenants,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Falha ao fazer login." });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const account = currentAccount(req)!;
  const tenants = await listAccountTenants(account.id);
  res.json({ account, tenants });
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  const token = currentSessionToken(req);
  if (token) {
    await deleteAuthSession(token);
  }

  res.json({ success: true });
});

// ── INVITE / REGISTER VIA LINK ──────────────────────────────────────────────

// Valida token de convite (público — usado na tela de cadastro)
app.get("/api/auth/invite/:token", async (req, res) => {
  try {
    const invite = await prisma.inviteToken.findUnique({
      where: { token: req.params.token },
    });
    if (!invite) return res.status(404).json({ error: "Convite não encontrado." });
    if (invite.usedAt) return res.status(410).json({ error: "Este convite já foi utilizado." });
    if (new Date() > new Date(invite.expiresAt)) return res.status(410).json({ error: "Este convite expirou." });
    res.json({ valid: true, note: invite.note });
  } catch (error) {
    res.status(500).json({ error: "Falha ao validar convite." });
  }
});

// Cadastro via convite (único uso, com validade)
app.post("/api/auth/register-invite", async (req, res) => {
  const { token, name, email, password, establishmentName, establishmentSlug } = req.body;
  if (!token || !name || !email || !password) {
    return res.status(400).json({ error: "Dados incompletos." });
  }
  try {
    const invite = await prisma.inviteToken.findUnique({ where: { token } });
    if (!invite) return res.status(404).json({ error: "Convite não encontrado." });
    if (invite.usedAt) return res.status(410).json({ error: "Este convite já foi utilizado." });
    if (new Date() > new Date(invite.expiresAt)) return res.status(410).json({ error: "Este convite expirou." });

    const normalizedEmail = normalizeEmail(email);
    const existing = await prisma.account.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(400).json({ error: "E-mail já cadastrado." });

    let tenantData: { name: string; slug: string } | null = null;
    if (establishmentName) {
      const slug = sanitizeSlug(establishmentSlug || establishmentName);
      if (!slug) return res.status(400).json({ error: "Slug inválido." });
      const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
      if (existingTenant) return res.status(400).json({ error: "Esse link já está em uso." });
      tenantData = { name: String(establishmentName).trim(), slug };
    }

    const { account, tenant } = await prisma.$transaction(async (tx: any) => {
      const account = await tx.account.create({
        data: { name: String(name).trim(), email: normalizedEmail, passwordHash: hashPassword(String(password)) },
      });
      let tenant = null;
      if (tenantData) {
        tenant = await tx.tenant.create({ data: tenantData });
        await tx.tenantMembership.create({
          data: { accountId: account.id, tenantId: tenant.id, role: "OWNER" },
        });
      }
      await tx.inviteToken.update({
        where: { token },
        data: { usedAt: new Date(), usedByEmail: normalizedEmail },
      });
      return { account, tenant };
    });

    if (tenant) {
      try { await ensureWppSetup(tenant.id, tenant.name); } catch {}
    }

    const authToken = await createAuthSession(account.id);
    const tenants = await listAccountTenants(account.id);
    res.json({ token: authToken, account: { id: account.id, name: account.name, email: account.email, isSuperAdmin: account.isSuperAdmin ?? false }, tenants });
  } catch (error) {
    console.error("ERRO register-invite:", error);
    res.status(500).json({ error: "Falha ao criar conta." });
  }
});

// ── REDEFINIÇÃO DE SENHA ──────────────────────────────────────────────────────

// Solicitar redefinição — gera token e envia email
app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "E-mail obrigatório." });
  try {
    const account = await prisma.account.findUnique({ where: { email: email.trim().toLowerCase() } });
    // Responde sempre 200 para não revelar se email existe
    if (!account) return res.json({ ok: true });

    const token = [...Array(48)].map(() => Math.random().toString(36)[2]).join("");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await prisma.passwordResetToken.create({ data: { accountId: account.id, token, expiresAt } });
    await sendPasswordResetEmail(account.email, token, account.name).catch((err) => {
      console.error("[mailer] forgot-password:", err);
    });
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Falha ao processar solicitação." });
  }
});

// Validar token de reset
app.get("/api/auth/reset-password/:token", async (req, res) => {
  try {
    const record = await prisma.passwordResetToken.findUnique({ where: { token: req.params.token } });
    if (!record) return res.status(404).json({ error: "Token inválido." });
    if (record.usedAt) return res.status(410).json({ error: "Este link já foi utilizado." });
    if (new Date() > new Date(record.expiresAt)) return res.status(410).json({ error: "Este link expirou." });
    res.json({ valid: true });
  } catch (error) {
    res.status(500).json({ error: "Falha ao validar token." });
  }
});

// Redefinir senha
app.post("/api/auth/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: "Dados incompletos." });
  if (String(password).length < 6) return res.status(400).json({ error: "A senha deve ter ao menos 6 caracteres." });
  try {
    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record) return res.status(404).json({ error: "Token inválido." });
    if (record.usedAt) return res.status(410).json({ error: "Este link já foi utilizado." });
    if (new Date() > new Date(record.expiresAt)) return res.status(410).json({ error: "Este link expirou." });

    await prisma.account.update({
      where: { id: record.accountId },
      data: { passwordHash: hashPassword(String(password)) },
    });
    await prisma.passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } });
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Falha ao redefinir senha." });
  }
});

// ── SUPER ADMIN ──────────────────────────────────────────────────────────────

function requireSuperAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const account = currentAccount(req) as any;
  if (!account) return res.status(401).json({ error: "Login obrigatório." });
  if (!account.isSuperAdmin) return res.status(403).json({ error: "Acesso restrito ao super admin." });
  next();
}

// Lista todas as contas
app.get("/api/superadmin/accounts", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, isSuperAdmin: true, createdAt: true,
        memberships: { select: { role: true, tenant: { select: { id: true, name: true, slug: true } } } },
      },
    });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: "Falha ao listar contas." });
  }
});

// Remove uma conta (não pode remover a si mesmo)
app.delete("/api/superadmin/accounts/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  const me = currentAccount(req)!;
  if (req.params.id === me.id) return res.status(400).json({ error: "Você não pode remover sua própria conta." });
  try {
    await prisma.account.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Falha ao remover conta." });
  }
});

// Lista os convites gerados
app.get("/api/superadmin/invites", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const invites = await prisma.inviteToken.findMany({
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true, email: true } } },
    });
    res.json(invites);
  } catch (error) {
    res.status(500).json({ error: "Falha ao listar convites." });
  }
});

// Gera novo convite (opcionalmente envia por email)
app.post("/api/superadmin/invites", requireAuth, requireSuperAdmin, async (req, res) => {
  const me = currentAccount(req)!;
  const { note, expiresInHours = 48, sendTo } = req.body;
  try {
    const token = [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
    const expiresAt = new Date(Date.now() + Number(expiresInHours) * 60 * 60 * 1000);
    const invite = await prisma.inviteToken.create({
      data: { token, createdById: me.id, expiresAt, note: note || null },
    });
    if (sendTo) {
      sendInviteEmail(String(sendTo).trim(), token, note).catch((err) => {
        console.error("[mailer] invite:", err);
      });
    }
    res.json(invite);
  } catch (error) {
    res.status(500).json({ error: "Falha ao gerar convite." });
  }
});

// Revoga/deleta um convite (se ainda não usado)
app.delete("/api/superadmin/invites/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    await prisma.inviteToken.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Falha ao revogar convite." });
  }
});

// Dashboard stats do super admin
app.get("/api/superadmin/stats", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const now = new Date();
    const [accounts, tenants, subscriptions, plans, invites] = await Promise.all([
      prisma.account.count(),
      prisma.tenant.count(),
      (prisma as any).subscription.findMany({
        include: { plan: true, account: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      }),
      (prisma as any).subscriptionPlan.findMany({ orderBy: { price: "asc" } }),
      prisma.inviteToken.count(),
    ]);

    const activeSubscriptions = subscriptions.filter((s: any) => s.status === "ACTIVE" && new Date(s.expiresAt) > now);
    const expiredSubscriptions = subscriptions.filter((s: any) => new Date(s.expiresAt) <= now);
    const monthlyRevenue = subscriptions
      .filter((s: any) => {
        const d = new Date(s.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((acc: number, s: any) => acc + s.pricePaid, 0);
    const totalRevenue = subscriptions.reduce((acc: number, s: any) => acc + s.pricePaid, 0);

    // Receita por mês (últimos 6 meses)
    const revenueByMonth: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      revenueByMonth[key] = 0;
    }
    subscriptions.forEach((s: any) => {
      const d = new Date(s.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key in revenueByMonth) revenueByMonth[key] += s.pricePaid;
    });

    res.json({
      accounts, tenants, invites, totalRevenue, monthlyRevenue,
      activeSubscriptions: activeSubscriptions.length,
      expiredSubscriptions: expiredSubscriptions.length,
      revenueByMonth,
      subscriptions,
      plans,
    });
  } catch (error) {
    console.error("ERRO superadmin/stats:", error);
    res.status(500).json({ error: "Falha ao carregar stats." });
  }
});

// Lista planos
app.get("/api/superadmin/plans", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const plans = await (prisma as any).subscriptionPlan.findMany({ orderBy: { price: "asc" } });
    res.json(plans);
  } catch (error) { res.status(500).json({ error: "Falha ao listar planos." }); }
});

// Cria plano
app.post("/api/superadmin/plans", requireAuth, requireSuperAdmin, async (req, res) => {
  const { name, description, price, durationDays, features, color, defaultStaffPermissions } = req.body;
  try {
    const plan = await (prisma as any).subscriptionPlan.create({
      data: {
        name, description: description || null,
        price: Number(price) || 0, durationDays: Number(durationDays) || 30,
        features: features || null, color: color || "#C9A227",
        defaultStaffPermissions: defaultStaffPermissions ?? null,
      },
    });
    res.json(plan);
  } catch (error) { res.status(500).json({ error: "Falha ao criar plano." }); }
});

// Edita plano
app.patch("/api/superadmin/plans/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  const { name, description, price, durationDays, features, color, isActive, defaultStaffPermissions } = req.body;
  try {
    const plan = await (prisma as any).subscriptionPlan.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: Number(price) }),
        ...(durationDays !== undefined && { durationDays: Number(durationDays) }),
        ...(features !== undefined && { features }),
        ...(color !== undefined && { color }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(defaultStaffPermissions !== undefined && { defaultStaffPermissions: defaultStaffPermissions ?? null }),
      },
    });
    res.json(plan);
  } catch (error) { res.status(500).json({ error: "Falha ao editar plano." }); }
});

// Remove plano
app.delete("/api/superadmin/plans/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    await (prisma as any).subscriptionPlan.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Falha ao remover plano." }); }
});

// Lista assinaturas
app.get("/api/superadmin/subscriptions", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const subs = await (prisma as any).subscription.findMany({
      include: { plan: true, account: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(subs);
  } catch (error) { res.status(500).json({ error: "Falha ao listar assinaturas." }); }
});

// Cria assinatura para uma conta
app.post("/api/superadmin/subscriptions", requireAuth, requireSuperAdmin, async (req, res) => {
  const me = currentAccount(req)!;
  const { accountId, planId, pricePaid, notes, startsAt } = req.body;
  try {
    const plan = await (prisma as any).subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ error: "Plano não encontrado." });
    const start = startsAt ? new Date(startsAt) : new Date();
    const expires = new Date(start.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
    const sub = await (prisma as any).subscription.create({
      data: { accountId, planId, pricePaid: Number(pricePaid) || plan.price, notes: notes || null, startsAt: start, expiresAt: expires, createdById: me.id, status: "ACTIVE" },
      include: { plan: true, account: { select: { id: true, name: true, email: true } } },
    });
    res.json(sub);
  } catch (error) { res.status(500).json({ error: "Falha ao criar assinatura." }); }
});

// Cancela assinatura
app.delete("/api/superadmin/subscriptions/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    await (prisma as any).subscription.update({ where: { id: req.params.id }, data: { status: "CANCELLED" } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Falha ao cancelar assinatura." }); }
});

app.get("/api/owner/tenants", requireAuth, async (req, res) => {
  const account = currentAccount(req)!;
  const tenants = await listAccountTenants(account.id);
  res.json(tenants);
});

app.post("/api/owner/tenants", requireAuth, async (req, res) => {
  const account = currentAccount(req)!;
  const { name, slug, description, address, whatsapp } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Nome do estabelecimento é obrigatório." });
  }

  try {
    const normalizedSlug = sanitizeSlug(slug || name);
    if (!normalizedSlug) {
      return res.status(400).json({ error: "Slug inválido." });
    }

    const existing = await prisma.tenant.findUnique({ where: { slug: normalizedSlug } });
    if (existing) {
      return res.status(400).json({ error: "Já existe um estabelecimento com esse link." });
    }

    const tenant = await prisma.tenant.create({
      data: {
        name: String(name).trim(),
        slug: normalizedSlug,
        description: description || null,
        address: address || null,
        whatsapp: whatsapp || null,
      },
    });

    await prisma.tenantMembership.create({
      data: {
        accountId: account.id,
        tenantId: tenant.id,
        role: "OWNER",
      },
    });

    await ensureWppSetup(tenant.id, tenant.name);

    res.json(await getAuthorizedTenantById(account.id, tenant.id));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Falha ao criar estabelecimento." });
  }
});

app.post("/api/owner/tenants/claim", requireAuth, async (req, res) => {
  const account = currentAccount(req)!;
  const { slug } = req.body;
  const normalizedSlug = sanitizeSlug(slug);

  if (!normalizedSlug) {
    return res.status(400).json({ error: "Slug do estabelecimento é obrigatório." });
  }

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: normalizedSlug } });
    if (!tenant) {
      return res.status(404).json({ error: "Estabelecimento não encontrado." });
    }

    const existingMembership = await prisma.tenantMembership.findFirst({
      where: { tenantId: tenant.id },
    });

    if (existingMembership) {
      return res.status(400).json({ error: "Este estabelecimento já possui um dono vinculado." });
    }

    await prisma.tenantMembership.create({
      data: {
        accountId: account.id,
        tenantId: tenant.id,
        role: "OWNER",
      },
    });

    await ensureWppSetup(tenant.id, tenant.name);

    res.json(await getAuthorizedTenantById(account.id, tenant.id));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Falha ao vincular estabelecimento." });
  }
});

app.patch("/api/owner/tenants/:tenantId", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.tenantId);
  if (!tenant) return;

  const { name, description, address, whatsapp, logoUrl, isOpen, scheduleMode, scheduleType, scheduleDays, scheduleNotes, orderMode, businessHours, deliveryConfig, paymentMethods, stoneConfig, fiscalConfig } = req.body;
  try {
    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(description !== undefined && { description: description || null }),
        ...(address !== undefined && { address: address || null }),
        ...(whatsapp !== undefined && { whatsapp: whatsapp || null }),
        ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
        ...(isOpen !== undefined && { isOpen: Boolean(isOpen) }),
        ...(scheduleMode !== undefined && { scheduleMode: Boolean(scheduleMode) }),
        ...(scheduleType !== undefined && { scheduleType: scheduleType || "CLIENT_CHOOSES" }),
        ...(scheduleDays !== undefined && { scheduleDays: scheduleDays ? (typeof scheduleDays === "string" ? scheduleDays : JSON.stringify(scheduleDays)) : null }),
        ...(scheduleNotes !== undefined && { scheduleNotes: scheduleNotes || null }),
        ...(orderMode !== undefined && { orderMode: orderMode || "DELIVERY_ONLY" }),
        ...(businessHours !== undefined && { 
          businessHours: (businessHours === null || businessHours === "null") ? null : 
                        (typeof businessHours === "string" ? businessHours : JSON.stringify(businessHours)) 
        }),
        ...(deliveryConfig !== undefined && { 
          deliveryConfig: (deliveryConfig === null || deliveryConfig === "null") ? null : 
                          (typeof deliveryConfig === "string" ? deliveryConfig : JSON.stringify(deliveryConfig)) 
        }),
        ...(paymentMethods !== undefined && {
          paymentMethods: (paymentMethods === null || paymentMethods === "null") ? null :
                          (typeof paymentMethods === "string" ? paymentMethods : JSON.stringify(paymentMethods))
        }),
        ...(stoneConfig !== undefined && {
          stoneConfig: (stoneConfig === null || stoneConfig === "null") ? null :
                       (typeof stoneConfig === "string" ? stoneConfig : JSON.stringify(stoneConfig))
        }),
        ...(fiscalConfig !== undefined && {
          fiscalConfig: (fiscalConfig === null || fiscalConfig === "null") ? null :
                        (typeof fiscalConfig === "string" ? fiscalConfig : JSON.stringify(fiscalConfig))
        }),
      },
    });

    // Invalida cache do wizard se config fiscal mudou
    if (fiscalConfig !== undefined) {
      try {
        const { invalidateFiscalCache } = await import("./src/lib/fiscal.js");
        invalidateFiscalCache(tenant.id);
      } catch {
        // nfewizard-io não instalado — ignora
      }
    }

    res.json(updated);
  } catch (error) {
    console.error("TENANT UPDATE ERROR:", error);
    res.status(500).json({ error: "Falha ao atualizar estabelecimento." });
  }

  if (name) {
    try {
      await ensureWppSetup(req.params.tenantId, String(name).trim());
    } catch (wppError) {
      console.error("Erro ao configurar WhatsApp (não crítico):", wppError);
    }
  }
});

app.get("/api/owner/tenants/by-slug/:slug", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;
  res.json(tenant);
});

app.get("/api/owner/tenants/:tenantId", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.tenantId);
  if (!tenant) return;
  res.json(tenant);
});

// ── STAFF / MEMBERSHIPS ──────────────────────────────────────────────────────

// List all staff members for a tenant
app.get("/api/owner/tenants/:tenantId/staff", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.tenantId);
  if (!tenant) return;

  // Only OWNER can manage staff
  const account = currentAccount(req)!;
  const myMembership = await prisma.tenantMembership.findFirst({ where: { accountId: account.id, tenantId: tenant.id } });
  if (!myMembership || myMembership.role !== "OWNER") return res.status(403).json({ error: "Apenas o proprietário pode gerenciar a equipe." });

  const members = await prisma.tenantMembership.findMany({
    where: { tenantId: tenant.id },
    include: { account: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  res.json(members.map((m: any) => ({
    id: m.id,
    role: m.role,
    name: m.name ?? null,
    permissions: m.permissions ? JSON.parse(m.permissions) : null,
    createdAt: m.createdAt,
    account: m.account,
  })));
});

// Invite a new staff member by email
app.post("/api/owner/tenants/:tenantId/staff/invite", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.tenantId);
  if (!tenant) return;

  const account = currentAccount(req)!;
  const myMembership = await prisma.tenantMembership.findFirst({ where: { accountId: account.id, tenantId: tenant.id } });
  if (!myMembership || myMembership.role !== "OWNER") return res.status(403).json({ error: "Apenas o proprietário pode convidar membros." });

  const { email, role, name, permissions } = req.body;
  if (!email || !role) return res.status(400).json({ error: "email e role são obrigatórios." });
  if (!["ADMIN", "STAFF"].includes(role)) return res.status(400).json({ error: "role deve ser ADMIN ou STAFF." });

  // Find the account by email
  const targetAccount = await prisma.account.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!targetAccount) return res.status(404).json({ error: "Nenhuma conta encontrada com este e-mail. O usuário precisa se registrar primeiro." });

  // Check if already a member
  const existing = await prisma.tenantMembership.findFirst({ where: { accountId: targetAccount.id, tenantId: tenant.id } });
  if (existing) return res.status(409).json({ error: "Este usuário já é membro deste estabelecimento." });

  const member = await prisma.tenantMembership.create({
    data: {
      accountId: targetAccount.id,
      tenantId: tenant.id,
      role,
      name: name || null,
      permissions: permissions ? JSON.stringify(permissions) : null,
    },
    include: { account: { select: { id: true, email: true, name: true } } },
  });

  res.json({
    id: (member as any).id,
    role: (member as any).role,
    name: (member as any).name ?? null,
    permissions: (member as any).permissions ? JSON.parse((member as any).permissions) : null,
    account: (member as any).account,
  });
});

// Update staff member role/permissions/name
app.patch("/api/owner/tenants/:tenantId/staff/:membershipId", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.tenantId);
  if (!tenant) return;

  const account = currentAccount(req)!;
  const myMembership = await prisma.tenantMembership.findFirst({ where: { accountId: account.id, tenantId: tenant.id } });
  if (!myMembership || myMembership.role !== "OWNER") return res.status(403).json({ error: "Apenas o proprietário pode editar permissões." });

  const target = await prisma.tenantMembership.findFirst({ where: { id: req.params.membershipId, tenantId: tenant.id } });
  if (!target) return res.status(404).json({ error: "Membro não encontrado." });
  if ((target as any).role === "OWNER") return res.status(400).json({ error: "Não é possível alterar o proprietário." });

  const { role, name, permissions } = req.body;

  const updated = await prisma.tenantMembership.update({
    where: { id: req.params.membershipId },
    data: {
      ...(role && ["ADMIN", "STAFF"].includes(role) && { role }),
      ...(name !== undefined && { name: name || null }),
      ...(permissions !== undefined && { permissions: permissions === null ? null : JSON.stringify(permissions) }),
    },
    include: { account: { select: { id: true, email: true, name: true } } },
  });

  res.json({
    id: (updated as any).id,
    role: (updated as any).role,
    name: (updated as any).name ?? null,
    permissions: (updated as any).permissions ? JSON.parse((updated as any).permissions) : null,
    account: (updated as any).account,
  });
});

// Remove a staff member
app.delete("/api/owner/tenants/:tenantId/staff/:membershipId", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.tenantId);
  if (!tenant) return;

  const account = currentAccount(req)!;
  const myMembership = await prisma.tenantMembership.findFirst({ where: { accountId: account.id, tenantId: tenant.id } });
  if (!myMembership || myMembership.role !== "OWNER") return res.status(403).json({ error: "Apenas o proprietário pode remover membros." });

  const target = await prisma.tenantMembership.findFirst({ where: { id: req.params.membershipId, tenantId: tenant.id } });
  if (!target) return res.status(404).json({ error: "Membro não encontrado." });
  if ((target as any).role === "OWNER") return res.status(400).json({ error: "Não é possível remover o proprietário." });

  await prisma.tenantMembership.delete({ where: { id: req.params.membershipId } });
  res.json({ ok: true });
});

// Get my own membership for a tenant (used by dashboard to load permissions)
app.get("/api/owner/tenants/:tenantId/my-membership", requireAuth, async (req, res) => {
  const account = currentAccount(req)!;
  const membership = await prisma.tenantMembership.findFirst({
    where: { accountId: account.id, tenantId: req.params.tenantId },
  });
  if (!membership) return res.status(404).json({ error: "Sem acesso." });

  res.json({
    id: (membership as any).id,
    role: (membership as any).role,
    name: (membership as any).name ?? null,
    permissions: (membership as any).permissions ? JSON.parse((membership as any).permissions) : null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────

app.get("/api/owner/tenants/:tenantId/wpp", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.tenantId);
  if (!tenant) return;

  await ensureWppSetup(tenant.id, tenant.name);
  const info = getSessionInfo(tenant.id);
  const config = await prisma.wppBotConfig.findUnique({ where: { tenantId: tenant.id } });
  const instance = await prisma.wppInstance.findUnique({ where: { tenantId: tenant.id } });

  res.json({
    instance,
    config,
    session: info,
  });
});

app.post("/api/owner/tenants/:tenantId/wpp/connect", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.tenantId);
  if (!tenant) return;

  await ensureWppSetup(tenant.id, tenant.name);
  const info = await connectSession(tenant.id);
  res.json({ status: info.status, phone: info.phone, qrCode: info.qrDataUrl });
});

app.get("/api/owner/tenants/:tenantId/wpp/status", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.tenantId);
  if (!tenant) return;

  const info = getSessionInfo(tenant.id);
  res.json({ status: info.status, phone: info.phone, qrCode: info.qrDataUrl });
});

app.get("/api/owner/tenants/:tenantId/wpp/qr", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.tenantId);
  if (!tenant) return;

  res.json({
    status: getSessionInfo(tenant.id).status,
    qrCode: getQrCode(tenant.id),
  });
});

app.post("/api/owner/tenants/:tenantId/wpp/disconnect", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.tenantId);
  if (!tenant) return;

  await disconnectSession(tenant.id);
  res.json({ success: true });
});

app.patch("/api/owner/tenants/:tenantId/wpp/config", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.tenantId);
  if (!tenant) return;

  const {
    botEnabled,
    autoReplyEnabled,
    sendOrderCreated,
    sendStatusUpdates,
    welcomeMessage,
    instanceName,
    isPaused,
    startTime,
    endTime,
    preorderMessage,
  } = req.body;

  const [config, instance] = await Promise.all([
    prisma.wppBotConfig.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        botEnabled: !!botEnabled,
        autoReplyEnabled: autoReplyEnabled !== false,
        sendOrderCreated: sendOrderCreated !== false,
        sendStatusUpdates: sendStatusUpdates !== false,
        welcomeMessage: welcomeMessage || null,
        isPaused: !!isPaused,
        startTime: startTime || null,
        endTime: endTime || null,
        preorderMessage: preorderMessage || null,
      },
      update: {
        ...(botEnabled !== undefined && { botEnabled: !!botEnabled }),
        ...(autoReplyEnabled !== undefined && { autoReplyEnabled: !!autoReplyEnabled }),
        ...(sendOrderCreated !== undefined && { sendOrderCreated: !!sendOrderCreated }),
        ...(sendStatusUpdates !== undefined && { sendStatusUpdates: !!sendStatusUpdates }),
        ...(welcomeMessage !== undefined && { welcomeMessage: welcomeMessage || null }),
        ...(isPaused !== undefined && { isPaused: !!isPaused }),
        ...(startTime !== undefined && { startTime: startTime || null }),
        ...(endTime !== undefined && { endTime: endTime || null }),
        ...(preorderMessage !== undefined && { preorderMessage: preorderMessage || null }),
      },
    }),
    prisma.wppInstance.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        instanceName: String(instanceName || `${tenant.name} Bot`).trim(),
        status: "not_configured",
      },
      update: {
        ...(instanceName !== undefined && { instanceName: String(instanceName || `${tenant.name} Bot`).trim() }),
      },
    }),
  ]);

  res.json({ config, instance, session: getSessionInfo(tenant.id) });
});

app.post("/api/owner/tenants/:tenantId/wpp/test", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.tenantId);
  if (!tenant) return;

  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: "Telefone e mensagem são obrigatórios." });
  }

  const info = getSessionInfo(tenant.id);
  if (info.status !== "connected") {
    return res.status(400).json({ error: "WhatsApp não está conectado." });
  }

  await sendMessage(tenant.id, String(phone), String(message));
  res.json({ success: true });
});

app.post("/api/upload", requireAuth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.get("/api/tenants/check-slug/:slug", async (req, res) => {
  const { slug } = req.params;
  const existing = await prisma.tenant.findUnique({ where: { slug } });
  res.json({ taken: !!existing });
});

function isProductActiveNow(scheduleRule: string | null): boolean {
  if (!scheduleRule) return true;
  try {
    const rule = JSON.parse(scheduleRule) as { type: string; weekdays?: number[]; weekdayStartTime?: string; weekdayEndTime?: string; startDate?: string; endDate?: string };
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const todayWeekday = now.getDay();
    const todayStr = now.toISOString().split("T")[0];
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const checkWeekday = (): boolean => {
      if (!rule.weekdays || rule.weekdays.length === 0) return false;
      if (!rule.weekdays.includes(todayWeekday)) return false;
      const startMin = rule.weekdayStartTime ? parseInt(rule.weekdayStartTime.split(":")[0]) * 60 + parseInt(rule.weekdayStartTime.split(":")[1]) : 0;
      const endMin = rule.weekdayEndTime ? parseInt(rule.weekdayEndTime.split(":")[0]) * 60 + parseInt(rule.weekdayEndTime.split(":")[1]) : 23 * 60 + 59;
      return nowMinutes >= startMin && nowMinutes <= endMin;
    };

    const checkDaterange = (): boolean => {
      if (!rule.startDate || !rule.endDate) return false;
      return todayStr >= rule.startDate && todayStr <= rule.endDate;
    };

    if (rule.type === "weekday") return checkWeekday();
    if (rule.type === "daterange") return checkDaterange();
    if (rule.type === "both") return checkWeekday() && checkDaterange();
    return true;
  } catch {
    return true;
  }
}

app.get("/api/tenants/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      include: {
        categories: {
          include: {
            products: {
              where: { available: true, pdvOnly: false },
              include: {
                variants: true,
                inventoryItem: true
              },
            },
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    // Filter out products with zero stock or inactive schedule rule
    const filteredCategories = tenant.categories.map(cat => ({
      ...cat,
      products: cat.products.filter(p => {
        if (p.inventoryItem && p.inventoryItem.quantity <= 0) return false;
        if ((p as any).scheduleRule && !isProductActiveNow((p as any).scheduleRule)) return false;
        return true;
      })
    })).filter(cat => cat.products.length > 0);

    res.json({ ...tenant, categories: filteredCategories });
  } catch (error) {
    console.error("Error fetching tenant:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Haversine distance between two lat/lng points in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Geocode a CEP using the public nominatim API (no key required)
async function geocodeCep(cep: string): Promise<{ lat: number; lng: number } | null> {
  const digits = cep.replace(/\D/g, "");
  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${digits}&country=BR&format=json&limit=1`;
    const r = await fetch(url, { headers: { "User-Agent": "cardapio-delivery-app/1.0" } });
    const data = await r.json() as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

function fmtBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

// Calculate delivery fee for a given CEP
app.get("/api/tenants/:slug/delivery-fee", async (req, res) => {
  const { slug } = req.params;
  const { cep } = req.query as { cep?: string };

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { deliveryConfig: true } });
    if (!tenant) return res.status(404).json({ error: "Not found" });

    if (!tenant.deliveryConfig) return res.json({ fee: 0, label: "Grátis" });

    const config = JSON.parse(tenant.deliveryConfig) as {
      mode: string; fixedFee?: number; defaultFee?: number; allowUnlisted?: boolean;
      zones?: Array<{ id: string; label: string; ceps: string[]; fee: number }>;
      originCep?: string;
      kmRanges?: Array<{ id: string; upToKm: number; fee: number }>;
      kmDefaultFee?: number;
      kmAllowBeyond?: boolean;
    };

    if (config.mode === "free") return res.json({ fee: 0, label: "Grátis" });
    if (config.mode === "fixed") return res.json({ fee: config.fixedFee ?? 0, label: fmtBRL(config.fixedFee ?? 0) });

    if (config.mode === "zones" && cep) {
      const cleanCep = cep.replace(/\D/g, "");
      const zone = config.zones?.find((z) =>
        z.ceps.some((prefix) => cleanCep.startsWith(prefix.replace(/\D/g, "")))
      );
      if (zone) return res.json({ fee: zone.fee, label: zone.fee === 0 ? "Grátis" : fmtBRL(zone.fee), zone: zone.label });
      if (config.allowUnlisted === false) return res.json({ fee: null, label: "Fora da área de entrega", blocked: true });
      const fallback = config.defaultFee ?? 0;
      return res.json({ fee: fallback, label: fallback === 0 ? "Grátis" : fmtBRL(fallback), zone: "Outros" });
    }

    if (config.mode === "km" && cep) {
      if (!config.originCep || !config.kmRanges?.length) {
        return res.json({ fee: 0, label: "Grátis" });
      }
      const [origin, destination] = await Promise.all([
        geocodeCep(config.originCep),
        geocodeCep(cep),
      ]);
      if (!origin || !destination) {
        return res.json({ fee: config.kmDefaultFee ?? 0, label: "Distância não calculável", distanceKm: null });
      }
      const distanceKm = haversineKm(origin.lat, origin.lng, destination.lat, destination.lng);
      const sorted = [...config.kmRanges].sort((a, b) => a.upToKm - b.upToKm);
      const matched = sorted.find((r) => distanceKm <= r.upToKm);
      if (matched) {
        return res.json({
          fee: matched.fee,
          label: matched.fee === 0 ? "Grátis" : fmtBRL(matched.fee),
          distanceKm: Math.round(distanceKm * 10) / 10,
          range: `até ${matched.upToKm} km`,
        });
      }
      // beyond last range
      if (config.kmAllowBeyond === false) {
        return res.json({ fee: null, label: "Fora da área de entrega", blocked: true, distanceKm: Math.round(distanceKm * 10) / 10 });
      }
      const beyond = config.kmDefaultFee ?? 0;
      return res.json({
        fee: beyond,
        label: beyond === 0 ? "Grátis" : fmtBRL(beyond),
        distanceKm: Math.round(distanceKm * 10) / 10,
        range: `além de ${sorted[sorted.length - 1].upToKm} km`,
      });
    }

    return res.json({ fee: 0, label: "Grátis" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/admin/tenant/:slug", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  const completeTenant = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    include: {
      categories: {
        include: {
          products: {
            include: {
              variants: true,
              inventoryItem: true,
            },
          },
        },
      },
      wppInstance: true,
      wppBotConfig: true,
    },
  });

  // Enriquece produtos com recipeId (campo novo não está no Prisma client gerado)
  if (completeTenant) {
    const productIds = completeTenant.categories.flatMap((c: any) => (c.products || []).map((p: any) => p.id));
    if (productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(', ');
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id, recipe_id FROM products WHERE id IN (${placeholders})`,
        ...productIds,
      ) as Array<{ id: string; recipe_id: string | null }>;
      const recipeMap = new Map(rows.map(r => [r.id, r.recipe_id]));
      (completeTenant as any).categories = completeTenant.categories.map((cat: any) => ({
        ...cat,
        products: (cat.products || []).map((p: any) => ({
          ...p,
          recipeId: recipeMap.get(p.id) ?? null,
        })),
      }));
    }
  }

  res.json(completeTenant);
});

app.post("/api/orders", async (req, res) => {
  console.log("Incoming Order Body:", JSON.stringify(req.body, null, 2));
  const { customerName, customerPhone, address, items, tenantId, orderType, paymentMethod, paymentDetail, tableId, scheduledDate, scheduledTime, notes } = req.body;

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    let total = 0;
    const orderItemsData: Array<{
      productId: string;
      productVariantId: string | null;
      quantity: number;
      price: number;
      notes: string | null;
    }> = [];

    for (const item of items || []) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { variants: true },
      });

      if (!product) continue;

      let itemPrice = product.price;
      if (item.productVariantId) {
        const variant = product.variants.find((current) => current.id === item.productVariantId);
        if (variant) itemPrice = variant.price;
      }

      total += itemPrice * item.quantity;
      orderItemsData.push({
        productId: item.productId,
        productVariantId: item.productVariantId || null,
        quantity: item.quantity,
        price: itemPrice,
        notes: item.notes || null,
      });
    }

    const order = await prisma.order.create({
      data: {
        customerName,
        customerPhone,
        address,
        orderType: orderType || "DELIVERY",
        paymentMethod: paymentMethod || "CASH",
        paymentDetail,
        notes: notes || null,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        scheduledTime: scheduledTime || null,
        total,
        tenantId,
        tableId: tableId || null,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        tenant: true,
      },
    });

    io.to(`tenant-${tenant.id}`).emit("new-order", order);
    if (order.tableId) {
      io.to(`${tenant.id}-mesa-${order.tableId}`).emit("table-update");
    }
    await sendOrderCreatedMessage(order, tenant).catch(() => undefined);
    await sendOwnerOrderAlert(order, tenant).catch(() => undefined);

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to place order" });
  }
});

// Buscar pedidos ativos de uma mesa
app.get("/api/orders/table/:slug/:tableId", async (req, res) => {
  const { slug, tableId } = req.params;
  try {
    const orders = await prisma.order.findMany({
      where: {
        tenant: { slug },
        tableId: tableId,
        status: { notIn: ["DELIVERED", "CANCELLED"] }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar pedidos" });
  }
});

app.patch("/api/orders/:id/status", requireAuth, async (req, res) => {
  const tenantOrder = await requireTenantFromOrder(req, res, req.params.id);
  if (!tenantOrder) return;

  const { order } = tenantOrder;
  const { status } = req.body;

  try {
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status },
      include: {
        tenant: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (status === "PREPARING" && order.status !== "PREPARING") {
      for (const item of updatedOrder.items) {
        // Deduct direct inventory link
        let inventoryItemId = item.productVariantId
          ? (await prisma.productVariant.findUnique({ where: { id: item.productVariantId } }))?.inventoryItemId
          : item.product.inventoryItemId;

        if (inventoryItemId) {
          const updatedItem = await prisma.inventoryItem.update({
            where: { id: inventoryItemId },
            data: {
              quantity: { decrement: item.quantity },
              movements: {
                create: {
                  type: "OUT",
                  quantity: item.quantity,
                  reason: "SALE",
                  orderId: updatedOrder.id,
                },
              },
            },
          });

          io.to(`tenant-${updatedOrder.tenantId}`).emit("inventory-update", {
            id: updatedItem.id,
            quantity: updatedItem.quantity
          });

          if (updatedItem.quantity <= 0) {
            const productsToDisable = await prisma.product.findMany({
              where: { inventoryItemId: updatedItem.id, available: true },
            });
            for (const p of productsToDisable) {
              if (!(p as any).autoDisableWhenOutOfStock) continue;
              await prisma.product.update({ where: { id: p.id }, data: { available: false } });
              io.to(`tenant-${updatedOrder.tenantId}`).emit("product-availability-changed", { id: p.id, available: false });
            }
          }
        }

        // Deduct production recipe ingredients when product is linked to a recipe
        const productRecipeId = (item.product as any).recipeId;
        if (productRecipeId) {
          const recipeRaw = await prisma.productionRecipe.findUnique({
            where: { id: productRecipeId },
          });
          if (recipeRaw && recipeRaw.outputQuantity > 0) {
            const ingredients: Array<{ inventoryItemId: string; quantity: number }> = (() => {
              try { return JSON.parse(recipeRaw.ingredients as string) || []; } catch { return []; }
            })();
            const ratio = item.quantity / recipeRaw.outputQuantity;
            for (const ingredient of ingredients) {
              if (!ingredient.inventoryItemId || !ingredient.quantity) continue;
              const deductQty = ingredient.quantity * ratio;
              const updatedIngredient = await prisma.inventoryItem.update({
                where: { id: ingredient.inventoryItemId },
                data: {
                  quantity: { decrement: deductQty },
                  movements: {
                    create: {
                      type: "OUT",
                      quantity: deductQty,
                      reason: "PRODUCTION",
                      orderId: updatedOrder.id,
                    },
                  },
                },
              });
              io.to(`tenant-${updatedOrder.tenantId}`).emit("inventory-update", {
                id: updatedIngredient.id,
                quantity: updatedIngredient.quantity,
              });
            }
          }
        }
      }
    }

    io.to(`tenant-${updatedOrder.tenantId}`).emit("order-status-updated", updatedOrder);
    await sendOrderStatusMessage(updatedOrder, updatedOrder.tenant).catch(() => undefined);

    res.json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

app.get("/api/admin/:tenantId/orders", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.tenantId);
  if (!tenant) return;

  try {
    const orders = await prisma.order.findMany({
      where: { tenantId: tenant.id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.post("/api/admin/:tenantId/table/:tableId/clear", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.tenantId);
  if (!tenant) return;

  const { tableId } = req.params;

  try {
    await prisma.order.updateMany({
      where: {
        tenantId: tenant.id,
        tableId: tableId,
        status: { notIn: ["DELIVERED", "CANCELLED"] }
      },
      data: { status: "DELIVERED" }
    });

    io.to(`${tenant.id}-mesa-${tableId}`).emit("table-update");
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to clear table" });
  }
});

app.patch("/api/tenants/:id", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.id);
  if (!tenant) return;

  const { name, description, address, logoUrl, whatsapp } = req.body;

  try {
    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { name, description, address, logoUrl, whatsapp },
    });

    await ensureWppSetup(updated.id, updated.name);
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update tenant" });
  }
});

app.post("/api/categories", requireAuth, async (req, res) => {
  const { name, tenantId } = req.body;
  const tenant = await requireTenantById(req, res, tenantId);
  if (!tenant) return;

  try {
    const category = await prisma.category.create({
      data: { name, tenantId: tenant.id },
    });
    res.json(category);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create category" });
  }
});

app.patch("/api/categories/:id", requireAuth, async (req, res) => {
  const { name } = req.body;
  try {
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { name },
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: "Failed to update category" });
  }
});

app.delete("/api/categories/:id", requireAuth, async (req, res) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete category" });
  }
});

app.post("/api/products", requireAuth, async (req, res) => {
  const { name, description, price, imageUrl, categoryId, tenantId, variants, inventoryItemId, pdvOnly, extras, scheduleRule, recipeId } = req.body;
  const tenant = await requireTenantById(req, res, tenantId);
  if (!tenant) return;

  try {
    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        imageUrl,
        categoryId,
        tenantId: tenant.id,
        available: true,
        pdvOnly: Boolean(pdvOnly),
        inventoryItemId: inventoryItemId || null,
        extras: extras ? (typeof extras === 'string' ? extras : JSON.stringify(extras)) : null,
        scheduleRule: scheduleRule ? (typeof scheduleRule === 'string' ? scheduleRule : JSON.stringify(scheduleRule)) : null,
        variants: Array.isArray(variants)
          ? {
              create: variants.map((variant: any) => ({
                name: variant.name,
                price: parseFloat(variant.price),
                description: variant.description,
              })),
            }
          : undefined,
      },
      include: { variants: true },
    });

    // Salva recipeId via SQL pois o campo foi adicionado ao banco mas o client Prisma ainda não foi regenerado
    if (recipeId) {
      await prisma.$executeRawUnsafe(
        'UPDATE products SET recipe_id = ? WHERE id = ?',
        recipeId,
        product.id,
      );
    }

    res.json({ ...product, recipeId: recipeId || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

app.patch("/api/products/:id", requireAuth, async (req, res) => {
  const scoped = await requireTenantFromProduct(req, res, req.params.id);
  if (!scoped) return;

  const { name, description, price, imageUrl, variants, inventoryItemId, available, autoDisableWhenOutOfStock, pdvOnly, extras, scheduleRule, recipeId } = req.body;

  try {
    const product = await prisma.$transaction(async (tx) => {
      await tx.productVariant.deleteMany({ where: { productId: scoped.product.id } });

      return tx.product.update({
        where: { id: scoped.product.id },
        data: {
          name,
          description,
          price: parseFloat(price),
          imageUrl,
          inventoryItemId: inventoryItemId || null,
          extras: extras !== undefined ? (typeof extras === 'string' ? extras : JSON.stringify(extras)) : undefined,
          scheduleRule: scheduleRule !== undefined ? (scheduleRule ? (typeof scheduleRule === 'string' ? scheduleRule : JSON.stringify(scheduleRule)) : null) : undefined,
          ...(available !== undefined && { available: Boolean(available) }),
          ...(autoDisableWhenOutOfStock !== undefined && { autoDisableWhenOutOfStock: Boolean(autoDisableWhenOutOfStock) }),
          ...(pdvOnly !== undefined && { pdvOnly: Boolean(pdvOnly) }),
          variants: Array.isArray(variants)
            ? {
                create: variants.map((variant: any) => ({
                  name: variant.name,
                  price: parseFloat(variant.price),
                  description: variant.description,
                })),
              }
            : undefined,
        },
        include: { variants: true },
      });
    });

    // Salva recipeId via SQL pois o campo foi adicionado ao banco mas o client Prisma ainda não foi regenerado
    if (recipeId !== undefined) {
      await prisma.$executeRawUnsafe(
        'UPDATE products SET recipe_id = ? WHERE id = ?',
        recipeId || null,
        scoped.product.id,
      );
    }

    res.json({ ...product, recipeId: recipeId !== undefined ? (recipeId || null) : undefined });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

app.patch("/api/products/:id/availability", requireAuth, async (req, res) => {
  const scoped = await requireTenantFromProduct(req, res, req.params.id);
  if (!scoped) return;

  const { available } = req.body;

  try {
    const product = await prisma.product.update({
      where: { id: scoped.product.id },
      data: { available: Boolean(available) },
    });
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update product availability" });
  }
});

app.delete("/api/products/:id", requireAuth, async (req, res) => {
  const scoped = await requireTenantFromProduct(req, res, req.params.id);
  if (!scoped) return;

  try {
    await prisma.product.delete({ where: { id: scoped.product.id } });
    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

app.post("/api/bot/webhook", async (req, res) => {
  const { body, tenantSlug } = req.body;
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });

  if (tenant && String(body || "").toLowerCase().includes("cardapio")) {
    const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
    return res.json({
      reply: `Olá! Veja nosso cardápio online aqui: ${baseUrl}/${tenant.slug}`,
    });
  }

  res.json({ reply: "Não entendi. Digite 'cardápio' para ver as opções." });
});

app.get("/api/tenants/:slug/orders", async (req, res) => {
  const { slug } = req.params;

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const orders = await prisma.order.findMany({
      where: {
        tenantId: tenant.id,
        status: { in: ["PREPARING", "SHIPPED", "DELIVERED"] },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch public orders" });
  }
});

app.get("/api/tenants/:slug/finance-summary", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const now = new Date();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [daily, weekly, monthly] = await Promise.all([
      prisma.order.aggregate({
        where: {
          tenantId: tenant.id,
          status: { notIn: ["CANCELLED", "PENDING"] },
          createdAt: { gte: startOfDay },
        },
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: {
          tenantId: tenant.id,
          status: { notIn: ["CANCELLED", "PENDING"] },
          createdAt: { gte: startOfWeek },
        },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: {
          tenantId: tenant.id,
          status: { notIn: ["CANCELLED", "PENDING"] },
          createdAt: { gte: startOfMonth },
        },
        _sum: { total: true },
      }),
    ]);

    res.json({
      daily: daily._sum.total || 0,
      dailyCount: daily._count || 0,
      weekly: weekly._sum.total || 0,
      monthly: monthly._sum.total || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch finance summary" });
  }
});

app.get("/api/tenants/:slug/cash/current", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const currentCash = await prisma.cashRegister.findFirst({
      where: { tenantId: tenant.id, status: "OPEN" },
      orderBy: { openedAt: "desc" },
    });

    if (!currentCash) {
      return res.json(null);
    }

    const ordersSinceOpen = await prisma.order.aggregate({
      where: {
        tenantId: tenant.id,
        status: { notIn: ["CANCELLED", "PENDING"] },
        createdAt: { gte: currentCash.openedAt },
        paymentMethod: "CASH",
      },
      _sum: { total: true },
    });

    res.json({
      ...currentCash,
      expectedBalance: currentCash.openingBalance + (ordersSinceOpen._sum.total || 0),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch current cash" });
  }
});

app.post("/api/tenants/:slug/cash/open", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const openCash = await prisma.cashRegister.create({
      data: {
        tenantId: tenant.id,
        openingBalance: parseFloat(req.body.openingBalance),
        status: "OPEN",
      },
    });

    res.json(openCash);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to open cash" });
  }
});

app.post("/api/tenants/:slug/cash/close", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const currentCash = await prisma.cashRegister.findFirst({
      where: { tenantId: tenant.id, status: "OPEN" },
      orderBy: { openedAt: "desc" },
    });

    if (!currentCash) {
      return res.status(400).json({ error: "No open cash register found" });
    }

    const ordersSinceOpen = await prisma.order.aggregate({
      where: {
        tenantId: tenant.id,
        status: { notIn: ["CANCELLED", "PENDING"] },
        createdAt: { gte: currentCash.openedAt },
        paymentMethod: "CASH",
      },
      _sum: { total: true },
    });

    const expectedBalance = currentCash.openingBalance + (ordersSinceOpen._sum.total || 0);

    const closedCash = await prisma.cashRegister.update({
      where: { id: currentCash.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closingBalance: parseFloat(req.body.closingBalance),
        expectedBalance,
        notes: req.body.notes,
      },
    });

    res.json(closedCash);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to close cash" });
  }
});

app.get("/api/tenants/:slug/cash/history", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const where: any = { tenantId: tenant.id, status: "CLOSED" };
    if (from || to) {
      where.openedAt = {};
      if (from) where.openedAt.gte = new Date(from + "T00:00:00");
      if (to)   where.openedAt.lte = new Date(to   + "T23:59:59");
    }

    const history = await prisma.cashRegister.findMany({
      where,
      include: { movements: true },
      orderBy: { openedAt: "desc" },
      take: 100,
    });

    res.json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch cash history" });
  }
});

// Resumo financeiro por período (entradas automáticas via orders + movimentos manuais)
app.get("/api/tenants/:slug/cash/summary", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const dateFrom = from ? new Date(from + "T00:00:00") : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dateTo   = to   ? new Date(to   + "T23:59:59") : new Date();

    // Pedidos entregues no período
    const orders = await prisma.order.findMany({
      where: {
        tenantId: tenant.id,
        status: "DELIVERED",
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      select: { total: true, paymentMethod: true, createdAt: true, discount: true },
    });

    // Movimentos manuais (sangrias/suprimentos) no período
    const movements = await prisma.cashMovement.findMany({
      where: {
        tenantId: tenant.id,
        createdAt: { gte: dateFrom, lte: dateTo },
        type: { in: ["SANGRIA", "SUPRIMENTO"] },
      },
      select: { type: true, amount: true, description: true, createdAt: true },
    });

    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    const totalSangrias = movements.filter(m => m.type === "SANGRIA").reduce((s, m) => s + m.amount, 0);
    const totalSuprimentos = movements.filter(m => m.type === "SUPRIMENTO").reduce((s, m) => s + m.amount, 0);

    // Agrupar receita por método
    const byMethod: Record<string, number> = {};
    for (const o of orders) {
      const key = o.paymentMethod;
      byMethod[key] = (byMethod[key] || 0) + o.total;
    }

    // Receita por dia (para gráfico)
    const byDay: Record<string, number> = {};
    for (const o of orders) {
      const day = o.createdAt.toISOString().split("T")[0];
      byDay[day] = (byDay[day] || 0) + o.total;
    }

    res.json({
      totalRevenue,
      orderCount: orders.length,
      totalSangrias,
      totalSuprimentos,
      netBalance: totalRevenue + totalSuprimentos - totalSangrias,
      byMethod,
      byDay,
      movements,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch cash summary" });
  }
});

app.get("/api/tenants/:slug/customer-orders/:phone", async (req, res) => {
  const { slug, phone } = req.params;

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const orders = await prisma.order.findMany({
      where: {
        tenantId: tenant.id,
        customerPhone: phone,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch customer orders" });
  }
});

app.get("/api/tenants/:slug/inventory", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const items = await prisma.inventoryItem.findMany({
      where: { tenantId: tenant.id },
      include: { category: true },
      orderBy: { name: "asc" },
    });

    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

app.post("/api/inventory/categories", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.body.tenantId);
  if (!tenant) return;

  try {
    const category = await prisma.inventoryCategory.create({
      data: {
        name: req.body.name,
        tenantId: tenant.id,
      },
    });

    res.json(category);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create inventory category" });
  }
});

app.get("/api/tenants/:slug/inventory/categories", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const categories = await prisma.inventoryCategory.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: "asc" },
    });

    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch inventory categories" });
  }
});

app.get("/api/tenants/:slug/inventory", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const items = await prisma.inventoryItem.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: "asc" },
    });

    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch inventory items" });
  }
});

app.post("/api/inventory/items", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.body.tenantId);
  if (!tenant) return;

  const {
    name,
    code,
    brand,
    purchasePrice,
    sellingPrice,
    quantity,
    minStock,
    unit,
    weight,
    usage,
    expirationDate,
    purchaseDate,
    categoryId,
    purchaseUnit,
    purchaseQty,
    stockUnit,
  } = req.body;

  try {
    const item = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        name,
        code,
        brand,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
        sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null,
        quantity: parseFloat(quantity || 0),
        minStock: minStock ? parseFloat(minStock) : null,
        unit,
        weight,
        usage: usage || "SALE",
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        categoryId,
        purchaseUnit: purchaseUnit || null,
        purchaseQty: purchaseQty ? parseFloat(purchaseQty) : null,
        stockUnit: stockUnit || null,
        movements:
          quantity && parseFloat(quantity) > 0
            ? {
                create: {
                  type: "IN",
                  quantity: parseFloat(quantity),
                  reason: "MANUAL",
                },
              }
            : undefined,
      },
    });

    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create inventory item" });
  }
});

app.patch("/api/inventory/items/:id", requireAuth, async (req, res) => {
  const scoped = await requireTenantFromInventoryItem(req, res, req.params.id);
  if (!scoped) return;

  const {
    name,
    code,
    brand,
    purchasePrice,
    sellingPrice,
    quantity,
    minStock,
    unit,
    weight,
    usage,
    expirationDate,
    purchaseDate,
    categoryId,
    purchaseUnit,
    purchaseQty,
    stockUnit,
  } = req.body;

  try {
    const newQuantity = parseFloat(quantity || 0);
    const diff = newQuantity - scoped.item.quantity;

    const item = await prisma.inventoryItem.update({
      where: { id: scoped.item.id },
      data: {
        name,
        code,
        brand,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
        sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null,
        quantity: newQuantity,
        minStock: minStock ? parseFloat(minStock) : null,
        unit,
        weight,
        usage,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        categoryId,
        purchaseUnit: purchaseUnit ?? undefined,
        purchaseQty: purchaseQty ? parseFloat(purchaseQty) : null,
        stockUnit: stockUnit ?? undefined,
        movements:
          diff !== 0
            ? {
                create: {
                  type: diff > 0 ? "IN" : "OUT",
                  quantity: Math.abs(diff),
                  reason: "MANUAL",
                },
              }
            : undefined,
      },
    });

    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update inventory item" });
  }
});

app.delete("/api/inventory/items/:id", requireAuth, async (req, res) => {
  const scoped = await requireTenantFromInventoryItem(req, res, req.params.id);
  if (!scoped) return;

  try {
    await prisma.inventoryItem.delete({ where: { id: scoped.item.id } });
    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

app.get("/api/tenants/:slug/production/recipes", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const recipes = await prisma.productionRecipe.findMany({
      where: { tenantId: tenant.id },
      include: {
        product: {
          include: {
            inventoryItem: true,
          },
        },
      },
      orderBy: [
        { active: "desc" },
        { updatedAt: "desc" },
      ],
    });

    res.json(recipes.map(parseProductionRecipeRecord));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Falha ao buscar receitas de produção." });
  }
});

// ─────────────────────────────────────────────────────────────
// CASH MOVEMENTS (Sangria / Suprimento)
// ─────────────────────────────────────────────────────────────

app.post("/api/tenants/:slug/cash/movement", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const currentCash = await prisma.cashRegister.findFirst({
      where: { tenantId: tenant.id, status: "OPEN" },
      orderBy: { openedAt: "desc" },
    });
    if (!currentCash) return res.status(400).json({ error: "Nenhum caixa aberto." });

    const { type, amount, description, operatorName } = req.body;
    if (!type || !amount) return res.status(400).json({ error: "type e amount são obrigatórios." });
    if (!["SANGRIA", "SUPRIMENTO"].includes(type)) return res.status(400).json({ error: "Tipo inválido." });

    const movement = await prisma.cashMovement.create({
      data: {
        cashRegisterId: currentCash.id,
        tenantId: tenant.id,
        type,
        amount: parseFloat(amount),
        description,
        operatorName,
      },
    });
    res.json(movement);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Falha ao registrar movimento." });
  }
});

app.get("/api/tenants/:slug/cash/movements", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const currentCash = await prisma.cashRegister.findFirst({
      where: { tenantId: tenant.id, status: "OPEN" },
      orderBy: { openedAt: "desc" },
    });
    if (!currentCash) return res.json([]);

    const movements = await prisma.cashMovement.findMany({
      where: { cashRegisterId: currentCash.id },
      orderBy: { createdAt: "asc" },
    });
    res.json(movements);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Falha ao buscar movimentos." });
  }
});

// ─────────────────────────────────────────────────────────────
// CUSTOMERS (CRM)
// ─────────────────────────────────────────────────────────────

app.get("/api/tenants/:slug/customers", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const { search, page = "1", limit = "50" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = { tenantId: tenant.id };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { totalSpent: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({ customers, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Falha ao buscar clientes." });
  }
});

app.get("/api/tenants/:slug/customers/by-phone/:phone", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const customer = await prisma.customer.findUnique({
      where: { tenantId_phone: { tenantId: tenant.id, phone: req.params.phone } },
    });
    res.json(customer || null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Falha ao buscar cliente." });
  }
});

app.post("/api/tenants/:slug/customers", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const { name, phone, email, address, notes } = req.body;
    if (!name || !phone) return res.status(400).json({ error: "Nome e telefone são obrigatórios." });

    const customer = await prisma.customer.upsert({
      where: { tenantId_phone: { tenantId: tenant.id, phone } },
      create: { tenantId: tenant.id, name, phone, email, address, notes },
      update: { name, email, address, notes },
    });
    res.json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Falha ao salvar cliente." });
  }
});

app.patch("/api/tenants/:slug/customers/:id", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, tenantId: tenant.id } });
    if (!existing) return res.status(404).json({ error: "Cliente não encontrado." });

    const { name, phone, email, address, notes } = req.body;
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: { name, phone, email, address, notes },
    });
    res.json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Falha ao atualizar cliente." });
  }
});

app.get("/api/tenants/:slug/customers/:id/orders", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const customer = await prisma.customer.findFirst({ where: { id: req.params.id, tenantId: tenant.id } });
    if (!customer) return res.status(404).json({ error: "Cliente não encontrado." });

    const orders = await prisma.order.findMany({
      where: { tenantId: tenant.id, customerPhone: customer.phone },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Falha ao buscar pedidos do cliente." });
  }
});

// ─────────────────────────────────────────────────────────────
// FINANCIAL REPORTS
// ─────────────────────────────────────────────────────────────

app.get("/api/tenants/:slug/reports/summary", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const { from, to } = req.query as Record<string, string>;
    const dateFrom = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
    const dateTo = to ? new Date(to) : new Date(new Date().setHours(23, 59, 59, 999));

    const orders = await prisma.order.findMany({
      where: {
        tenantId: tenant.id,
        status: { notIn: ["CANCELLED"] },
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      include: { items: { include: { product: true } } },
    });

    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    const totalOrders = orders.length;
    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Revenue by payment method
    const byPaymentMethod: Record<string, { count: number; total: number }> = {};
    for (const order of orders) {
      const pm = order.paymentMethod;
      if (!byPaymentMethod[pm]) byPaymentMethod[pm] = { count: 0, total: 0 };
      byPaymentMethod[pm].count++;
      byPaymentMethod[pm].total += order.total;
    }

    // Revenue by order type
    const byOrderType: Record<string, { count: number; total: number }> = {};
    for (const order of orders) {
      const ot = order.orderType;
      if (!byOrderType[ot]) byOrderType[ot] = { count: 0, total: 0 };
      byOrderType[ot].count++;
      byOrderType[ot].total += order.total;
    }

    // Top products
    const productSales: Record<string, { name: string; qty: number; total: number }> = {};
    for (const order of orders) {
      for (const item of order.items) {
        const pid = item.productId;
        if (!productSales[pid]) productSales[pid] = { name: item.product?.name || pid, qty: 0, total: 0 };
        productSales[pid].qty += item.quantity;
        productSales[pid].total += item.price * item.quantity;
      }
    }
    const topProducts = Object.entries(productSales)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Hourly distribution
    const hourlyMap: Record<number, number> = {};
    for (const order of orders) {
      const h = new Date(order.createdAt).getHours();
      hourlyMap[h] = (hourlyMap[h] || 0) + order.total;
    }
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: hourlyMap[h] || 0 }));

    res.json({ totalRevenue, totalOrders, averageTicket, byPaymentMethod, byOrderType, topProducts, hourly, dateFrom, dateTo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Falha ao gerar relatório." });
  }
});

app.get("/api/tenants/:slug/reports/daily", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const days = parseInt((req.query.days as string) || "30");
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: { tenantId: tenant.id, status: { notIn: ["CANCELLED"] }, createdAt: { gte: from } },
      select: { createdAt: true, total: true },
    });

    const dailyMap: Record<string, { date: string; total: number; count: number }> = {};
    for (const order of orders) {
      const d = order.createdAt.toISOString().slice(0, 10);
      if (!dailyMap[d]) dailyMap[d] = { date: d, total: 0, count: 0 };
      dailyMap[d].total += order.total;
      dailyMap[d].count++;
    }

    const result = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Falha ao buscar dados diários." });
  }
});

// ─────────────────────────────────────────────────────────────
// PDV: create order with discount + customer sync
// ─────────────────────────────────────────────────────────────

app.post("/api/tenants/:slug/pdv/order", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  try {
    const {
      customerName,
      customerPhone,
      orderType,
      tableId,
      paymentMethod,
      paymentMetadata,
      items,
      discount,
      discountType,
      notes,
      operatorName,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Nenhum item no pedido." });
    }

    // Fetch products and calculate totals
    const productIds = items.map((i: any) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const orderItems: any[] = [];
    for (const item of items) {
      const product = productMap[item.productId];
      if (!product) return res.status(400).json({ error: `Produto ${item.productId} não encontrado.` });
      const price = item.price ?? product.price;
      subtotal += price * item.quantity;
      orderItems.push({ productId: item.productId, quantity: item.quantity, price, notes: item.notes });
    }

    let discountAmount = 0;
    if (discount && parseFloat(discount) > 0) {
      discountAmount = discountType === "PERCENT" ? subtotal * (parseFloat(discount) / 100) : parseFloat(discount);
    }
    const total = Math.max(0, subtotal - discountAmount);

    // Upsert customer if phone provided
    let customerId: string | undefined;
    if (customerPhone && customerPhone !== "00000000000" && customerName) {
      const customer = await prisma.customer.upsert({
        where: { tenantId_phone: { tenantId: tenant.id, phone: customerPhone } },
        create: { tenantId: tenant.id, name: customerName, phone: customerPhone, totalSpent: total, ordersCount: 1, lastOrderAt: new Date() },
        update: { totalSpent: { increment: total }, ordersCount: { increment: 1 }, lastOrderAt: new Date() },
      });
      customerId = customer.id;
    }

    const order = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        customerName: customerName || "Venda PDV",
        customerPhone: customerPhone || "00000000000",
        orderType: orderType || "TAKEAWAY",
        tableId: tableId || null,
        paymentMethod: paymentMethod || "CASH",
        paymentDetail: paymentMetadata ? JSON.stringify(paymentMetadata) : null,
        discount: discountAmount,
        discountType: discountType || null,
        notes: notes || null,
        operatorName: operatorName || null,
        customerId: customerId || null,
        status: "DELIVERED",
        total,
        items: { create: orderItems },
      },
      include: { items: { include: { product: true } } },
    });

    // Register cash movement for the payment
    const currentCash = await prisma.cashRegister.findFirst({
      where: { tenantId: tenant.id, status: "OPEN" },
      orderBy: { openedAt: "desc" },
    });
    if (currentCash) {
      const pmType = `PAYMENT_${paymentMethod}`;
      await prisma.cashMovement.create({
        data: {
          cashRegisterId: currentCash.id,
          tenantId: tenant.id,
          type: pmType,
          amount: total,
          description: `Venda PDV #${order.id.slice(-6).toUpperCase()}`,
          orderId: order.id,
          operatorName: operatorName || null,
        },
      });
    }

    // Deduct inventory
    for (const item of order.items) {
      if (item.product?.inventoryItemId) {
        await prisma.inventoryItem.update({
          where: { id: item.product.inventoryItemId },
          data: {
            quantity: { decrement: item.quantity },
            movements: { create: { type: "OUT", quantity: item.quantity, reason: "SALE", orderId: order.id } },
          },
        }).catch(() => {}); // non-blocking
      }
    }

    io.to(`tenant-${tenant.id}`).emit("order:new", order);
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Falha ao criar pedido PDV." });
  }
});

// ── STONE / MAQUININHA ──────────────────────────────────────────────────────
// Sends a charge to the Stone (Pagar.me) POS terminal.
// The terminal displays the payment for the customer; result comes via webhook.
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/tenants/:slug/stone/charge", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  let stoneCfg: { enabled: boolean; secretKey: string; stonecode: string } | null = null;
  try {
    stoneCfg = tenant.stoneConfig ? JSON.parse(tenant.stoneConfig as string) : null;
  } catch { /* ignore */ }

  if (!stoneCfg?.enabled || !stoneCfg.secretKey || !stoneCfg.stonecode) {
    return res.status(400).json({ error: "Stone não configurado para este estabelecimento." });
  }

  const { orderId, amount, paymentType } = req.body;
  // paymentType: "credit" | "debit" | "pix"

  if (!orderId || !amount || !paymentType) {
    return res.status(400).json({ error: "orderId, amount e paymentType são obrigatórios." });
  }

  try {
    const order = await prisma.order.findFirst({ where: { id: orderId, tenantId: tenant.id } });
    if (!order) return res.status(404).json({ error: "Pedido não encontrado." });

    const authToken = Buffer.from(`${stoneCfg.secretKey}:`).toString("base64");
    const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

    const pagarmePayload: any = {
      items: [
        {
          amount: Math.round(amount * 100), // centavos
          description: `Pedido ${orderId.slice(-6).toUpperCase()}`,
          quantity: 1,
          code: orderId.slice(-8),
        },
      ],
      customer: {
        name: order.customerName || "Cliente",
        type: "individual",
        document: "00000000000",
        document_type: "CPF",
        phones: { home_phone: { country_code: "55", area_code: "11", number: "000000000" } },
      },
      payments: [
        {
          payment_method: paymentType === "pix" ? "pix" : "credit_card",
          ...(paymentType !== "pix" && {
            credit_card: {
              installments: 1,
              statement_descriptor: (tenant.name || "Loja").slice(0, 22),
            },
          }),
        },
      ],
      closed: false,
      poi_payment_settings: {
        stonecode: stoneCfg.stonecode,
        payment_origin: "pos",
      },
      metadata: { order_id: orderId, tenant_slug: tenant.slug },
    };

    const response = await fetch("https://api.pagar.me/core/v5/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authToken}`,
      },
      body: JSON.stringify(pagarmePayload),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      console.error("Stone charge error:", data);
      return res.status(502).json({ error: data.message || "Erro ao criar cobrança na Stone." });
    }

    // Store Stone charge ID on the order
    await prisma.order.update({
      where: { id: orderId },
      data: { stoneChargeId: data.id },
    });

    res.json({ chargeId: data.id, status: data.status });
  } catch (error) {
    console.error("Stone charge error:", error);
    res.status(500).json({ error: "Erro ao comunicar com a Stone." });
  }
});

// Webhook from Stone terminal — confirms payment result
app.post("/api/tenants/:slug/stone/webhook", async (req, res) => {
  const tenant = await prisma.tenant.findUnique({ where: { slug: req.params.slug } });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  try {
    const event = req.body;
    const chargeId: string = event?.data?.id || event?.id;
    const status: string = event?.data?.status || event?.status;

    if (!chargeId) return res.status(400).json({ error: "Missing charge id" });

    // Find matching order
    const order = await prisma.order.findFirst({
      where: { stoneChargeId: chargeId, tenantId: tenant.id },
      include: { items: { include: { product: true } } },
    });
    if (!order) return res.status(200).json({ received: true }); // idempotent

    if (status === "paid") {
      // Mark order delivered and register cash movement
      await prisma.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });

      const currentCash = await prisma.cashRegister.findFirst({
        where: { tenantId: tenant.id, status: "OPEN" },
        orderBy: { openedAt: "desc" },
      });
      if (currentCash) {
        const chargeAmount = event?.data?.amount ? event.data.amount / 100 : order.total;
        await prisma.cashMovement.create({
          data: {
            cashRegisterId: currentCash.id,
            tenantId: tenant.id,
            type: "PAYMENT_STONE",
            amount: chargeAmount,
            description: `Stone Maquininha #${order.id.slice(-6).toUpperCase()}`,
            orderId: order.id,
          },
        });
      }

      io.to(`tenant-${tenant.id}`).emit("stone:paid", { orderId: order.id, chargeId });
    } else if (status === "failed" || status === "canceled") {
      io.to(`tenant-${tenant.id}`).emit("stone:failed", { orderId: order.id, chargeId, status });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stone webhook error:", error);
    res.status(500).json({ error: "Webhook processing error" });
  }
});

// Poll Stone charge status (fallback when webhook is not available)
app.get("/api/tenants/:slug/stone/charge/:chargeId", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;

  let stoneCfg: { enabled: boolean; secretKey: string; stonecode: string } | null = null;
  try {
    stoneCfg = tenant.stoneConfig ? JSON.parse(tenant.stoneConfig as string) : null;
  } catch { /* ignore */ }

  if (!stoneCfg?.secretKey) return res.status(400).json({ error: "Stone não configurado." });

  try {
    const authToken = Buffer.from(`${stoneCfg.secretKey}:`).toString("base64");
    const response = await fetch(`https://api.pagar.me/core/v5/orders/${req.params.chargeId}`, {
      headers: { Authorization: `Basic ${authToken}` },
    });
    const data = await response.json() as any;
    if (!response.ok) return res.status(502).json({ error: data.message || "Erro ao consultar Stone." });

    // If paid and not yet registered, process it
    if (data.status === "paid") {
      const order = await prisma.order.findFirst({
        where: { stoneChargeId: req.params.chargeId, tenantId: tenant.id },
      });
      if (order && order.status !== "DELIVERED") {
        await prisma.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
        const currentCash = await prisma.cashRegister.findFirst({
          where: { tenantId: tenant.id, status: "OPEN" },
          orderBy: { openedAt: "desc" },
        });
        if (currentCash) {
          await prisma.cashMovement.create({
            data: {
              cashRegisterId: currentCash.id,
              tenantId: tenant.id,
              type: "PAYMENT_STONE",
              amount: data.amount ? data.amount / 100 : order.total,
              description: `Stone Maquininha #${order.id.slice(-6).toUpperCase()}`,
              orderId: order.id,
            },
          }).catch(() => {});
        }
        io.to(`tenant-${tenant.id}`).emit("stone:paid", { orderId: order.id, chargeId: req.params.chargeId });
      }
    }

    res.json({ status: data.status, chargeId: req.params.chargeId });
  } catch (error) {
    console.error("Stone poll error:", error);
    res.status(500).json({ error: "Erro ao consultar Stone." });
  }
});

// ── PROMOTIONS ──────────────────────────────────────────────────────────────

app.get("/api/tenants/:slug/promotions", async (req, res) => {
  const { slug } = req.params;
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    const now = new Date();
    const promotions = await prisma.promotion.findMany({
      where: {
        tenantId: tenant.id,
        active: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { sortOrder: "asc" },
      include: { product: { select: { id: true, name: true, price: true, imageUrl: true } } },
    });
    res.json(promotions);
  } catch (e) {
    res.status(500).json({ error: "Erro ao buscar promoções" });
  }
});

app.get("/api/admin/:tenantId/promotions", requireAuth, async (req, res) => {
  const { tenantId } = req.params;
  try {
    const promotions = await prisma.promotion.findMany({
      where: { tenantId },
      orderBy: { sortOrder: "asc" },
      include: { product: { select: { id: true, name: true, price: true, imageUrl: true } } },
    });
    res.json(promotions);
  } catch (e) {
    res.status(500).json({ error: "Erro ao buscar promoções" });
  }
});

app.post("/api/admin/:tenantId/promotions", requireAuth, async (req, res) => {
  const { tenantId } = req.params;
  const { title, description, imageUrl, linkProductId, active, startsAt, endsAt, sortOrder } = req.body;
  try {
    const promo = await prisma.promotion.create({
      data: {
        tenantId,
        title,
        description: description || null,
        imageUrl: imageUrl || null,
        linkProductId: linkProductId || null,
        active: active !== false,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        sortOrder: sortOrder || 0,
      },
    });
    res.json(promo);
  } catch (e) {
    res.status(500).json({ error: "Erro ao criar promoção" });
  }
});

app.patch("/api/admin/promotions/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, description, imageUrl, linkProductId, active, startsAt, endsAt, sortOrder } = req.body;
  try {
    const promo = await prisma.promotion.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(linkProductId !== undefined && { linkProductId: linkProductId || null }),
        ...(active !== undefined && { active }),
        ...(startsAt !== undefined && { startsAt: startsAt ? new Date(startsAt) : null }),
        ...(endsAt !== undefined && { endsAt: endsAt ? new Date(endsAt) : null }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });
    res.json(promo);
  } catch (e) {
    res.status(500).json({ error: "Erro ao atualizar promoção" });
  }
});

app.delete("/api/admin/promotions/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.promotion.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Erro ao deletar promoção" });
  }
});

// ── Product Bundles (Combos) ──────────────────────────────────────────────────

// Leitura pública: todos os combos ativos do tenant
app.get("/api/tenants/:slug/bundles", async (req, res) => {
  const { slug } = req.params;
  try {
    const tenant = await (prisma as any).tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    const rows = await (prisma as any).$queryRawUnsafe(
      `SELECT * FROM product_bundles WHERE tenant_id = ? AND available = 1 ORDER BY sort_order ASC, created_at ASC`,
      tenant.id
    ) as any[];
    const bundles = rows.map((r: any) => ({
      id: r.id, tenantId: r.tenant_id, name: r.name,
      description: r.description, imageUrl: r.image_url,
      price: r.price, available: Boolean(r.available),
      sortOrder: r.sort_order,
      steps: (() => { try { return JSON.parse(r.steps); } catch { return []; } })(),
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
    res.json(bundles);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao buscar combos" });
  }
});

// Admin: listar todos (incluindo indisponíveis)
app.get("/api/admin/:slug/bundles", requireAuth, async (req, res) => {
  const { slug } = req.params;
  try {
    const tenant = await (prisma as any).tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    const rows = await (prisma as any).$queryRawUnsafe(
      `SELECT * FROM product_bundles WHERE tenant_id = ? ORDER BY sort_order ASC, created_at ASC`,
      tenant.id
    ) as any[];
    const bundles = rows.map((r: any) => ({
      id: r.id, tenantId: r.tenant_id, name: r.name,
      description: r.description, imageUrl: r.image_url,
      price: r.price, available: Boolean(r.available),
      sortOrder: r.sort_order,
      steps: (() => { try { return JSON.parse(r.steps); } catch { return []; } })(),
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
    res.json(bundles);
  } catch (e) {
    res.status(500).json({ error: "Erro ao buscar combos" });
  }
});

// Admin: criar combo
app.post("/api/admin/:slug/bundles", requireAuth, async (req, res) => {
  const { slug } = req.params;
  const { name, description, imageUrl, price, available, sortOrder, steps } = req.body;
  try {
    const tenant = await (prisma as any).tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    const id = require("crypto").randomBytes(12).toString("base64url");
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO product_bundles (id, tenant_id, name, description, image_url, price, available, sort_order, steps) VALUES (?,?,?,?,?,?,?,?,?)`,
      id, tenant.id, name, description ?? null, imageUrl ?? null,
      price ?? 0, available !== false ? 1 : 0, sortOrder ?? 0,
      JSON.stringify(steps ?? [])
    );
    res.json({ id, success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao criar combo" });
  }
});

// Admin: atualizar combo
app.patch("/api/admin/bundles/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, description, imageUrl, price, available, sortOrder, steps } = req.body;
  try {
    await (prisma as any).$executeRawUnsafe(
      `UPDATE product_bundles SET name=?, description=?, image_url=?, price=?, available=?, sort_order=?, steps=?, updated_at=NOW() WHERE id=?`,
      name, description ?? null, imageUrl ?? null,
      price ?? 0, available !== false ? 1 : 0, sortOrder ?? 0,
      JSON.stringify(steps ?? []), id
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Erro ao atualizar combo" });
  }
});

// Admin: deletar combo
app.delete("/api/admin/bundles/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await (prisma as any).$executeRawUnsafe(`DELETE FROM product_bundles WHERE id=?`, id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Erro ao deletar combo" });
  }
});

// ─── Suppliers ────────────────────────────────────────────────────────────────

app.get("/api/tenants/:slug/suppliers", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;
  try {
    const suppliers = await (prisma as any).supplier.findMany({
      where: { tenantId: tenant.id },
      include: {
        inventoryItems: { include: { inventoryItem: true } },
        _count: { select: { catalogItems: true } },
      },
      orderBy: [{ isFavorite: "desc" }, { name: "asc" }],
    });
    res.json(suppliers);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.post("/api/tenants/:slug/suppliers", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;
  try {
    const { inventoryItemIds = [], ...data } = req.body;
    if (!data.name?.trim()) return res.status(400).json({ error: "Nome é obrigatório." });
    const supplier = await (prisma as any).supplier.create({
      data: {
        ...data,
        tenantId: tenant.id,
        inventoryItems: inventoryItemIds.length
          ? { create: inventoryItemIds.map((id: string) => ({ inventoryItemId: id })) }
          : undefined,
      },
      include: { inventoryItems: { include: { inventoryItem: true } } },
    });
    res.json(supplier);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.put("/api/tenants/:slug/suppliers/:id", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;
  try {
    const existing = await (prisma as any).supplier.findFirst({ where: { id: req.params.id, tenantId: tenant.id } });
    if (!existing) return res.status(404).json({ error: "Fornecedor não encontrado." });
    const { inventoryItemIds = [], id: _id, tenantId: _tid, createdAt: _c, updatedAt: _u, inventoryItems: _inv, ...data } = req.body;
    // Replace inventory item links
    await (prisma as any).supplierInventoryItem.deleteMany({ where: { supplierId: req.params.id } });
    const supplier = await (prisma as any).supplier.update({
      where: { id: req.params.id },
      data: {
        ...data,
        inventoryItems: inventoryItemIds.length
          ? { create: inventoryItemIds.map((iid: string) => ({ inventoryItemId: iid })) }
          : undefined,
      },
      include: { inventoryItems: { include: { inventoryItem: true } } },
    });
    res.json(supplier);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.delete("/api/tenants/:slug/suppliers/:id", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;
  try {
    const existing = await (prisma as any).supplier.findFirst({ where: { id: req.params.id, tenantId: tenant.id } });
    if (!existing) return res.status(404).json({ error: "Fornecedor não encontrado." });
    await (prisma as any).supplier.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// ─── Supplier Catalog Items ───────────────────────────────────────────────────

app.get("/api/tenants/:slug/suppliers/:supplierId/catalog", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;
  try {
    const supplier = await (prisma as any).supplier.findFirst({ where: { id: req.params.supplierId, tenantId: tenant.id } });
    if (!supplier) return res.status(404).json({ error: "Fornecedor não encontrado." });
    const items = await (prisma as any).supplierCatalogItem.findMany({
      where: { supplierId: req.params.supplierId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.post("/api/tenants/:slug/suppliers/:supplierId/catalog", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;
  try {
    const supplier = await (prisma as any).supplier.findFirst({ where: { id: req.params.supplierId, tenantId: tenant.id } });
    if (!supplier) return res.status(404).json({ error: "Fornecedor não encontrado." });
    const { name, unit, price, notes, sortOrder } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Nome é obrigatório." });
    const item = await (prisma as any).supplierCatalogItem.create({
      data: {
        supplierId: req.params.supplierId,
        name: name.trim(),
        unit: unit ?? null,
        price: price != null ? Number(price) : null,
        notes: notes ?? null,
        sortOrder: sortOrder ?? 0,
      },
    });
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.put("/api/tenants/:slug/suppliers/:supplierId/catalog/:itemId", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;
  try {
    const supplier = await (prisma as any).supplier.findFirst({ where: { id: req.params.supplierId, tenantId: tenant.id } });
    if (!supplier) return res.status(404).json({ error: "Fornecedor não encontrado." });
    const { name, unit, price, notes, sortOrder } = req.body;
    const item = await (prisma as any).supplierCatalogItem.update({
      where: { id: req.params.itemId },
      data: {
        name: name?.trim(),
        unit: unit ?? null,
        price: price != null ? Number(price) : null,
        notes: notes ?? null,
        sortOrder: sortOrder ?? 0,
      },
    });
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.delete("/api/tenants/:slug/suppliers/:supplierId/catalog/:itemId", requireAuth, async (req, res) => {
  const tenant = await requireTenantBySlug(req, res, req.params.slug);
  if (!tenant) return;
  try {
    await (prisma as any).supplierCatalogItem.delete({ where: { id: req.params.itemId } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));

  app.get("*", async (req, res) => {
    const parts = req.path.split("/").filter(Boolean);
    const slug = parts[0];
    
    // Default values
    let title = "Cardápio Digital";
    let description = "Peça agora pelo nosso cardápio digital!";
    let image = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800";

    if (slug && !["api", "login", "register", "admin", "assets", "uploads"].includes(slug)) {
      try {
        const tenant = await prisma.tenant.findUnique({ where: { slug } });
        if (tenant) {
          title = `${tenant.name} | Cardápio Digital`;
          description = tenant.description || "Confira nosso cardápio e faça seu pedido online!";
          image = tenant.logoUrl || image;
        }
      } catch (e) {
        console.error("SEO Error:", e);
      }
    }

    try {
      const indexHtml = fs.readFileSync(path.join(distPath, "index.html"), "utf-8");
      const injectedHtml = indexHtml
        .replace(/{{TITLE}}/g, title)
        .replace(/{{DESCRIPTION}}/g, description)
        .replace(/{{IMAGE}}/g, image);
      res.send(injectedHtml);
    } catch (e) {
      res.sendFile(path.join(distPath, "index.html"));
    }
  });
}

// ─── NFC-e Fiscal Endpoints ───────────────────────────────────────────────────

// POST /api/owner/tenants/:tenantId/nfce/emit — emite NFC-e para um pedido
app.post("/api/owner/tenants/:tenantId/nfce/emit", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.tenantId);
  if (!tenant) return;

  const { orderId } = req.body as { orderId: string };
  if (!orderId) return res.status(400).json({ error: "orderId é obrigatório." });

  try {
    if (!tenant.fiscalConfig) return res.status(400).json({ error: "Configuração fiscal não encontrada." });
    const fiscal = JSON.parse(tenant.fiscalConfig as string) as import("./src/types.js").FiscalConfig;
    if (!fiscal.enabled) return res.status(400).json({ error: "Módulo fiscal desativado." });

    // Busca pedido com itens e produtos
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId: tenant.id },
      include: { items: { include: { product: true } } },
    });
    if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
    if (order.nfceStatus === "AUTHORIZED") return res.status(409).json({ error: "NFC-e já autorizada para este pedido." });

    // Determina próximo número e incrementa
    const numero = fiscal.proximoNumero || 1;

    // Monta items fiscais — exige NCM/CFOP no produto
    const { emitirNfce } = await import("./src/lib/fiscal.js");
    const fiscalItems = order.items.map((item: any) => ({
      productName: item.product?.name ?? "Produto",
      ncm: item.product?.ncm ?? "00000000",
      cfop: item.product?.cfop ?? "5102",
      csosn: item.product?.csosn ?? "400",
      unitCom: item.product?.unitCom ?? "UN",
      origem: item.product?.origem ?? 0,
      aliqIcms: item.product?.aliqIcms ?? 0,
      quantity: item.quantity,
      unitPrice: item.price,
    }));

    const result = await emitirNfce(tenant.id, fiscal, {
      numero,
      serie: fiscal.serie || 1,
      items: fiscalItems,
      total: order.total,
      paymentMethod: order.paymentMethod,
      customerName: order.customerName || undefined,
    });

    // Atualiza pedido com resultado
    await prisma.order.update({
      where: { id: orderId },
      data: {
        nfceStatus: result.status,
        nfceKey: result.chave ?? null,
        nfceProtocol: result.protocolo ?? null,
        nfceNumber: result.numero ?? null,
        nfceXml: result.xmlAutorizado ? JSON.stringify({ xml: result.xmlAutorizado }) : null,
      },
    });

    // Se autorizada, avança o número sequencial no fiscal_config
    if (result.status === "AUTHORIZED") {
      const updatedFiscal = { ...fiscal, proximoNumero: numero + 1 };
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { fiscalConfig: JSON.stringify(updatedFiscal) },
      });
    }

    res.json(result);
  } catch (err: any) {
    console.error("[NFC-e] Erro ao emitir:", err);
    res.status(500).json({ error: err?.message ?? "Erro ao emitir NFC-e." });
  }
});

// POST /api/owner/tenants/:tenantId/nfce/cancel — cancela NFC-e
app.post("/api/owner/tenants/:tenantId/nfce/cancel", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.tenantId);
  if (!tenant) return;

  const { orderId, justificativa } = req.body as { orderId: string; justificativa: string };
  if (!orderId) return res.status(400).json({ error: "orderId é obrigatório." });
  if (!justificativa || justificativa.length < 15) return res.status(400).json({ error: "Justificativa deve ter ao menos 15 caracteres." });

  try {
    const order = await prisma.order.findFirst({ where: { id: orderId, tenantId: tenant.id } });
    if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
    if (order.nfceStatus !== "AUTHORIZED") return res.status(400).json({ error: "Apenas NFC-e autorizada pode ser cancelada." });
    if (!order.nfceKey || !order.nfceProtocol) return res.status(400).json({ error: "Chave ou protocolo da NFC-e não encontrados." });

    const fiscal = JSON.parse(tenant.fiscalConfig as string) as import("./src/types.js").FiscalConfig;
    const { cancelarNfce } = await import("./src/lib/fiscal.js");

    const result = await cancelarNfce(tenant.id, fiscal, order.nfceKey, order.nfceProtocol, justificativa);

    if (result.success) {
      await prisma.order.update({
        where: { id: orderId },
        data: { nfceStatus: "CANCELLED" },
      });
    }

    res.json(result);
  } catch (err: any) {
    console.error("[NFC-e] Erro ao cancelar:", err);
    res.status(500).json({ error: err?.message ?? "Erro ao cancelar NFC-e." });
  }
});

// GET /api/owner/tenants/:tenantId/nfce/status/:orderId — status da NFC-e de um pedido
app.get("/api/owner/tenants/:tenantId/nfce/status/:orderId", requireAuth, async (req, res) => {
  const tenant = await requireTenantById(req, res, req.params.tenantId);
  if (!tenant) return;

  const order = await prisma.order.findFirst({
    where: { id: req.params.orderId, tenantId: tenant.id },
    select: { nfceStatus: true, nfceKey: true, nfceProtocol: true, nfceNumber: true },
  });
  if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
  res.json(order);
});

// PATCH /api/owner/products/:productId/fiscal — salva dados fiscais de um produto
app.patch("/api/owner/products/:productId/fiscal", requireAuth, async (req, res) => {
  const { productId } = req.params;
  const { ncm, cfop, csosn, unitCom, origem, aliqIcms } = req.body;
  try {
    // Verifica se o produto pertence a tenant do usuário
    const authReq = req as AuthenticatedRequest;
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { tenantId: true } });
    if (!product) return res.status(404).json({ error: "Produto não encontrado." });
    const membership = await prisma.tenantMembership.findFirst({
      where: { tenantId: product.tenantId, accountId: authReq.account.id },
    });
    if (!membership) return res.status(403).json({ error: "Sem permissão." });

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(ncm !== undefined && { ncm: ncm || null }),
        ...(cfop !== undefined && { cfop: cfop || null }),
        ...(csosn !== undefined && { csosn: csosn || null }),
        ...(unitCom !== undefined && { unitCom: unitCom || "UN" }),
        ...(origem !== undefined && { origem: Number(origem) }),
        ...(aliqIcms !== undefined && { aliqIcms: Number(aliqIcms) }),
      },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

await restoreAllSessions().catch((error) => {
  console.warn("[Baileys] Falha ao restaurar sessões:", error);
});

const PORT = Number(process.env.PORT) || 3012;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
