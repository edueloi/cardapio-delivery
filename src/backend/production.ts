import {
  calculateProductionSimulation,
  normalizeProductionUnit,
  roundProductionValue,
} from "../lib/production";
import type {
  InventoryItem,
  ProductionRecipe,
  ProductionRecipeIngredient,
  ProductionRecipeOverhead,
  ProductionRun,
  ProductionRunIngredientSnapshot,
  ProductionRunOverheadSnapshot,
  ProductionSimulation,
} from "../types";

const ALLOWED_OVERHEAD_TYPES = new Set([
  "ENERGIA",
  "AGUA",
  "GAS",
  "MAO_DE_OBRA",
  "EMBALAGEM",
  "OUTROS",
]);

const ALLOWED_OVERHEAD_MODES = new Set([
  "PER_RECIPE",
  "PER_OUTPUT_UNIT",
]);

function parseJsonArray<T>(value?: string | null): T[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T>(value?: string | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function randomRowId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class ProductionValidationError extends Error {
  simulation?: ProductionSimulation;

  constructor(message: string, simulation?: ProductionSimulation) {
    super(message);
    this.name = "ProductionValidationError";
    this.simulation = simulation;
  }
}

export function sanitizeProductionIngredients(
  rawIngredients: unknown,
  inventoryItems: InventoryItem[],
): ProductionRecipeIngredient[] {
  if (!Array.isArray(rawIngredients)) return [];

  const inventoryMap = new Map(inventoryItems.map((item) => [item.id, item]));

  return rawIngredients
    .map((raw) => {
      const inventoryItemId = String((raw as any)?.inventoryItemId || "");
      const item = inventoryMap.get(inventoryItemId);
      const quantity = Number((raw as any)?.quantity || 0);

      if (!item || !Number.isFinite(quantity) || quantity <= 0) {
        return null;
      }

      const notes = String((raw as any)?.notes || "").trim();

      return {
        id: String((raw as any)?.id || randomRowId("ing")),
        inventoryItemId: item.id,
        itemName: item.name,
        quantity: roundProductionValue(quantity),
        unit: normalizeProductionUnit((raw as any)?.unit || item.unit || "un"),
        notes: notes || null,
      } satisfies ProductionRecipeIngredient;
    })
    .filter(Boolean) as ProductionRecipeIngredient[];
}

export function sanitizeProductionOverheads(rawOverheads: unknown): ProductionRecipeOverhead[] {
  if (!Array.isArray(rawOverheads)) return [];

  return rawOverheads
    .map((raw) => {
      const label = String((raw as any)?.label || "").trim();
      const type = String((raw as any)?.type || "").trim().toUpperCase();
      const calculationMode = String((raw as any)?.calculationMode || "").trim().toUpperCase();
      const cost = Number((raw as any)?.cost || 0);
      const notes = String((raw as any)?.notes || "").trim();

      if (!label || !ALLOWED_OVERHEAD_TYPES.has(type) || !ALLOWED_OVERHEAD_MODES.has(calculationMode)) {
        return null;
      }

      if (!Number.isFinite(cost) || cost < 0) {
        return null;
      }

      return {
        id: String((raw as any)?.id || randomRowId("cost")),
        label,
        type: type as ProductionRecipeOverhead["type"],
        cost: roundProductionValue(cost),
        calculationMode: calculationMode as ProductionRecipeOverhead["calculationMode"],
        notes: notes || null,
      } satisfies ProductionRecipeOverhead;
    })
    .filter(Boolean) as ProductionRecipeOverhead[];
}

export function parseProductionRecipeRecord(record: any): ProductionRecipe {
  return {
    id: record.id,
    tenantId: record.tenantId,
    productId: record.productId || null,
    name: record.name,
    description: record.description || null,
    outputQuantity: Number(record.outputQuantity || 0),
    outputUnit: normalizeProductionUnit(record.outputUnit || "un"),
    instructions: record.instructions || null,
    ingredients: parseJsonArray<ProductionRecipeIngredient>(record.ingredients),
    overheads: parseJsonArray<ProductionRecipeOverhead>(record.overheads),
    active: !!record.active,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    product: record.product || null,
  };
}

export function parseProductionRunRecord(record: any): ProductionRun {
  return {
    id: record.id,
    tenantId: record.tenantId,
    recipeId: record.recipeId || null,
    recipeName: record.recipeName,
    batchCode: record.batchCode,
    quantityProduced: Number(record.quantityProduced || 0),
    unit: normalizeProductionUnit(record.unit || "un"),
    notes: record.notes || null,
    createdByName: record.createdByName || null,
    totalIngredientCost: Number(record.totalIngredientCost || 0),
    totalOverheadCost: Number(record.totalOverheadCost || 0),
    totalCost: Number(record.totalCost || 0),
    costPerOutput: Number(record.costPerOutput || 0),
    ingredientsSnapshot: parseJsonArray<ProductionRunIngredientSnapshot>(record.ingredientsSnapshot),
    overheadsSnapshot: parseJsonArray<ProductionRunOverheadSnapshot>(record.overheadsSnapshot),
    outputSnapshot: parseJsonObject(record.outputSnapshot),
    createdAt: record.createdAt,
    recipe: record.recipe ? parseProductionRecipeRecord(record.recipe) : null,
  };
}

export function buildProductionSimulation(
  recipeRecord: any,
  inventoryItems: InventoryItem[],
  quantityProduced: number,
) {
  const recipe = parseProductionRecipeRecord(recipeRecord);

  return calculateProductionSimulation({
    recipe,
    inventoryItems,
    quantityProduced,
    linkedProduct: recipe.product ?? null,
  });
}
