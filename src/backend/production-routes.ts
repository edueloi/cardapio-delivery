import { randomUUID } from "crypto";
import type { Express, Request, Response, RequestHandler } from "express";
import type { Server } from "socket.io";
import {
  ProductionValidationError,
  buildProductionSimulation,
  parseProductionRecipeRecord,
  parseProductionRunRecord,
  sanitizeProductionIngredients,
  sanitizeProductionOverheads,
} from "./production";
import { makeProductionBatchCode, normalizeProductionUnit, roundProductionValue } from "../lib/production";

interface RegisterProductionRoutesOptions {
  app: Express;
  io: Server;
  prisma: any;
  requireAuth: RequestHandler;
  requireTenantBySlug: (
    req: Request,
    res: Response,
    slug: string,
    tabId?: string,
  ) => Promise<any | null>;
  currentAccount: (req: Request) => { name?: string | null } | null;
}

const PRODUCTION_UNAVAILABLE_MESSAGE =
  "Controle de produção indisponível até concluir a atualização do banco de dados.";

function hasModelDelegate(prismaLike: any, model: "productionRecipe" | "productionRun") {
  return Boolean(prismaLike?.[model]);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "");
}

function getErrorCode(error: unknown) {
  if (typeof error === "object" && error && "code" in error) {
    return String((error as { code?: unknown }).code || "");
  }

  return "";
}

function isProductionInfrastructureError(error: unknown) {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);

  return (
    code === "P2010" ||
    code === "P2021" ||
    /productionRecipe|productionRun/.test(message) ||
    /production_recipes|production_runs/i.test(message) ||
    /doesn't exist/i.test(message) ||
    /Unknown table/i.test(message)
  );
}

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value || "")).filter(Boolean)));
}

function toRecipeRecord(row: any, product: any = null) {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id ?? row.tenantId ?? ""),
    productId: row.product_id ?? row.productId ?? null,
    name: String(row.name ?? ""),
    description: row.description ?? null,
    outputQuantity: Number(row.output_quantity ?? row.outputQuantity ?? 0),
    outputUnit: normalizeProductionUnit(row.output_unit ?? row.outputUnit ?? "un"),
    instructions: row.instructions ?? null,
    ingredients: String(row.ingredients ?? "[]"),
    overheads: row.overheads == null ? null : String(row.overheads),
    active: typeof row.active === "boolean" ? row.active : Boolean(Number(row.active ?? 0)),
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    product: product ?? row.product ?? null,
  };
}

function toRunRecord(row: any, recipeRecord: any = null) {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id ?? row.tenantId ?? ""),
    recipeId: row.recipe_id ?? row.recipeId ?? null,
    recipeName: String(row.recipe_name ?? row.recipeName ?? ""),
    batchCode: String(row.batch_code ?? row.batchCode ?? ""),
    quantityProduced: Number(row.quantity_produced ?? row.quantityProduced ?? 0),
    unit: normalizeProductionUnit(row.unit ?? "un"),
    notes: row.notes ?? null,
    createdByName: row.created_by_name ?? row.createdByName ?? null,
    totalIngredientCost: Number(row.total_ingredient_cost ?? row.totalIngredientCost ?? 0),
    totalOverheadCost: Number(row.total_overhead_cost ?? row.totalOverheadCost ?? 0),
    totalCost: Number(row.total_cost ?? row.totalCost ?? 0),
    costPerOutput: Number(row.cost_per_output ?? row.costPerOutput ?? 0),
    ingredientsSnapshot: String(row.ingredients_snapshot ?? row.ingredientsSnapshot ?? "[]"),
    overheadsSnapshot: row.overheads_snapshot == null ? null : String(row.overheads_snapshot ?? row.overheadsSnapshot),
    outputSnapshot: row.output_snapshot ?? row.outputSnapshot ?? null,
    createdAt: row.created_at ?? row.createdAt,
    recipe: recipeRecord ?? row.recipe ?? null,
  };
}

async function loadProductsMap(prismaLike: any, tenantId: string, productIds: string[]) {
  const ids = uniqueIds(productIds);
  if (ids.length === 0) {
    return new Map<string, any>();
  }

  const products = await prismaLike.product.findMany({
    where: {
      tenantId,
      id: { in: ids },
    },
    include: {
      inventoryItem: true,
    },
  });

  return new Map(products.map((product: any) => [product.id, product]));
}

