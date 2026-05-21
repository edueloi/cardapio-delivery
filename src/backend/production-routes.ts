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
  ) => Promise<any | null>;
  currentAccount: (req: Request) => { name?: string | null } | null;
}

export function registerProductionRoutes({
  app,
  io,
  prisma,
  requireAuth,
  requireTenantBySlug,
  currentAccount,
}: RegisterProductionRoutesOptions) {
  app.post("/api/tenants/:slug/production/recipes", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug);
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
        ? Array.from(new Set(
            req.body.ingredients
              .map((ingredient: any) => String(ingredient?.inventoryItemId || ""))
              .filter(Boolean),
          ))
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

      const recipe = await prisma.productionRecipe.create({
        data: {
          tenantId: tenant.id,
          productId: product?.id || null,
          name,
          description: String(req.body?.description || "").trim() || null,
          outputQuantity: roundProductionValue(outputQuantity),
          outputUnit: normalizeProductionUnit(req.body?.outputUnit || "un"),
          instructions: String(req.body?.instructions || "").trim() || null,
          ingredients: JSON.stringify(ingredients),
          overheads: JSON.stringify(overheads),
          active: req.body?.active !== false,
        },
        include: {
          product: {
            include: {
              inventoryItem: true,
            },
          },
        },
      });

      res.json(parseProductionRecipeRecord(recipe));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao criar receita de produção." });
    }
  });

  app.patch("/api/tenants/:slug/production/recipes/:id", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug);
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
      const existingRecipe = await prisma.productionRecipe.findFirst({
        where: {
          id: req.params.id,
          tenantId: tenant.id,
        },
      });

      if (!existingRecipe) {
        return res.status(404).json({ error: "Receita não encontrada." });
      }

      const ingredientIds = Array.isArray(req.body?.ingredients)
        ? Array.from(new Set(
            req.body.ingredients
              .map((ingredient: any) => String(ingredient?.inventoryItemId || ""))
              .filter(Boolean),
          ))
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

      const recipe = await prisma.productionRecipe.update({
        where: { id: existingRecipe.id },
        data: {
          productId: product?.id || null,
          name,
          description: String(req.body?.description || "").trim() || null,
          outputQuantity: roundProductionValue(outputQuantity),
          outputUnit: normalizeProductionUnit(req.body?.outputUnit || "un"),
          instructions: String(req.body?.instructions || "").trim() || null,
          ingredients: JSON.stringify(ingredients),
          overheads: JSON.stringify(overheads),
          active: req.body?.active !== false,
        },
        include: {
          product: {
            include: {
              inventoryItem: true,
            },
          },
        },
      });

      res.json(parseProductionRecipeRecord(recipe));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao atualizar receita de produção." });
    }
  });

  app.delete("/api/tenants/:slug/production/recipes/:id", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug);
    if (!tenant) return;

    try {
      const existingRecipe = await prisma.productionRecipe.findFirst({
        where: {
          id: req.params.id,
          tenantId: tenant.id,
        },
      });

      if (!existingRecipe) {
        return res.status(404).json({ error: "Receita não encontrada." });
      }

      await prisma.productionRecipe.delete({
        where: { id: existingRecipe.id },
      });

      res.sendStatus(200);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao remover receita de produção." });
    }
  });

  app.get("/api/tenants/:slug/production/runs", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug);
    if (!tenant) return;

    try {
      const runs = await prisma.productionRun.findMany({
        where: { tenantId: tenant.id },
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

      res.json(runs.map(parseProductionRunRecord));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao buscar produções registradas." });
    }
  });

  app.post("/api/tenants/:slug/production/runs", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug);
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
      const operation = await prisma.$transaction(async (tx: any) => {
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
            notes: String(req.body?.notes || "").trim() || null,
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
      });

      for (const inventoryEvent of operation.inventoryEvents) {
        io.to(`tenant-${tenant.id}`).emit("inventory-update", inventoryEvent);
      }

      for (const productEvent of operation.productEvents) {
        io.to(`tenant-${tenant.id}`).emit("product-availability-changed", productEvent);
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

      console.error(error);
      res.status(500).json({ error: "Falha ao registrar produção." });
    }
  });
}
