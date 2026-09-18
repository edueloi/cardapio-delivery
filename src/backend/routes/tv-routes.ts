import { randomBytes } from "crypto";
import type { Express, Request, RequestHandler, Response } from "express";

export interface RegisterTvRoutesOptions {
  app: Express;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any;
  requireAuth: RequestHandler;
  requireTenantBySlug: (
    req: Request,
    res: Response,
    slug: string,
    tabId?: string | string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any | null>;
}

export function registerTvRoutes({
  app,
  prisma,
  requireAuth,
  requireTenantBySlug,
}: RegisterTvRoutesOptions) {
  // ── App de TV (Android TV / Fire Stick) — Painel de Pedidos ──────────────────
  // Fluxo tipo Netflix: o app gera um deviceToken próprio na primeira abertura
  // (salvo localmente, nunca expira) e pede um código de 6 dígitos pra mostrar na
  // tela. O dono digita esse código em Configurações > TVs pra vincular o aparelho
  // a um tenant. A partir daí, o app consulta /api/tv/status com seu deviceToken
  // pra saber qual slug carregar em /:slug/display (rota pública, já existe e não
  // exige login — o "pareamento" só serve pra descobrir o slug certo e permitir
  // desvincular/gerenciar os aparelhos, não é uma sessão autenticada de verdade).
  const TV_PAIRING_CODE_TTL_MINUTES = 15;

  function generateTvPairingCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  // Chamado uma única vez, na primeira abertura do app (sem deviceToken salvo).
  app.post("/api/tv/register", async (req, res) => {
    try {
      const deviceToken = randomBytes(24).toString("hex");
      const device = await prisma.tvDevice.create({
        data: { deviceToken },
      });
      res.json({ deviceToken: device.deviceToken });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to register TV device" });
    }
  });

  // App pede (ou renova, se expirado) o código de 6 dígitos pra mostrar na tela.
  app.post("/api/tv/pairing-code", async (req, res) => {
    const { deviceToken } = req.body;
    if (!deviceToken) return res.status(400).json({ error: "deviceToken é obrigatório." });

    try {
      const device = await prisma.tvDevice.findUnique({ where: { deviceToken } });
      if (!device) return res.status(404).json({ error: "Dispositivo não encontrado." });

      if (device.tenantId) {
        return res.json({ paired: true });
      }

      let code = device.pairingCode;
      const stillValid = code && device.pairingCodeExpiresAt && device.pairingCodeExpiresAt > new Date();
      if (!stillValid) {
        code = generateTvPairingCode();
        await prisma.tvDevice.update({
          where: { id: device.id },
          data: {
            pairingCode: code,
            pairingCodeExpiresAt: new Date(Date.now() + TV_PAIRING_CODE_TTL_MINUTES * 60 * 1000),
          },
        });
      }

      res.json({ paired: false, pairingCode: code, expiresInMinutes: TV_PAIRING_CODE_TTL_MINUTES });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to generate pairing code" });
    }
  });

  // Polling do app: já foi vinculado a um estabelecimento? Também serve de heartbeat.
  app.get("/api/tv/status", async (req, res) => {
    const deviceToken = req.query.deviceToken as string;
    if (!deviceToken) return res.status(400).json({ error: "deviceToken é obrigatório." });

    try {
      const device = await prisma.tvDevice.findUnique({
        where: { deviceToken },
        include: { tenant: { select: { slug: true, name: true } } },
      });
      if (!device) return res.status(404).json({ error: "Dispositivo não encontrado." });

      await prisma.tvDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      });

      if (device.tenant) {
        return res.json({ paired: true, slug: device.tenant.slug, tenantName: device.tenant.name });
      }
      res.json({ paired: false });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to check TV status" });
    }
  });

  // Dono vincula um aparelho digitando o código de 6 dígitos que apareceu na TV.
  app.post("/api/tenants/:slug/tv-devices/pair", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "profile");
    if (!tenant) return;

    const code = String(req.body?.pairingCode || "").trim();
    if (!code) return res.status(400).json({ error: "Informe o código exibido na TV." });

    try {
      const device = await prisma.tvDevice.findFirst({
        where: { pairingCode: code, tenantId: null },
      });
      if (!device || !device.pairingCodeExpiresAt || device.pairingCodeExpiresAt < new Date()) {
        return res.status(404).json({ error: "Código inválido ou expirado. Gere um novo na TV." });
      }

      const updated = await prisma.tvDevice.update({
        where: { id: device.id },
        data: {
          tenantId: tenant.id,
          label: String(req.body?.label || "").trim() || null,
          pairingCode: null,
          pairingCodeExpiresAt: null,
        },
      });
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to pair TV device" });
    }
  });

  app.get("/api/tenants/:slug/tv-devices", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "profile");
    if (!tenant) return;

    try {
      const devices = await prisma.tvDevice.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "asc" },
      });
      res.json(devices);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to list TV devices" });
    }
  });

  app.patch("/api/tenants/:slug/tv-devices/:id", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "profile");
    if (!tenant) return;

    try {
      const device = await prisma.tvDevice.findFirst({
        where: { id: req.params.id, tenantId: tenant.id },
      });
      if (!device) return res.status(404).json({ error: "TV não encontrada." });

      const updated = await prisma.tvDevice.update({
        where: { id: device.id },
        data: { label: String(req.body?.label || "").trim() || null },
      });
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update TV device" });
    }
  });

  // Desvincula — o aparelho perde o acesso e volta a mostrar código de pareamento
  // (não apaga o registro, só zera tenantId, pra manter o deviceToken reconhecível
  // caso o dono vincule de novo o mesmo aparelho fisico depois).
  app.delete("/api/tenants/:slug/tv-devices/:id", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "profile");
    if (!tenant) return;

    try {
      const device = await prisma.tvDevice.findFirst({
        where: { id: req.params.id, tenantId: tenant.id },
      });
      if (!device) return res.status(404).json({ error: "TV não encontrada." });

      await prisma.tvDevice.update({
        where: { id: device.id },
        data: { tenantId: null, label: null, pairingCode: null, pairingCodeExpiresAt: null },
      });
      res.json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to unpair TV device" });
    }
  });

  // ── Carrossel de imagens do Painel de Pedidos ────────────────────────────────
  // Imagens de propaganda mostradas numa faixa dedicada ao lado das colunas de pedidos —
  // tabela própria (DisplayPanelImage) em vez de array dentro do JSON de config, pra
  // permitir reordenar/ativar-desativar sem reescrever o JSON inteiro a cada mudança.

  app.get("/api/tenants/:slug/display-panel/images", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "display-panel");
    if (!tenant) return;

    try {
      const images = await prisma.displayPanelImage.findMany({
        where: { tenantId: tenant.id },
        orderBy: { sortOrder: "asc" },
      });
      res.json(images);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao listar imagens do carrossel." });
    }
  });

  app.post("/api/tenants/:slug/display-panel/images", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "display-panel");
    if (!tenant) return;

    const imageUrl = String(req.body?.imageUrl || "").trim();
    if (!imageUrl) return res.status(400).json({ error: "imageUrl é obrigatório." });

    try {
      const maxOrder = await prisma.displayPanelImage.aggregate({
        where: { tenantId: tenant.id },
        _max: { sortOrder: true },
      });
      const image = await prisma.displayPanelImage.create({
        data: {
          tenantId: tenant.id,
          imageUrl,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
      });
      res.json(image);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao adicionar imagem." });
    }
  });

  app.patch("/api/tenants/:slug/display-panel/images/:id", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "display-panel");
    if (!tenant) return;

    try {
      const image = await prisma.displayPanelImage.findFirst({
        where: { id: req.params.id, tenantId: tenant.id },
      });
      if (!image) return res.status(404).json({ error: "Imagem não encontrada." });

      const { active, sortOrder } = req.body as { active?: boolean; sortOrder?: number };
      const updated = await prisma.displayPanelImage.update({
        where: { id: image.id },
        data: {
          ...(active !== undefined ? { active } : {}),
          ...(sortOrder !== undefined ? { sortOrder } : {}),
        },
      });
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao atualizar imagem." });
    }
  });

  app.delete("/api/tenants/:slug/display-panel/images/:id", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "display-panel");
    if (!tenant) return;

    try {
      const image = await prisma.displayPanelImage.findFirst({
        where: { id: req.params.id, tenantId: tenant.id },
      });
      if (!image) return res.status(404).json({ error: "Imagem não encontrada." });

      await prisma.displayPanelImage.delete({ where: { id: image.id } });
      res.json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao remover imagem." });
    }
  });

  // Rota pública (sem auth) — usada pelo próprio Painel de Pedidos (/:slug/display) pra
  // buscar as imagens ativas do carrossel, na mesma tela que o cliente/TV acessa sem login.
  app.get("/api/tenants/:slug/display-panel/images/public", async (req, res) => {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
      if (!tenant) return res.status(404).json({ error: "Estabelecimento não encontrado." });

      const images = await prisma.displayPanelImage.findMany({
        where: { tenantId: tenant.id, active: true },
        orderBy: { sortOrder: "asc" },
      });
      res.json(images);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao carregar imagens do carrossel." });
    }
  });
}