async function queryRecipeRowsRaw(prismaLike: any, tenantId: string, recipeIds?: string[]) {
  const ids = uniqueIds(recipeIds || []);
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(", ");
    return prismaLike.$queryRawUnsafe(
      `SELECT * FROM production_recipes WHERE tenant_id = ? AND id IN (${placeholders}) ORDER BY active DESC, updated_at DESC`,
      tenantId,
      ...ids,
    ) as Promise<any[]>;
  }

  return prismaLike.$queryRawUnsafe(
    "SELECT * FROM production_recipes WHERE tenant_id = ? ORDER BY active DESC, updated_at DESC",
    tenantId,
  ) as Promise<any[]>;
}

async function findRecipeRecordRaw(prismaLike: any, tenantId: string, recipeId: string) {
  const rows = await prismaLike.$queryRawUnsafe(
    "SELECT * FROM production_recipes WHERE tenant_id = ? AND id = ? LIMIT 1",
    tenantId,
    recipeId,
  ) as any[];

  const row = rows[0];
  if (!row) {
    return null;
  }

  const productsMap = await loadProductsMap(prismaLike, tenantId, [row.product_id]);
  return toRecipeRecord(row, productsMap.get(String(row.product_id || "")) || null);
}

async function listRecipesRaw(prismaLike: any, tenantId: string) {
  const rows = await queryRecipeRowsRaw(prismaLike, tenantId);
  const productsMap = await loadProductsMap(prismaLike, tenantId, rows.map((row) => row.product_id));

  return rows.map((row) =>
    parseProductionRecipeRecord(
      toRecipeRecord(row, productsMap.get(String(row.product_id || "")) || null),
    ),
  );
}

async function listRecipes(prismaLike: any, tenantId: string) {
  if (hasModelDelegate(prismaLike, "productionRecipe")) {
    try {
      const recipes = await prismaLike.productionRecipe.findMany({
        where: { tenantId },
        include: {
          product: {
            include: {
              inventoryItem: true,
            },
          },
        },
        orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
      });

      return recipes.map(parseProductionRecipeRecord);
    } catch (error) {
      if (!isProductionInfrastructureError(error)) {
        throw error;
      }
    }
  }

  return listRecipesRaw(prismaLike, tenantId);
}

