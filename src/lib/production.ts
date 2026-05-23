import type {
  InventoryItem,
  Product,
  ProductionOverheadMode,
  ProductionOverheadType,
  ProductionRecipe,
  ProductionRunIngredientSnapshot,
  ProductionRunOverheadSnapshot,
  ProductionSimulation,
  ProductionOutputSnapshot,
} from "../types";

type UnitDimension = "mass" | "volume" | "count" | "length";

interface UnitDefinition {
  canonical: string;
  dimension: UnitDimension;
  toBase: number;
}

const UNIT_DEFINITIONS: Record<string, UnitDefinition> = {
  g: { canonical: "g", dimension: "mass", toBase: 1 },
  gr: { canonical: "g", dimension: "mass", toBase: 1 },
  grama: { canonical: "g", dimension: "mass", toBase: 1 },
  gramas: { canonical: "g", dimension: "mass", toBase: 1 },
  kg: { canonical: "kg", dimension: "mass", toBase: 1000 },
  kilo: { canonical: "kg", dimension: "mass", toBase: 1000 },
  quilo: { canonical: "kg", dimension: "mass", toBase: 1000 },
  kilograma: { canonical: "kg", dimension: "mass", toBase: 1000 },
  kilogramas: { canonical: "kg", dimension: "mass", toBase: 1000 },
  mg: { canonical: "mg", dimension: "mass", toBase: 0.001 },
  ml: { canonical: "ml", dimension: "volume", toBase: 1 },
  mililitro: { canonical: "ml", dimension: "volume", toBase: 1 },
  mililitros: { canonical: "ml", dimension: "volume", toBase: 1 },
  l: { canonical: "l", dimension: "volume", toBase: 1000 },
  litro: { canonical: "l", dimension: "volume", toBase: 1000 },
  litros: { canonical: "l", dimension: "volume", toBase: 1000 },
  un: { canonical: "un", dimension: "count", toBase: 1 },
  und: { canonical: "un", dimension: "count", toBase: 1 },
  unidade: { canonical: "un", dimension: "count", toBase: 1 },
  unidades: { canonical: "un", dimension: "count", toBase: 1 },
  pc: { canonical: "un", dimension: "count", toBase: 1 },
  pcs: { canonical: "un", dimension: "count", toBase: 1 },
  dz: { canonical: "dz", dimension: "count", toBase: 12 },
  duzia: { canonical: "dz", dimension: "count", toBase: 12 },
  dúzia: { canonical: "dz", dimension: "count", toBase: 12 },
  cm: { canonical: "cm", dimension: "length", toBase: 1 },
  m: { canonical: "m", dimension: "length", toBase: 100 },
  metro: { canonical: "m", dimension: "length", toBase: 100 },
  metros: { canonical: "m", dimension: "length", toBase: 100 },
};

export const PRODUCTION_UNIT_SUGGESTIONS = [
  "g",
  "kg",
  "ml",
  "l",
  "un",
  "dz",
  "cm",
  "m",
];

export const PRODUCTION_OVERHEAD_TYPE_OPTIONS: Array<{ value: ProductionOverheadType; label: string }> = [
  { value: "ENERGIA", label: "Energia" },
  { value: "AGUA", label: "Água" },
  { value: "GAS", label: "Gás" },
  { value: "MAO_DE_OBRA", label: "Mão de obra" },
  { value: "EMBALAGEM", label: "Embalagem" },
  { value: "OUTROS", label: "Outros" },
];

export const PRODUCTION_OVERHEAD_MODE_OPTIONS: Array<{ value: ProductionOverheadMode; label: string }> = [
  { value: "PER_RECIPE", label: "Por receita base" },
  { value: "PER_OUTPUT_UNIT", label: "Por unidade produzida" },
];

