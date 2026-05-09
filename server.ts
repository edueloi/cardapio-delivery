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

  const tenant = await getAuthorizedTenantById(account.id, tenantId);
  if (!tenant) {
    res.status(403).json({ error: "Você não tem acesso a este estabelecimento." });
    return null;
  }

  return tenant;
}

async function requireTenantBySlug(req: express.Request, res: express.Response, slug: string) {
  const account = currentAccount(req);
  if (!account) {
    res.status(401).json({ error: "Login obrigatório." });
    return null;
  }

  const tenant = await getAuthorizedTenantBySlug(account.id, slug);
  if (!tenant) {
    res.status(403).json({ error: "Você não tem acesso a este estabelecimento." });
    return null;
  }

  return tenant;
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
      account: { id: account.id, name: account.name, email: account.email },
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
      account: { id: account.id, name: account.name, email: account.email },
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

  const { name, description, address, whatsapp, logoUrl, isOpen, businessHours, deliveryConfig, paymentMethods } = req.body;
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
      },
    });

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

    // Filter out products with zero stock
    const filteredCategories = tenant.categories.map(cat => ({
      ...cat,
      products: cat.products.filter(p => {
        if (p.inventoryItem && p.inventoryItem.quantity <= 0) return false;
        return true;
      })
    })).filter(cat => cat.products.length > 0);

    res.json({ ...tenant, categories: filteredCategories });
  } catch (error) {
    console.error("Error fetching tenant:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
    };

    if (config.mode === "free") return res.json({ fee: 0, label: "Grátis" });
    if (config.mode === "fixed") return res.json({ fee: config.fixedFee ?? 0, label: `R$ ${(config.fixedFee ?? 0).toFixed(2).replace(".", ",")}` });

    if (config.mode === "zones" && cep) {
      const cleanCep = cep.replace(/\D/g, "");
      const zone = config.zones?.find((z) =>
        z.ceps.some((prefix) => cleanCep.startsWith(prefix.replace(/\D/g, "")))
      );
      if (zone) return res.json({ fee: zone.fee, label: zone.fee === 0 ? "Grátis" : `R$ ${zone.fee.toFixed(2).replace(".", ",")}`, zone: zone.label });
      if (config.allowUnlisted === false) return res.json({ fee: null, label: "Fora da área de entrega", blocked: true });
      const fallback = config.defaultFee ?? 0;
      return res.json({ fee: fallback, label: fallback === 0 ? "Grátis" : `R$ ${fallback.toFixed(2).replace(".", ",")}`, zone: "Outros" });
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

  res.json(completeTenant);
});

app.post("/api/orders", async (req, res) => {
  console.log("Incoming Order Body:", JSON.stringify(req.body, null, 2));
  const { customerName, customerPhone, address, items, tenantId, orderType, paymentMethod, paymentDetail, tableId } = req.body;

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
        let inventoryItemId = item.productVariantId
          ? (await prisma.productVariant.findUnique({ where: { id: item.productVariantId } }))?.inventoryItemId
          : item.product.inventoryItemId;

        if (!inventoryItemId) continue;

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
  const { name, description, price, imageUrl, categoryId, tenantId, variants, inventoryItemId, pdvOnly } = req.body;
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

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

app.patch("/api/products/:id", requireAuth, async (req, res) => {
  const scoped = await requireTenantFromProduct(req, res, req.params.id);
  if (!scoped) return;

  const { name, description, price, imageUrl, variants, inventoryItemId, available, autoDisableWhenOutOfStock, pdvOnly } = req.body;

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

    res.json(product);
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
    const history = await prisma.cashRegister.findMany({
      where: { tenantId: tenant.id, status: "CLOSED" },
      orderBy: { openedAt: "desc" },
      take: 20,
    });

    res.json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch cash history" });
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

await restoreAllSessions().catch((error) => {
  console.warn("[Baileys] Falha ao restaurar sessões:", error);
});

const PORT = Number(process.env.PORT) || 3012;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