async function createRecipeRecord(
  prismaLike: any,
  tenantId: string,
  data: {
    productId: string | null;
    name: string;
    description: string | null;
    outputQuantity: number;
    outputUnit: string;
    instructions: string | null;
    ingredients: string;
    overheads: string;
    active: boolean;
  },
) {
  if (hasModelDelegate(prismaLike, "productionRecipe")) {
    try {
      return await prismaLike.productionRecipe.create({
        data: {
          tenantId,
          productId: data.productId,
          name: data.name,
          description: data.description,
          outputQuantity: data.outputQuantity,
          outputUnit: data.outputUnit,
          instructions: data.instructions,
          ingredients: data.ingredients,
          overheads: data.overheads,
          active: data.active,
        },
        include: {
          product: {
            include: {
              inventoryItem: true,
            },
          },
        },
      });
    } catch (error) {
      if (!isProductionInfrastructureError(error)) {
        throw error;
      }
    }
  }

  const recipeId = randomUUID();

  await prismaLike.$executeRawUnsafe(
    `INSERT INTO production_recipes
      (id, tenant_id, product_id, name, description, output_quantity, output_unit, instructions, ingredients, overheads, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
    recipeId,
    tenantId,
    data.productId,
    data.name,
    data.description,
    data.outputQuantity,
    data.outputUnit,
    data.instructions,
    data.ingredients,
    data.overheads,
    data.active ? 1 : 0,
  );

  return findRecipeRecordRaw(prismaLike, tenantId, recipeId);
}

async function updateRecipeRecord(
  prismaLike: any,
  tenantId: string,
  recipeId: string,
  data: {
    productId: string | null;
    name: string;
    description: string | null;
    outputQuantity: number;
    outputUnit: string;
    instructions: string | null;
    ingredients: string;
    overheads: string;
    active: boolean;
  },
) {
  if (hasModelDelegate(prismaLike, "productionRecipe")) {
    try {
      return await prismaLike.productionRecipe.update({
        where: { id: recipeId },
        data: {
          productId: data.productId,
          name: data.name,
          description: data.description,
          outputQuantity: data.outputQuantity,
          outputUnit: data.outputUnit,
          instructions: data.instructions,
          ingredients: data.ingredients,
          overheads: data.overheads,
          active: data.active,
        },
        include: {
          product: {
            include: {
              inventoryItem: true,
            },
          },
        },
      });
    } catch (error) {
      if (!isProductionInfrastructureError(error)) {
        throw error;
      }
    }
  }

  await prismaLike.$executeRawUnsafe(
    `UPDATE production_recipes
        SET product_id = ?,
            name = ?,
            description = ?,
            output_quantity = ?,
            output_unit = ?,
            instructions = ?,
            ingredients = ?,
            overheads = ?,
            active = ?,
            updated_at = NOW(3)
      WHERE id = ? AND tenant_id = ?`,
    data.productId,
    data.name,
    data.description,
    data.outputQuantity,
    data.outputUnit,
    data.instructions,
    data.ingredients,
    data.overheads,
    data.active ? 1 : 0,
    recipeId,
    tenantId,
  );

  return findRecipeRecordRaw(prismaLike, tenantId, recipeId);
}

async function deleteRecipeRecord(prismaLike: any, tenantId: string, recipeId: string) {
  if (hasModelDelegate(prismaLike, "productionRecipe")) {
    try {
      await prismaLike.productionRecipe.delete({
        where: { id: recipeId },
      });
      return;
    } catch (error) {
      if (!isProductionInfrastructureError(error)) {
        throw error;
      }
    }
  }

  await prismaLike.$executeRawUnsafe(
    "DELETE FROM production_recipes WHERE id = ? AND tenant_id = ?",
    recipeId,
    tenantId,
  );
}

async function listRunsRaw(prismaLike: any, tenantId: string) {
  const rows = await prismaLike.$queryRawUnsafe(
    "SELECT * FROM production_runs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 80",
    tenantId,
  ) as any[];

  const recipeIds = uniqueIds(rows.map((row) => row.recipe_id));
  const recipeRows = recipeIds.length > 0 ? await queryRecipeRowsRaw(prismaLike, tenantId, recipeIds) : [];
  const productsMap = await loadProductsMap(prismaLike, tenantId, recipeRows.map((row) => row.product_id));
  const recipeRecordMap = new Map(
    recipeRows.map((row) => [
      String(row.id),
      toRecipeRecord(row, productsMap.get(String(row.product_id || "")) || null),
    ]),
  );

  return rows.map((row) =>
    parseProductionRunRecord(
      toRunRecord(row, recipeRecordMap.get(String(row.recipe_id || "")) || null),
    ),
  );
}

async function listRuns(prismaLike: any, tenantId: string) {
  if (hasModelDelegate(prismaLike, "productionRun")) {
    try {
      const runs = await prismaLike.productionRun.findMany({
        where: { tenantId },
        include: {
          recipe: {
            include: {
              product: {
                include: {
                  inventoryItem: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 80,
      });

      return runs.map(parseProductionRunRecord);
    } catch (error) {
      if (!isProductionInfrastructureError(error)) {
        throw error;
      }
    }
  }

  return listRunsRaw(prismaLike, tenantId);
}

async function createRunRecordRaw(options: {
  prisma: any;
  tenantId: string;
  recipeId: string;
  quantityProduced: number;
  notes: string | null;
  createdByName: string | null;
}) {
  const { prisma, tenantId, recipeId, quantityProduced, notes, createdByName } = options;

  return prisma.$transaction(async (tx: any) => {
    const recipeRecord = await findRecipeRecordRaw(tx, tenantId, recipeId);

    if (!recipeRecord) {
      throw new Error("PRODUCTION_RECIPE_NOT_FOUND");
    }

    const recipe = parseProductionRecipeRecord(recipeRecord);
    const ingredientIds = recipe.ingredients.map((ingredient) => ingredient.inventoryItemId);
    const inventoryItems = ingredientIds.length > 0
      ? await tx.inventoryItem.findMany({
          where: {
            tenantId,
            id: { in: ingredientIds },
          },
        })
      : [];

    const simulation = buildProductionSimulation(recipeRecord, inventoryItems, quantityProduced);

    if (simulation.ingredients.some((ingredient) => !ingredient.available || !ingredient.canConvert)) {
      throw new ProductionValidationError(
        "Estoque insuficiente ou unidade incompatível para concluir esta produção.",
        simulation,
      );
    }

    const inventoryEvents: Array<{ id: string; quantity: number }> = [];
    const productEvents: Array<{ id: string; available: boolean }> = [];
    const ingredientSnapshots = [];

    for (const ingredient of simulation.ingredients) {
      if (!ingredient.convertedQuantity || ingredient.convertedQuantity <= 0) continue;

      const updatedItem = await tx.inventoryItem.update({
        where: { id: ingredient.inventoryItemId },
        data: {
          quantity: { decrement: ingredient.convertedQuantity },
          movements: {
            create: {
              type: "OUT",
              quantity: ingredient.convertedQuantity,
              reason: "PRODUCTION",
            },
          },
        },
      });

      inventoryEvents.push({ id: updatedItem.id, quantity: updatedItem.quantity });
      ingredientSnapshots.push({
        ...ingredient,
        stockAfter: updatedItem.quantity,
      });
    }

    let outputSnapshot = simulation.outputSnapshot ? { ...simulation.outputSnapshot } : null;

    if (outputSnapshot?.canRestock && outputSnapshot.inventoryItemId && outputSnapshot.convertedQuantity) {
      const outputItem = await tx.inventoryItem.findUnique({
        where: { id: outputSnapshot.inventoryItemId },
      });

      if (!outputItem) {
        outputSnapshot = {
          ...outputSnapshot,
          canRestock: false,
          message: "Item de estoque final não encontrado para entrada automática.",
        };
      } else {
        const incrementQuantity = Number(outputSnapshot.convertedQuantity || 0);
        const batchUnitCost = incrementQuantity > 0
          ? roundProductionValue(simulation.totalCost / incrementQuantity)
          : Number(outputItem.purchasePrice || 0);
        const currentQuantity = Number(outputItem.quantity || 0);
        const currentUnitCost = Number(outputItem.purchasePrice || 0);
        const averageUnitCost = currentQuantity > 0
          ? roundProductionValue(
              ((currentQuantity * currentUnitCost) + (incrementQuantity * batchUnitCost)) /
                (currentQuantity + incrementQuantity),
            )
          : batchUnitCost;

        const updatedOutputItem = await tx.inventoryItem.update({
          where: { id: outputItem.id },
          data: {
            quantity: { increment: incrementQuantity },
            purchasePrice: averageUnitCost,
            movements: {
              create: {
                type: "IN",
                quantity: incrementQuantity,
                reason: "PRODUCTION",
              },
            },
          },
        });

        outputSnapshot = {
          ...outputSnapshot,
          stockBefore: outputItem.quantity,
          stockAfter: updatedOutputItem.quantity,
        };

        inventoryEvents.push({ id: updatedOutputItem.id, quantity: updatedOutputItem.quantity });

        if (recipeRecord.productId) {
          const linkedProduct = await tx.product.findUnique({
            where: { id: recipeRecord.productId },
          });

          if (linkedProduct && !linkedProduct.available && linkedProduct.autoDisableWhenOutOfStock) {
            await tx.product.update({
              where: { id: linkedProduct.id },
              data: { available: true },
            });

            productEvents.push({ id: linkedProduct.id, available: true });
          }
        }
      }
    }

    const runId = randomUUID();
    const createdAt = new Date();
    const batchCode = makeProductionBatchCode();

    await tx.$executeRawUnsafe(
      `INSERT INTO production_runs
        (id, tenant_id, recipe_id, recipe_name, batch_code, quantity_produced, unit, notes, created_by_name, total_ingredient_cost, total_overhead_cost, total_cost, cost_per_output, ingredients_snapshot, overheads_snapshot, output_snapshot, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
      runId,
      tenantId,
      recipe.id,
      recipe.name,
      batchCode,
      simulation.quantityProduced,
      simulation.outputUnit,
      notes,
      createdByName,
      simulation.totalIngredientCost,
      simulation.totalOverheadCost,
      simulation.totalCost,
      simulation.costPerOutput,
      JSON.stringify(ingredientSnapshots),
      JSON.stringify(simulation.overheads),
      outputSnapshot ? JSON.stringify(outputSnapshot) : null,
    );

    return {
      inventoryEvents,
      productEvents,
      productionRun: toRunRecord(
        {
          id: runId,
          tenant_id: tenantId,
          recipe_id: recipe.id,
          recipe_name: recipe.name,
          batch_code: batchCode,
          quantity_produced: simulation.quantityProduced,
          unit: simulation.outputUnit,
          notes,
          created_by_name: createdByName,
          total_ingredient_cost: simulation.totalIngredientCost,
          total_overhead_cost: simulation.totalOverheadCost,
          total_cost: simulation.totalCost,
          cost_per_output: simulation.costPerOutput,
          ingredients_snapshot: JSON.stringify(ingredientSnapshots),
          overheads_snapshot: JSON.stringify(simulation.overheads),
          output_snapshot: outputSnapshot ? JSON.stringify(outputSnapshot) : null,
          created_at: createdAt,
        },
        recipeRecord,
      ),
    };
  });
}

