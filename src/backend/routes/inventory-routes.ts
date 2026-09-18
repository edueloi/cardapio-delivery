import type { Express, Request, RequestHandler, Response } from "express";
import { parseProductionRecipeRecord } from "../production";
import { deductStockFIFO } from "../shared/order-helpers";

export interface RegisterInventoryRoutesOptions {
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
  requireTenantFromInventoryItem: (
    req: Request,
    res: Response,
    itemId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any | null>;
  handleStockBatchSideEffects: (
    tenantId: string,
    tenantWhatsapp: string | null | undefined,
    updatedBatches: {
      id: string;
      name: string;
      quantity: number;
      minStock: number | null;
      unit: string;
    }[],
    deductedQuantity: number,
  ) => Promise<void>;
  emitInventoryRestockSideEffects: (
    tenantId: string,
    inventoryItemId: string,
  ) => Promise<void>;
}

export function registerInventoryRoutes({
  app,
  prisma,
  requireAuth,
  requireTenantById,
  requireTenantBySlug,
  requireTenantFromInventoryItem,
  handleStockBatchSideEffects,
  emitInventoryRestockSideEffects,
}: RegisterInventoryRoutesOptions) {
  app.get("/api/tenants/:slug/inventory", requireAuth, async (req, res) => {
    // "menu" também libera — quem edita produto precisa listar os insumos pra vincular
    // ao "Insumos usados" mesmo sem ter a permissão de Estoque (gerenciar compras/níveis).
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      ["inventory", "menu"]
    );
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
    const tenant = await requireTenantById(
      req,
      res,
      req.body.tenantId,
      "inventory"
    );
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

  app.get(
    "/api/tenants/:slug/inventory/categories",
    requireAuth,
    async (req, res) => {
      // "menu" também libera — mesmo motivo do GET /inventory acima.
      const tenant = await requireTenantBySlug(
        req,
        res,
        req.params.slug,
        ["inventory", "menu"]
      );
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
    }
  );

  app.patch("/api/inventory/categories/:id", requireAuth, async (req, res) => {
    const existing = await prisma.inventoryCategory.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ error: "Categoria não encontrada." });
    }
    const tenant = await requireTenantById(req, res, existing.tenantId, "inventory");
    if (!tenant) return;

    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Informe o nome da categoria." });
    }

