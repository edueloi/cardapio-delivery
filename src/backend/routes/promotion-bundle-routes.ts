import type { Express, Request, RequestHandler, Response } from "express";

export interface RegisterPromotionBundleRoutesOptions {
  app: Express;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any;
  requireAuth: RequestHandler;
  requireTenantById: (
    req: Request,
    res: Response,
    tenantId: string,
    tabId?: string | string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any | null>;
  requireTenantBySlug: (
    req: Request,
    res: Response,
    slug: string,
    tabId?: string | string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any | null>;
}

export function registerPromotionBundleRoutes({
  app,
  prisma,
  requireAuth,
  requireTenantById,
  requireTenantBySlug,
}: RegisterPromotionBundleRoutesOptions) {
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
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              imageUrl: true,
              available: true,
              inventoryItem: { select: { quantity: true } },
            },
          },
        },
      });
      // Promoção vinculada a um produto esgotado/indisponível não faz sentido continuar
      // aparecendo — some junto com o produto, em vez de ficar exibida sem poder ser aberta.
      const visible = promotions.filter((promo) => {
        if (!promo.product) return true;
        if (promo.product.available === false) return false;
        if (
          promo.product.inventoryItem &&
          promo.product.inventoryItem.quantity <= 0
        )
          return false;
        return true;
      });
      res.json(visible);
    } catch (e) {
      res.status(500).json({ error: "Erro ao buscar promoções" });
    }
  });

  app.get("/api/admin/:tenantId/promotions", requireAuth, async (req, res) => {
    const tenant = await requireTenantById(
      req,
      res,
      req.params.tenantId,
      "promotions"
    );
    if (!tenant) return;
    const { tenantId } = req.params;
    try {
      const promotions = await prisma.promotion.findMany({
        where: { tenantId },
        orderBy: { sortOrder: "asc" },
        include: {
          product: {
            select: { id: true, name: true, price: true, imageUrl: true },
          },
        },
      });
      res.json(promotions);
    } catch (e) {
      res.status(500).json({ error: "Erro ao buscar promoções" });
    }
  });

  app.post("/api/admin/:tenantId/promotions", requireAuth, async (req, res) => {
    const tenant = await requireTenantById(
      req,
      res,
      req.params.tenantId,
      "promotions"
    );
    if (!tenant) return;
      const { tenantId } = req.params;
    const {
      title,
      description,
      imageUrl,
      linkProductId,
      promoPrice,
      active,
      startsAt,
      endsAt,
      sortOrder,
    } = req.body;
    try {
      const promo = await prisma.promotion.create({
        data: {
          tenantId,
          title,
          description: description || null,
          imageUrl: imageUrl || null,
          linkProductId: linkProductId || null,
          promoPrice: promoPrice || null,
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
    const existingPromo = await prisma.promotion.findUnique({ where: { id } });
    if (!existingPromo)
      return res.status(404).json({ error: "Promoção não encontrada." });
    const tenant = await requireTenantById(
      req,
      res,
      existingPromo.tenantId,
      "promotions"
    );
    if (!tenant) return;

    const {
      title,
      description,
      imageUrl,
      linkProductId,
      promoPrice,
      active,
      startsAt,
      endsAt,
      sortOrder,
    } = req.body;
    try {
      const promo = await prisma.promotion.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(imageUrl !== undefined && { imageUrl }),
          ...(linkProductId !== undefined && {
            linkProductId: linkProductId || null,
          }),
          ...(promoPrice !== undefined && { promoPrice: promoPrice || null }),
          ...(active !== undefined && { active }),
          ...(startsAt !== undefined && {
            startsAt: startsAt ? new Date(startsAt) : null,
          }),
          ...(endsAt !== undefined && {
            endsAt: endsAt ? new Date(endsAt) : null,
          }),
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
    const existingPromo = await prisma.promotion.findUnique({ where: { id } });
    if (!existingPromo)
      return res.status(404).json({ error: "Promoção não encontrada." });
    const tenant = await requireTenantById(
      req,
      res,
      existingPromo.tenantId,
      "promotions"
    );
    if (!tenant) return;

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
      const rows = (await (prisma as any).$queryRawUnsafe(
        `SELECT * FROM product_bundles WHERE tenant_id = ? AND available = 1 ORDER BY sort_order ASC, created_at ASC`,
        tenant.id
      )) as any[];
      const bundles = rows.map((r: any) => ({
        id: r.id,
        tenantId: r.tenant_id,
        name: r.name,
        description: r.description,
        imageUrl: r.image_url,
        price: r.price,
        available: Boolean(r.available),
        sortOrder: r.sort_order,
        steps: (() => {
          try {
            return JSON.parse(r.steps);
          } catch {
            return [];
          }
        })(),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
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
    const tenant = await requireTenantBySlug(req, res, slug, "menu");
    if (!tenant) return;
    try {
      const rows = (await (prisma as any).$queryRawUnsafe(
        `SELECT * FROM product_bundles WHERE tenant_id = ? ORDER BY sort_order ASC, created_at ASC`,
        tenant.id
      )) as any[];
      const bundles = rows.map((r: any) => ({
        id: r.id,
        tenantId: r.tenant_id,
        name: r.name,
        description: r.description,
        imageUrl: r.image_url,
        price: r.price,
        available: Boolean(r.available),
        sortOrder: r.sort_order,
        steps: (() => {
          try {
            return JSON.parse(r.steps);
          } catch {
            return [];
          }
        })(),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
      res.json(bundles);
    } catch (e) {
      res.status(500).json({ error: "Erro ao buscar combos" });
    }
  });

  // Admin: criar combo
  app.post("/api/admin/:slug/bundles", requireAuth, async (req, res) => {
    const { slug } = req.params;
    const tenant = await requireTenantBySlug(req, res, slug, "menu");
    if (!tenant) return;
    const { name, description, imageUrl, price, available, sortOrder, steps } =
      req.body;
    try {
      const id = require("crypto").randomBytes(12).toString("base64url");
      await (prisma as any).$executeRawUnsafe(
        `INSERT INTO product_bundles (id, tenant_id, name, description, image_url, price, available, sort_order, steps) VALUES (?,?,?,?,?,?,?,?,?)`,
        id,
        tenant.id,
        name,
        description ?? null,
        imageUrl ?? null,
        price ?? 0,
        available !== false ? 1 : 0,
        sortOrder ?? 0,
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
    const existingRows = (await (prisma as any).$queryRawUnsafe(
      `SELECT tenant_id FROM product_bundles WHERE id = ?`,
      id
    )) as any[];
    if (!existingRows[0])
      return res.status(404).json({ error: "Combo não encontrado." });
    const tenant = await requireTenantById(
      req,
      res,
      existingRows[0].tenant_id,
      "menu"
    );
    if (!tenant) return;

    const { name, description, imageUrl, price, available, sortOrder, steps } =
      req.body;
    try {
      await (prisma as any).$executeRawUnsafe(
        `UPDATE product_bundles SET name=?, description=?, image_url=?, price=?, available=?, sort_order=?, steps=?, updated_at=NOW() WHERE id=?`,
        name,
        description ?? null,
        imageUrl ?? null,
        price ?? 0,
        available !== false ? 1 : 0,
        sortOrder ?? 0,
        JSON.stringify(steps ?? []),
        id
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao atualizar combo" });
    }
  });

  // Admin: deletar combo
  app.delete("/api/admin/bundles/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const existingRows = (await (prisma as any).$queryRawUnsafe(
      `SELECT tenant_id FROM product_bundles WHERE id = ?`,
      id
    )) as any[];
    if (!existingRows[0])
      return res.status(404).json({ error: "Combo não encontrado." });
    const tenant = await requireTenantById(
      req,
      res,
      existingRows[0].tenant_id,
      "menu"
    );
    if (!tenant) return;

    try {
      await (prisma as any).$executeRawUnsafe(
        `DELETE FROM product_bundles WHERE id=?`,
        id
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao deletar combo" });
    }
  });
}