export function registerProductionRoutes({
  app,
  io,
  prisma,
  requireAuth,
  requireTenantBySlug,
  currentAccount,
}: RegisterProductionRoutesOptions) {
  app.get("/api/tenants/:slug/production/recipes", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "production");
    if (!tenant) return;

    try {
      res.json(await listRecipes(prisma, tenant.id));
    } catch (error) {
      if (isProductionInfrastructureError(error)) {
        return res.json([]);
      }

      console.error(error);
      res.status(500).json({ error: "Falha ao buscar receitas de produção." });
    }
  });

  app.post("/api/tenants/:slug/production/recipes", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "production");
    if (!tenant) return;

    const name = String(req.body?.name || "").trim();
    const outputQuantity = Number(req.body?.outputQuantity || 0);

    if (!name) {
      return res.status(400).json({ error: "Informe o nome da receita." });
    }

    if (!Number.isFinite(outputQuantity) || outputQuantity <= 0) {
      return res.status(400).json({ error: "Informe um rendimento válido para a receita." });
    }

    try {
      const ingredientIds = Array.isArray(req.body?.ingredients)
        ? Array.from(
            new Set(
              req.body.ingredients
                .map((ingredient: any) => String(ingredient?.inventoryItemId || ""))
                .filter(Boolean),
            ),
          )
        : [];

      const inventoryItems = ingredientIds.length > 0
        ? await prisma.inventoryItem.findMany({
            where: {
              tenantId: tenant.id,
              id: { in: ingredientIds },
            },
          })
        : [];

      const ingredients = sanitizeProductionIngredients(req.body?.ingredients, inventoryItems);
      if (ingredients.length === 0) {
        return res.status(400).json({ error: "Adicione pelo menos um insumo com quantidade válida." });
      }

      const overheads = sanitizeProductionOverheads(req.body?.overheads);

      let product = null;
      if (req.body?.productId) {
        product = await prisma.product.findFirst({
          where: {
            id: String(req.body.productId),
            tenantId: tenant.id,
          },
          include: {
            inventoryItem: true,
          },
        });

        if (!product) {
          return res.status(400).json({ error: "Produto vinculado não encontrado neste estabelecimento." });
        }
      }

      const recipeRecord = await createRecipeRecord(prisma, tenant.id, {
        productId: product?.id || null,
        name,
        description: String(req.body?.description || "").trim() || null,
        outputQuantity: roundProductionValue(outputQuantity),
        outputUnit: normalizeProductionUnit(req.body?.outputUnit || "un"),
        instructions: String(req.body?.instructions || "").trim() || null,
        ingredients: JSON.stringify(ingredients),
        overheads: JSON.stringify(overheads),
        active: req.body?.active !== false,
      });

      if (!recipeRecord) {
        return res.status(503).json({ error: PRODUCTION_UNAVAILABLE_MESSAGE });
      }

      res.json(parseProductionRecipeRecord(recipeRecord));
    } catch (error) {
      if (isProductionInfrastructureError(error)) {
        return res.status(503).json({ error: PRODUCTION_UNAVAILABLE_MESSAGE });
      }

      console.error(error);
      res.status(500).json({ error: "Falha ao criar receita de produção." });
    }
  });

  app.patch("/api/tenants/:slug/production/recipes/:id", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "production");
    if (!tenant) return;

    const name = String(req.body?.name || "").trim();
    const outputQuantity = Number(req.body?.outputQuantity || 0);

    if (!name) {
      return res.status(400).json({ error: "Informe o nome da receita." });
    }

    if (!Number.isFinite(outputQuantity) || outputQuantity <= 0) {
      return res.status(400).json({ error: "Informe um rendimento válido para a receita." });
    }

    try {
      const existingRecipe = hasModelDelegate(prisma, "productionRecipe")
        ? await prisma.productionRecipe.findFirst({
            where: {
              id: req.params.id,
              tenantId: tenant.id,
            },
          })
        : await findRecipeRecordRaw(prisma, tenant.id, req.params.id);

      if (!existingRecipe) {
        return res.status(404).json({ error: "Receita não encontrada." });
      }

      const ingredientIds = Array.isArray(req.body?.ingredients)
        ? Array.from(
            new Set(
              req.body.ingredients
                .map((ingredient: any) => String(ingredient?.inventoryItemId || ""))
                .filter(Boolean),
            ),
          )
        : [];

      const inventoryItems = ingredientIds.length > 0
        ? await prisma.inventoryItem.findMany({
            where: {
              tenantId: tenant.id,
              id: { in: ingredientIds },
            },
          })
        : [];

      const ingredients = sanitizeProductionIngredients(req.body?.ingredients, inventoryItems);
      if (ingredients.length === 0) {
        return res.status(400).json({ error: "Adicione pelo menos um insumo com quantidade válida." });
      }

      const overheads = sanitizeProductionOverheads(req.body?.overheads);

      let product = null;
      if (req.body?.productId) {
        product = await prisma.product.findFirst({
          where: {
            id: String(req.body.productId),
            tenantId: tenant.id,
          },
          include: {
            inventoryItem: true,
          },
        });

        if (!product) {
          return res.status(400).json({ error: "Produto vinculado não encontrado neste estabelecimento." });
        }
      }

      const recipeRecord = await updateRecipeRecord(prisma, tenant.id, existingRecipe.id, {
        productId: product?.id || null,
        name,
        description: String(req.body?.description || "").trim() || null,
        outputQuantity: roundProductionValue(outputQuantity),
        outputUnit: normalizeProductionUnit(req.body?.outputUnit || "un"),
        instructions: String(req.body?.instructions || "").trim() || null,
        ingredients: JSON.stringify(ingredients),
        overheads: JSON.stringify(overheads),
        active: req.body?.active !== false,
      });

      if (!recipeRecord) {
        return res.status(503).json({ error: PRODUCTION_UNAVAILABLE_MESSAGE });
      }

      res.json(parseProductionRecipeRecord(recipeRecord));
    } catch (error) {
      if (isProductionInfrastructureError(error)) {
        return res.status(503).json({ error: PRODUCTION_UNAVAILABLE_MESSAGE });
      }

      console.error(error);
      res.status(500).json({ error: "Falha ao atualizar receita de produção." });
    }
  });

  app.delete("/api/tenants/:slug/production/recipes/:id", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "production");
    if (!tenant) return;

    try {
      const existingRecipe = hasModelDelegate(prisma, "productionRecipe")
        ? await prisma.productionRecipe.findFirst({
            where: {
              id: req.params.id,
              tenantId: tenant.id,
            },
          })
        : await findRecipeRecordRaw(prisma, tenant.id, req.params.id);

      if (!existingRecipe) {
        return res.status(404).json({ error: "Receita não encontrada." });
      }

      await deleteRecipeRecord(prisma, tenant.id, existingRecipe.id);
      res.sendStatus(200);
    } catch (error) {
      if (isProductionInfrastructureError(error)) {
        return res.status(503).json({ error: PRODUCTION_UNAVAILABLE_MESSAGE });
      }

      console.error(error);
      res.status(500).json({ error: "Falha ao remover receita de produção." });
    }
  });

  app.get("/api/tenants/:slug/production/runs", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "production");
    if (!tenant) return;

    try {
      res.json(await listRuns(prisma, tenant.id));
    } catch (error) {
      if (isProductionInfrastructureError(error)) {
        return res.json([]);
      }

      console.error(error);
      res.status(500).json({ error: "Falha ao buscar produções registradas." });
    }
  });

  app.post("/api/tenants/:slug/production/runs", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "production");
    if (!tenant) return;

    const recipeId = String(req.body?.recipeId || "");
    const quantityProduced = Number(req.body?.quantityProduced || 0);

    if (!recipeId) {
      return res.status(400).json({ error: "Selecione uma receita para registrar a produção." });
    }

    if (!Number.isFinite(quantityProduced) || quantityProduced <= 0) {
      return res.status(400).json({ error: "Informe uma quantidade válida para produzir." });
    }

    try {
      const createdByName = currentAccount(req)?.name || null;
      const notes = String(req.body?.notes || "").trim() || null;

      const operation = hasModelDelegate(prisma, "productionRecipe") && hasModelDelegate(prisma, "productionRun")
        ? await prisma.$transaction(async (tx: any) => {
            const recipeRecord = await tx.productionRecipe.findFirst({
              where: {
                id: recipeId,
                tenantId: tenant.id,
              },
              include: {
                product: {
                  include: {
                    inventoryItem: true,
                  },
                },
              },
            });

            if (!recipeRecord) {
              throw new Error("PRODUCTION_RECIPE_NOT_FOUND");
            }

            const recipe = parseProductionRecipeRecord(recipeRecord);
            const ingredientIds = recipe.ingredients.map((ingredient) => ingredient.inventoryItemId);
            const inventoryItems = ingredientIds.length > 0
              ? await tx.inventoryItem.findMany({
                  where: {
                    tenantId: tenant.id,
                    id: { in: ingredientIds },
                  },
                })
              : [];

            const simulation = buildProductionSimulation(recipeRecord, inventoryItems, quantityProduced);

            if (simulation.ingredients.some((ingredient) => !ingredient.available || !ingredient.canConvert)) {
              throw new ProductionValidationError(
                "Estoque insuficiente ou unidade incompatível para concluir esta produção.",
                simulation,
              );
            }

            const inventoryEvents: Array<{ id: string; quantity: number }> = [];
            const productEvents: Array<{ id: string; available: boolean }> = [];
            const ingredientSnapshots = [];

            for (const ingredient of simulation.ingredients) {
              if (!ingredient.convertedQuantity || ingredient.convertedQuantity <= 0) continue;

              const updatedItem = await tx.inventoryItem.update({
                where: { id: ingredient.inventoryItemId },
                data: {
                  quantity: { decrement: ingredient.convertedQuantity },
                  movements: {
                    create: {
                      type: "OUT",
                      quantity: ingredient.convertedQuantity,
                      reason: "PRODUCTION",
                    },
                  },
                },
              });

              inventoryEvents.push({ id: updatedItem.id, quantity: updatedItem.quantity });
              ingredientSnapshots.push({
                ...ingredient,
                stockAfter: updatedItem.quantity,
              });
            }

            let outputSnapshot = simulation.outputSnapshot ? { ...simulation.outputSnapshot } : null;

            if (outputSnapshot?.canRestock && outputSnapshot.inventoryItemId && outputSnapshot.convertedQuantity) {
              const outputItem = await tx.inventoryItem.findUnique({
                where: { id: outputSnapshot.inventoryItemId },
              });

              if (!outputItem) {
                outputSnapshot = {
                  ...outputSnapshot,
                  canRestock: false,
                  message: "Item de estoque final não encontrado para entrada automática.",
                };
              } else {
                const incrementQuantity = Number(outputSnapshot.convertedQuantity || 0);
                const batchUnitCost = incrementQuantity > 0
                  ? roundProductionValue(simulation.totalCost / incrementQuantity)
                  : Number(outputItem.purchasePrice || 0);
                const currentQuantity = Number(outputItem.quantity || 0);
                const currentUnitCost = Number(outputItem.purchasePrice || 0);
                const averageUnitCost = currentQuantity > 0
                  ? roundProductionValue(
                      ((currentQuantity * currentUnitCost) + (incrementQuantity * batchUnitCost)) /
                        (currentQuantity + incrementQuantity),
                    )
                  : batchUnitCost;

                const updatedOutputItem = await tx.inventoryItem.update({
                  where: { id: outputItem.id },
                  data: {
                    quantity: { increment: incrementQuantity },
                    purchasePrice: averageUnitCost,
                    movements: {
                      create: {
                        type: "IN",
                        quantity: incrementQuantity,
                        reason: "PRODUCTION",
                      },
                    },
                  },
                });

                outputSnapshot = {
                  ...outputSnapshot,
                  stockBefore: outputItem.quantity,
                  stockAfter: updatedOutputItem.quantity,
                };

                inventoryEvents.push({ id: updatedOutputItem.id, quantity: updatedOutputItem.quantity });

                if (recipeRecord.productId) {
                  const linkedProduct = await tx.product.findUnique({
                    where: { id: recipeRecord.productId },
                  });

                  if (linkedProduct && !linkedProduct.available && linkedProduct.autoDisableWhenOutOfStock) {
                    await tx.product.update({
                      where: { id: linkedProduct.id },
                      data: { available: true },
                    });

                    productEvents.push({ id: linkedProduct.id, available: true });
                  }
                }
              }
            }

            const productionRun = await tx.productionRun.create({
              data: {
                tenantId: tenant.id,
                recipeId: recipe.id,
                recipeName: recipe.name,
                batchCode: makeProductionBatchCode(),
                quantityProduced: simulation.quantityProduced,
                unit: simulation.outputUnit,
                notes,
                createdByName,
                totalIngredientCost: simulation.totalIngredientCost,
                totalOverheadCost: simulation.totalOverheadCost,
                totalCost: simulation.totalCost,
                costPerOutput: simulation.costPerOutput,
                ingredientsSnapshot: JSON.stringify(ingredientSnapshots),
                overheadsSnapshot: JSON.stringify(simulation.overheads),
                outputSnapshot: outputSnapshot ? JSON.stringify(outputSnapshot) : null,
              },
              include: {
                recipe: {
                  include: {
                    product: {
                      include: {
                        inventoryItem: true,
                      },
                    },
                  },
                },
              },
            });

            return {
              inventoryEvents,
              productEvents,
              productionRun,
            };
          })
        : await createRunRecordRaw({
            prisma,
            tenantId: tenant.id,
            recipeId,
            quantityProduced,
            notes,
            createdByName,
          });

      for (const inventoryEvent of operation.inventoryEvents) {
        io.to(`tenant-${tenant.id}`).emit("inventory-update", inventoryEvent);
      }

      for (const productEvent of operation.productEvents) {
        io.to(`tenant-${tenant.id}`).emit("product-availability-changed", productEvent);
        // "product-availability-changed" sozinho não tinha listener nenhum no front —
        // o Dashboard já recarrega a árvore do tenant ao ouvir "menu-updated".
        io.to(`tenant-${tenant.id}`).emit("menu-updated", { tenantId: tenant.id });
      }

      res.json(parseProductionRunRecord(operation.productionRun));
    } catch (error) {
      if (error instanceof ProductionValidationError) {
        return res.status(400).json({
          error: error.message,
          simulation: error.simulation,
        });
      }

      if (error instanceof Error && error.message === "PRODUCTION_RECIPE_NOT_FOUND") {
        return res.status(404).json({ error: "Receita de produção não encontrada." });
      }

      if (isProductionInfrastructureError(error)) {
        return res.status(503).json({ error: PRODUCTION_UNAVAILABLE_MESSAGE });
      }

      console.error(error);
      res.status(500).json({ error: "Falha ao registrar produção." });
    }
  });
}