function normalizeKey(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getUnitDefinition(unit?: string | null) {
  return UNIT_DEFINITIONS[normalizeKey(unit)] ?? null;
}

export function normalizeProductionUnit(unit?: string | null) {
  const normalized = normalizeKey(unit);
  return UNIT_DEFINITIONS[normalized]?.canonical || (normalized || "un");
}

export function roundProductionValue(value: number, decimals = 6) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

export function convertProductionQuantity(
  value: number,
  fromUnit?: string | null,
  toUnit?: string | null,
) {
  if (!Number.isFinite(value)) return null;

  const fromCanonical = normalizeProductionUnit(fromUnit);
  const toCanonical = normalizeProductionUnit(toUnit);

  if (fromCanonical === toCanonical) return roundProductionValue(value);

  const fromDefinition = getUnitDefinition(fromCanonical);
  const toDefinition = getUnitDefinition(toCanonical);

  if (!fromDefinition || !toDefinition || fromDefinition.dimension !== toDefinition.dimension) {
    return null;
  }

  const baseValue = value * fromDefinition.toBase;
  return roundProductionValue(baseValue / toDefinition.toBase);
}

function getInventoryItemCost(item?: InventoryItem | null) {
  return Number(item?.purchasePrice || 0);
}

/**
 * Retorna a quantidade disponível do item na unidade granular (stockUnit).
 * Se o item tem conversão configurada (purchaseQty + stockUnit), multiplica:
 *   qty_compra * purchaseQty = qty em stockUnit
 * Caso contrário, retorna quantity como está (na unit normal).
 */
export function getInventoryStockInGranularUnit(item: InventoryItem): {
  stockQty: number;
  effectiveUnit: string;
} {
  const hasConversion = item.purchaseQty && item.stockUnit;
  if (hasConversion) {
    return {
      stockQty: Number(item.quantity) * Number(item.purchaseQty),
      effectiveUnit: normalizeProductionUnit(item.stockUnit),
    };
  }
  return {
    stockQty: Number(item.quantity),
    effectiveUnit: normalizeProductionUnit(item.unit || "un"),
  };
}

/**
 * Custo por unidade granular.
 * Se item tem conversão: custo da unidade de compra dividido pelo conteúdo.
 * Ex: garrafa de óleo custa R$8, tem 1000ml → custo por ml = R$0,008
 */
export function getInventoryUnitCostGranular(item: InventoryItem): number {
  const cost = Number(item.purchasePrice || 0);
  if (item.purchaseQty && Number(item.purchaseQty) > 0 && item.stockUnit) {
    return cost / Number(item.purchaseQty);
  }
  return cost;
}

function getRecipeFactor(recipe: ProductionRecipe, quantityProduced: number) {
  const baseOutput = Number(recipe.outputQuantity) > 0 ? Number(recipe.outputQuantity) : 1;
  const safeOutput = Number(quantityProduced) > 0 ? Number(quantityProduced) : baseOutput;
  return {
    baseOutput,
    quantityProduced: safeOutput,
    factor: safeOutput / baseOutput,
  };
}

function buildOutputSnapshot(
  recipe: ProductionRecipe,
  linkedProduct: Product | null | undefined,
  quantityProduced: number,
  totalCost: number,
): ProductionOutputSnapshot | null {
  if (!linkedProduct) return null;

  const requestedUnit = normalizeProductionUnit(recipe.outputUnit || linkedProduct.inventoryItem?.stockUnit || linkedProduct.inventoryItem?.unit || "un");
  const requestedQuantity = roundProductionValue(quantityProduced);

  if (!linkedProduct.inventoryItem) {
    return {
      productId: linkedProduct.id,
      productName: linkedProduct.name,
      requestedQuantity,
      requestedUnit,
      convertedQuantity: null,
      canRestock: false,
      message: "Vincule um item de estoque ao produto para dar entrada automática no estoque final.",
    };
  }

  // Usa stockUnit (granular) se configurado, senão usa unit normal
  const inventoryUnit = normalizeProductionUnit(
    linkedProduct.inventoryItem.stockUnit || linkedProduct.inventoryItem.unit || requestedUnit
  );
  const convertedQuantity = convertProductionQuantity(requestedQuantity, requestedUnit, inventoryUnit);

  const { stockQty: stockBeforeGranular } = getInventoryStockInGranularUnit(linkedProduct.inventoryItem);

  if (convertedQuantity === null) {
    return {
      inventoryItemId: linkedProduct.inventoryItem.id,
      inventoryItemName: linkedProduct.inventoryItem.name,
      productId: linkedProduct.id,
      productName: linkedProduct.name,
      requestedQuantity,
      requestedUnit,
      convertedQuantity: null,
      inventoryUnit,
      stockBefore: stockBeforeGranular,
      stockAfter: stockBeforeGranular,
      canRestock: false,
      message: `Não foi possível converter ${requestedUnit} para ${inventoryUnit} no estoque do produto final.`,
    };
  }

  return {
    inventoryItemId: linkedProduct.inventoryItem.id,
    inventoryItemName: linkedProduct.inventoryItem.name,
    productId: linkedProduct.id,
    productName: linkedProduct.name,
    requestedQuantity,
    requestedUnit,
    convertedQuantity,
    inventoryUnit,
    stockBefore: stockBeforeGranular,
    stockAfter: roundProductionValue(stockBeforeGranular + convertedQuantity),
    unitCostApplied: requestedQuantity > 0 ? roundProductionValue(totalCost / requestedQuantity) : 0,
    canRestock: true,
  };
}

export function calculateProductionSimulation({
  recipe,
  inventoryItems,
  quantityProduced,
  linkedProduct,
}: {
  recipe: ProductionRecipe;
  inventoryItems: InventoryItem[];
  quantityProduced: number;
  linkedProduct?: Product | null;
}): ProductionSimulation {
  const inventoryMap = new Map(inventoryItems.map((item) => [item.id, item]));
  const { factor, quantityProduced: safeQuantityProduced } = getRecipeFactor(recipe, quantityProduced);

  const ingredients: ProductionRunIngredientSnapshot[] = recipe.ingredients.map((ingredient) => {
    const item = inventoryMap.get(ingredient.inventoryItemId);

    // Determina a unidade efetiva do estoque (granular se tiver conversão)
    const { stockQty: stockBefore, effectiveUnit: inventoryUnit } = item
      ? getInventoryStockInGranularUnit(item)
      : { stockQty: 0, effectiveUnit: normalizeProductionUnit(ingredient.unit || "un") };

    const requestedUnit = normalizeProductionUnit(ingredient.unit || inventoryUnit || "un");
    const requestedQuantity = roundProductionValue(Number(ingredient.quantity || 0) * factor);
    const convertedQuantity = item
      ? convertProductionQuantity(requestedQuantity, requestedUnit, inventoryUnit)
      : null;
    const stockAfter = convertedQuantity === null
      ? stockBefore
      : roundProductionValue(stockBefore - convertedQuantity);
    const shortageQuantity = convertedQuantity === null
      ? requestedQuantity
      : roundProductionValue(Math.max(0, convertedQuantity - stockBefore));

    // Custo por unidade granular (se garrafa de 1L custa R$8, então ml = R$0,008)
    const unitCost = item ? getInventoryUnitCostGranular(item) : 0;
    const totalCost = convertedQuantity === null ? 0 : roundProductionValue(convertedQuantity * unitCost);
    const canConvert = convertedQuantity !== null;
    const available = !!item && canConvert && stockBefore + 0.000001 >= convertedQuantity;

    let message: string | null = null;
    if (!item) {
      message = "Insumo não encontrado no estoque.";
    } else if (!canConvert) {
      message = `Não foi possível converter ${requestedUnit} para ${inventoryUnit}.`;
    } else if (!available) {
      message = `Faltam ${shortageQuantity} ${inventoryUnit} para concluir esta produção.`;
    }

    return {
      ...ingredient,
      unit: requestedUnit,
      inventoryUnit,
      requestedQuantity,
      convertedQuantity,
      stockBefore,
      stockAfter,
      unitCost,
      totalCost,
      shortageQuantity,
      canConvert,
      available,
      message,
    };
  });

  const overheads: ProductionRunOverheadSnapshot[] = (recipe.overheads || []).map((overhead) => {
    const totalCost = overhead.calculationMode === "PER_OUTPUT_UNIT"
      ? roundProductionValue(overhead.cost * safeQuantityProduced)
      : roundProductionValue(overhead.cost * factor);

    return {
      ...overhead,
      totalCost,
    };
  });

  const totalIngredientCost = roundProductionValue(
    ingredients.reduce((sum, ingredient) => sum + ingredient.totalCost, 0),
  );
  const totalOverheadCost = roundProductionValue(
    overheads.reduce((sum, overhead) => sum + overhead.totalCost, 0),
  );
  const totalCost = roundProductionValue(totalIngredientCost + totalOverheadCost);
  const costPerOutput = safeQuantityProduced > 0
    ? roundProductionValue(totalCost / safeQuantityProduced)
    : 0;

  const outputSnapshot = buildOutputSnapshot(
    recipe,
    linkedProduct ?? recipe.product ?? null,
    safeQuantityProduced,
    totalCost,
  );

  const missingItems = ingredients.filter((ingredient) => !ingredient.available).length;

  return {
    factor: roundProductionValue(factor),
    quantityProduced: safeQuantityProduced,
    outputUnit: normalizeProductionUnit(recipe.outputUnit || "un"),
    totalIngredientCost,
    totalOverheadCost,
    totalCost,
    costPerOutput,
    hasIssues: missingItems > 0 || !!outputSnapshot?.message,
    missingItems,
    ingredients,
    overheads,
    outputSnapshot,
  };
}

export function makeProductionBatchCode(date = new Date()) {
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ];
  const time = [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("");

  return `PRD-${parts.join("")}-${time}`;
}