    try {
      const category = await prisma.inventoryCategory.update({
        where: { id: existing.id },
        data: { name },
      });
      res.json(category);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update inventory category" });
    }
  });

  // Exclui uma categoria de estoque. Se houver itens vinculados e o caller não
  // confirmar (?force=true), retorna 409 com a contagem para o front avisar o
  // usuário antes de prosseguir — ao confirmar, os itens ficam sem categoria
  // (categoryId null) em vez de serem apagados ou bloquear a exclusão.
  app.delete("/api/inventory/categories/:id", requireAuth, async (req, res) => {
    const existing = await prisma.inventoryCategory.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ error: "Categoria não encontrada." });
    }
    const tenant = await requireTenantById(req, res, existing.tenantId, "inventory");
    if (!tenant) return;

    try {
      const itemCount = await prisma.inventoryItem.count({
        where: { categoryId: existing.id },
      });

      if (itemCount > 0 && req.query.force !== "true") {
        return res.status(409).json({
          error: `Esta categoria tem ${itemCount} item(ns) de estoque vinculado(s).`,
          itemCount,
        });
      }

      await prisma.$transaction([
        prisma.inventoryItem.updateMany({
          where: { categoryId: existing.id },
          data: { categoryId: null },
        }),
        prisma.inventoryCategory.delete({ where: { id: existing.id } }),
      ]);

      res.json({ ok: true, itemsUncategorized: itemCount });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete inventory category" });
    }
  });

  app.post("/api/inventory/items", requireAuth, async (req, res) => {
    const tenant = await requireTenantById(
      req,
      res,
      req.body.tenantId,
      "inventory"
    );
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

  app.post("/api/inventory/items/quick-adjust", requireAuth, async (req, res) => {
    const {
      tenantId,
      baseItemId,
      type,
      quantity,
      reason,
      newExpirationDate,
      newCode,
      isNewBatch,
    } = req.body;
    const normalizedBaseItemId = String(baseItemId || "").trim();
    const normalizedType = type === "OUT" ? "OUT" : type === "IN" ? "IN" : null;
    const numericQuantity = Number(quantity);

    if (
      !tenantId ||
      !normalizedBaseItemId ||
      !normalizedType ||
      !Number.isFinite(numericQuantity) ||
      numericQuantity <= 0
    )
      return res.status(400).json({ error: "Parâmetros inválidos." });

    const tenant = await requireTenantById(req, res, tenantId, "inventory");
    if (!tenant) return;

    try {
      let baseItem = await prisma.inventoryItem.findFirst({
        where: { id: normalizedBaseItemId, tenantId: tenant.id },
      });

      if (!baseItem && normalizedBaseItemId.startsWith("group-")) {
        const groupedName = normalizedBaseItemId.slice("group-".length).trim();
        if (groupedName) {
          const groupedBatches = await prisma.inventoryItem.findMany({
            where: { tenantId: tenant.id, name: groupedName },
          });
          groupedBatches.sort((a, b) => {
            if (a.expirationDate && !b.expirationDate) return -1;
            if (!a.expirationDate && b.expirationDate) return 1;
            if (a.expirationDate && b.expirationDate) {
              return a.expirationDate.getTime() - b.expirationDate.getTime();
            }
            return a.createdAt.getTime() - b.createdAt.getTime();
          });
          baseItem = groupedBatches[0] ?? null;
        }
      }

      if (!baseItem)
        return res.status(404).json({ error: "Item base não encontrado." });

      if (normalizedType === "OUT") {
        const siblingBatches = await prisma.inventoryItem.findMany({
          where: { tenantId: tenant.id, name: baseItem.name },
        });
        const availableQuantity = siblingBatches.reduce(
          (sum, batch) => sum + (Number.isFinite(batch.quantity) ? batch.quantity : 0),
          0
        );

        if (availableQuantity < numericQuantity) {
          return res.status(400).json({
            error: `Estoque insuficiente. Disponível: ${availableQuantity} ${baseItem.unit || "un"}.`,
          });
        }

        const updatedBatches = await prisma.$transaction((tx) =>
          deductStockFIFO(
            tx,
            tenant.id,
            baseItem.id,
            numericQuantity,
            "MANUAL_ADJUSTMENT",
            reason || "MANUAL"
          )
        );
        // Ajuste manual de saída (tela de Estoque) não passava por essa checagem — um
        // produto podia zerar por aqui e nunca ser desativado do cardápio automaticamente.
        if (updatedBatches.length > 0) {
          await handleStockBatchSideEffects(
            tenant.id,
            tenant.whatsapp,
            updatedBatches,
            numericQuantity
          );
        }
        return res.json({ success: true, updatedBatches });
      } else {
        if (isNewBatch) {
          const newItem = await prisma.inventoryItem.create({
            data: {
              tenantId: tenant.id,
              name: baseItem.name,
              categoryId: baseItem.categoryId,
              brand: baseItem.brand,
              purchasePrice: baseItem.purchasePrice,
              sellingPrice: baseItem.sellingPrice,
              minStock: baseItem.minStock,
              unit: baseItem.unit,
              weight: baseItem.weight,
              usage: baseItem.usage,
              purchaseUnit: baseItem.purchaseUnit,
              purchaseQty: baseItem.purchaseQty,
              stockUnit: baseItem.stockUnit,
              code: newCode || null,
              expirationDate: newExpirationDate
                ? new Date(newExpirationDate)
                : null,
              quantity: numericQuantity,
              movements: {
                create: {
                  type: "IN",
                  quantity: numericQuantity,
                  reason: reason || "MANUAL",
                  orderId: "MANUAL_ADJUSTMENT",
                },
              },
            },
          });
          // Reativa produtos que estavam auto-desativados por esse insumo zerar — ajuste
          // manual de entrada (novo lote) não disparava essa reativação antes.
          await emitInventoryRestockSideEffects(tenant.id, newItem.id);
          return res.json({ success: true, item: newItem });
        } else {
          const updatedItem = await prisma.inventoryItem.update({
            where: { id: baseItem.id },
            data: {
              quantity: { increment: numericQuantity },
              movements: {
                create: {
                  type: "IN",
                  quantity: numericQuantity,
                  reason: reason || "MANUAL",
                  orderId: "MANUAL_ADJUSTMENT",
                },
              },
            },
          });
          // Idem — ajuste manual de entrada num lote existente também precisa reativar.
          await emitInventoryRestockSideEffects(tenant.id, updatedItem.id);
          return res.json({ success: true, item: updatedItem });
        }
      }
    } catch (error) {
      console.error("[inventory/quick-adjust] Failed:", {
        tenantId,
        baseItemId: normalizedBaseItemId,
        type: normalizedType,
        quantity: numericQuantity,
        isNewBatch: !!isNewBatch,
        error,
      });
      res.status(500).json({ error: "Falha ao ajustar estoque." });
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

      // Edição manual (tela de Estoque) também não passava por essa checagem: reativa o
      // produto se voltou a ter estoque, ou desativa se essa edição zerou o total do lote.
      if (newQuantity > 0) {
        await emitInventoryRestockSideEffects(scoped.tenant.id, item.id);
      } else {
        await handleStockBatchSideEffects(scoped.tenant.id, scoped.tenant.whatsapp, [item], 0);
      }

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

  app.get(
    "/api/tenants/:slug/production/recipes",
    requireAuth,
    async (req, res) => {
      // "Insumos Usados" no cadastro do cardápio também busca essa lista pra popular o
      // seletor de fichas de receita — sem aceitar "menu" aqui, quem só tem permissão de
      // Cardápio (não Produção) via essa tela vazia/quebrada, mesmo já podendo vincular
      // via PATCH /api/products/:id/recipe (que já aceita "menu").
      const tenant = await requireTenantBySlug(
        req,
        res,
        req.params.slug,
        ["production", "menu"]
      );
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
          orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
        });

        res.json(recipes.map(parseProductionRecipeRecord));
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Falha ao buscar receitas de produção." });
      }
    }
  );
}
