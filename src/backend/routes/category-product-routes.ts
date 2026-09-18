import type { Express, Request, RequestHandler, Response } from "express";
import type { Server } from "socket.io";

export interface RegisterCategoryProductRoutesOptions {
  app: Express;
  io: Server;
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
  requireTenantFromProduct: (
    req: Request,
    res: Response,
    productId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any | null>;
  ensureWppSetup: (tenantId: string, tenantName: string) => Promise<unknown>;
}

export function registerCategoryProductRoutes({
  app,
  io,
  prisma,
  requireAuth,
  requireTenantById,
  requireTenantFromProduct,
  ensureWppSetup,
}: RegisterCategoryProductRoutesOptions) {
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
    const tenant = await requireTenantById(req, res, tenantId, "menu");
    if (!tenant) return;

    try {
      const maxOrder = await prisma.category.aggregate({
        where: { tenantId: tenant.id },
        _max: { sortOrder: true },
      });
      const category = await prisma.category.create({
        data: {
          name,
          tenantId: tenant.id,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
      });
      io.to(`tenant-${tenant.id}`).emit("menu-updated", { tenantId: tenant.id });
      res.json(category);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  // Reordena categorias (drag-and-drop) — recebe array de ids na nova ordem.
  // Precisa vir ANTES de "/api/categories/:id", senão o Express casa "reorder" como :id.
  app.patch("/api/categories/reorder", requireAuth, async (req, res) => {
    const { tenantId, orderedIds } = req.body as {
      tenantId: string;
      orderedIds: string[];
    };
    const tenant = await requireTenantById(req, res, tenantId, "menu");
    if (!tenant) return;
    if (!Array.isArray(orderedIds))
      return res.status(400).json({ error: "orderedIds é obrigatório." });

    try {
      await prisma.$transaction(
        orderedIds.map((id, index) =>
          prisma.category.update({ where: { id }, data: { sortOrder: index } })
        )
      );
      io.to(`tenant-${tenant.id}`).emit("menu-updated", { tenantId: tenant.id });
      res.json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to reorder categories" });
    }
  });

  app.patch("/api/categories/:id", requireAuth, async (req, res) => {
    const { name } = req.body;
    try {
      const category = await prisma.category.update({
        where: { id: req.params.id },
        data: { name },
      });
      io.to(`tenant-${category.tenantId}`).emit("menu-updated", {
        tenantId: category.tenantId,
      });
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", requireAuth, async (req, res) => {
    try {
      const category = await prisma.category.delete({
        where: { id: req.params.id },
      });
      io.to(`tenant-${category.tenantId}`).emit("menu-updated", {
        tenantId: category.tenantId,
      });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  app.post("/api/products", requireAuth, async (req, res) => {
    const {
      name,
      description,
      price,
      imageUrl,
      categoryId,
      tenantId,
      variants,
      inventoryItemId,
      pdvOnly,
      kitchenPrint,
      extras,
      selectionGroup,
      scheduleRule,
      recipeId,
    } = req.body;
    const tenant = await requireTenantById(req, res, tenantId, "menu");
    if (!tenant) return;

    if (!name || !categoryId || isNaN(parseFloat(price))) {
      res.status(400).json({ error: "Nome, categoria e preço são obrigatórios." });
      return;
    }

    try {
      const maxOrder = await prisma.product.aggregate({
        where: { categoryId },
        _max: { sortOrder: true },
      });
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
          kitchenPrint:
            kitchenPrint === undefined ? false : Boolean(kitchenPrint),
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
          inventoryItemId: inventoryItemId || null,
          extras: extras
            ? typeof extras === "string"
              ? extras
              : JSON.stringify(extras)
            : null,
          selectionGroup: selectionGroup
            ? typeof selectionGroup === "string"
              ? selectionGroup
              : JSON.stringify(selectionGroup)
            : null,
          scheduleRule: scheduleRule
            ? typeof scheduleRule === "string"
              ? scheduleRule
              : JSON.stringify(scheduleRule)
            : null,
          variants: Array.isArray(variants)
            ? {
                create: variants.map((variant: any) => ({
                  name: variant.name,
                  price: parseFloat(variant.price),
                  description: variant.description,
                  imageUrl: variant.imageUrl || null,
                  inventoryItemId: variant.inventoryItemId || null,
                })),
              }
            : undefined,
        },
        include: { variants: true },
      });

      // Salva recipeId via SQL pois o campo foi adicionado ao banco mas o client Prisma ainda não foi regenerado
      if (recipeId) {
        await prisma.$executeRawUnsafe(
          "UPDATE products SET recipe_id = ? WHERE id = ?",
          recipeId,
          product.id
        );
      }

      io.to(`tenant-${tenant.id}`).emit("menu-updated", { tenantId: tenant.id });
      res.json({ ...product, recipeId: recipeId || null });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  // Reordena produtos dentro de uma categoria e/ou move um produto para outra categoria (drag-and-drop).
  // Precisa vir ANTES de "/api/products/:id", senão o Express casa "reorder" como :id.
  app.patch("/api/products/reorder", requireAuth, async (req, res) => {
    const { tenantId, categoryId, orderedIds, movedProductId, targetCategoryId } =
      req.body as {
        tenantId: string;
        categoryId: string;
        orderedIds: string[];
        movedProductId?: string;
        targetCategoryId?: string;
      };
    const tenant = await requireTenantById(req, res, tenantId, "menu");
    if (!tenant) return;
    if (!Array.isArray(orderedIds))
      return res.status(400).json({ error: "orderedIds é obrigatório." });

    try {
      await prisma.$transaction([
        // Move o produto de categoria antes de aplicar a nova ordem, se aplicável
        ...(movedProductId && targetCategoryId
          ? [
              prisma.product.update({
                where: { id: movedProductId },
                data: { categoryId: targetCategoryId },
              }),
            ]
          : []),
        ...orderedIds.map((id, index) =>
          prisma.product.update({
            where: { id },
            data: { sortOrder: index, categoryId },
          })
        ),
      ]);
      io.to(`tenant-${tenant.id}`).emit("menu-updated", { tenantId: tenant.id });
      res.json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to reorder products" });
    }
  });

  app.patch("/api/products/:id", requireAuth, async (req, res) => {
    const scoped = await requireTenantFromProduct(req, res, req.params.id);
    if (!scoped) return;

    const {
      name,
      description,
      price,
      imageUrl,
      variants,
      inventoryItemId,
      available,
      autoDisableWhenOutOfStock,
      pdvOnly,
      kitchenPrint,
      extras,
      selectionGroup,
      scheduleRule,
      recipeId,
    } = req.body;

    try {
      const product = await prisma.$transaction(async (tx) => {
        await tx.productVariant.deleteMany({
          where: { productId: scoped.product.id },
        });

        return tx.product.update({
          where: { id: scoped.product.id },
          data: {
            name,
            description,
            price: parseFloat(price),
            imageUrl,
            inventoryItemId: inventoryItemId || null,
            extras:
              extras !== undefined
                ? typeof extras === "string"
                  ? extras
                  : JSON.stringify(extras)
                : undefined,
            selectionGroup:
              selectionGroup !== undefined
                ? selectionGroup
                  ? typeof selectionGroup === "string"
                    ? selectionGroup
                    : JSON.stringify(selectionGroup)
                  : null
                : undefined,
            scheduleRule:
              scheduleRule !== undefined
                ? scheduleRule
                  ? typeof scheduleRule === "string"
                    ? scheduleRule
                    : JSON.stringify(scheduleRule)
                  : null
                : undefined,
            ...(available !== undefined && { available: Boolean(available) }),
            ...(autoDisableWhenOutOfStock !== undefined && {
              autoDisableWhenOutOfStock: Boolean(autoDisableWhenOutOfStock),
            }),
            ...(pdvOnly !== undefined && { pdvOnly: Boolean(pdvOnly) }),
            ...(kitchenPrint !== undefined && {
              kitchenPrint: Boolean(kitchenPrint),
            }),
            variants: Array.isArray(variants)
              ? {
                  create: variants.map((variant: any) => ({
                    name: variant.name,
                    price: parseFloat(variant.price),
                    description: variant.description,
                    imageUrl: variant.imageUrl || null,
                    inventoryItemId: variant.inventoryItemId || null,
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
          "UPDATE products SET recipe_id = ? WHERE id = ?",
          recipeId || null,
          scoped.product.id
        );
      }

      io.to(`tenant-${scoped.tenant.id}`).emit("menu-updated", {
        tenantId: scoped.tenant.id,
      });
      res.json({
        ...product,
        recipeId: recipeId !== undefined ? recipeId || null : undefined,
      });
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
      io.to(`tenant-${scoped.tenant.id}`).emit("menu-updated", {
        tenantId: scoped.tenant.id,
      });
      res.json(product);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update product availability" });
    }
  });

  // Vincula/desvincula a ficha de insumos (ProductionRecipe) sem tocar em mais nada do
  // produto — usado pelo fluxo simples de "Insumos usados" no cadastro do cardápio.
  app.patch("/api/products/:id/recipe", requireAuth, async (req, res) => {
    const scoped = await requireTenantFromProduct(req, res, req.params.id);
    if (!scoped) return;

    const { recipeId } = req.body;

    try {
      await prisma.$executeRawUnsafe(
        "UPDATE products SET recipe_id = ? WHERE id = ?",
        recipeId || null,
        scoped.product.id
      );
      io.to(`tenant-${scoped.tenant.id}`).emit("menu-updated", {
        tenantId: scoped.tenant.id,
      });
      res.json({ id: scoped.product.id, recipeId: recipeId || null });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update product recipe link" });
    }
  });

  app.delete("/api/products/:id", requireAuth, async (req, res) => {
    const scoped = await requireTenantFromProduct(req, res, req.params.id);
    if (!scoped) return;

    try {
      await prisma.product.delete({ where: { id: scoped.product.id } });
      io.to(`tenant-${scoped.tenant.id}`).emit("menu-updated", {
        tenantId: scoped.tenant.id,
      });
      res.sendStatus(200);
    } catch (error: any) {
      if (error?.code === "P2003") {
        // order_items.product_id agora é SET NULL, então isso só deveria acontecer se
        // alguma outra FK (ex: futura) ainda restringir a exclusão. Mantido como rede
        // de segurança: desativa em vez de deixar o erro estourar pro usuário.
        const product = await prisma.product.update({
          where: { id: scoped.product.id },
          data: { available: false },
        });
        io.to(`tenant-${scoped.tenant.id}`).emit("menu-updated", {
          tenantId: scoped.tenant.id,
        });
        res.status(409).json({
          error: "Este produto já foi usado em pedidos e não pode ser excluído. Ele foi desativado do cardápio.",
          deactivated: true,
          product,
        });
        return;
      }
      console.error(error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  app.post("/api/bot/webhook", async (req, res) => {
    const { body, tenantSlug } = req.body;
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (
      tenant &&
      String(body || "")
        .toLowerCase()
        .includes("cardapio")
    ) {
      const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(
        /\/$/,
        ""
      );
      return res.json({
        reply: `Olá! Veja nosso cardápio online aqui: ${baseUrl}/${tenant.slug}`,
      });
    }

    res.json({ reply: "Não entendi. Digite 'cardápio' para ver as opções." });
  });
}
