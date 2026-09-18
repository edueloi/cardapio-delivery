import type { Server } from "socket.io";
import {
  convertProductionQuantity,
  getInventoryStockInGranularUnit,
} from "../../lib/production";
import {
  sendOrderStatusMessage,
  sendLoyaltyPointsMessage,
  sendLowStockAlert,
  sendReceiptPdfMessage,
} from "../wpp/messages";

// Valida os adicionais escolhidos pelo cliente contra a lista real de adicionais do
// produto (nunca confia em preço nem vínculo de estoque vindo do client, só no id
// selecionado) — usado no pedido público e no PDV pra fixar o preço final e decidir o
// que dar baixa no estoque (ex: adicional "Embalagem de viagem" vinculado a um insumo).
export type ResolvedExtraStockLink = {
  inventoryItemId: string;
  quantity: number;
  unit?: string;
};
export type ResolvedExtra = {
  id: string;
  label: string;
  price: number;
  stockLinks?: ResolvedExtraStockLink[];
  autoApplyOnTakeout?: boolean;
};
export function resolveSelectedExtras(
  productExtrasRaw: string | null | undefined,
  selectedFromClient: any,
  consumptionType?: string | null
): ResolvedExtra[] {
  let productExtras: any[] = [];
  try {
    productExtras = productExtrasRaw ? JSON.parse(productExtrasRaw) : [];
  } catch {
    return [];
  }
  const extrasById = new Map(productExtras.map((e: any) => [e.id, e]));
  const selectedIds = new Set<string>(
    Array.isArray(selectedFromClient)
      ? selectedFromClient
          .map((sel: any) => (sel && typeof sel === "object" ? sel.id : sel))
          .filter(Boolean)
      : []
  );
  // Pedido "para viagem" aplica sozinho os adicionais marcados como autoApplyOnTakeout
  // (ex: embalagem) mesmo que ninguém tenha selecionado manualmente — Set evita duplicar
  // caso o cliente também tenha selecionado o mesmo adicional.
  if (consumptionType === "TAKEOUT") {
    for (const def of productExtras) {
      if (def?.autoApplyOnTakeout && def.id) selectedIds.add(def.id);
    }
  }
  const resolved: ResolvedExtra[] = [];
  for (const id of selectedIds) {
    const def = extrasById.get(id);
    if (!def) continue;
    // stockLinks é o formato atual (vários itens por adicional); produto salvo antes
    // dessa mudança só tem o vínculo único legado (inventoryItemId/Quantity/Unit).
    const stockLinks: ResolvedExtraStockLink[] = Array.isArray(def.stockLinks) && def.stockLinks.length > 0
      ? def.stockLinks
          .filter((l: any) => l?.inventoryItemId)
          .map((l: any) => ({ inventoryItemId: l.inventoryItemId, quantity: Number(l.quantity) || 0, unit: l.unit || undefined }))
      : def.inventoryItemId
        ? [{ inventoryItemId: def.inventoryItemId, quantity: def.inventoryQuantity != null ? Number(def.inventoryQuantity) : 0, unit: def.inventoryUnit || undefined }]
        : [];
    resolved.push({
      id: def.id,
      label: def.label,
      price: Number(def.price) || 0,
      stockLinks: stockLinks.length > 0 ? stockLinks : undefined,
      autoApplyOnTakeout: def.autoApplyOnTakeout || undefined,
    });
  }
  return resolved;
}

// Produtos podem ser excluídos de vez do catálogo (product_id vira NULL em order_items,
// ver migration add_order_items_product_name) — aqui preenchemos de volta item.product.name
// a partir do snapshot productName gravado no momento da venda, pra nenhuma tela (Histórico,
// KDS, Garçom, WhatsApp, PDV) precisar saber da diferença entre produto vivo e removido.
export function hydrateOrderItemNames<T extends { items?: Array<{ product?: any; productName?: string | null }> }>(
  orderOrOrders: T | T[] | null | undefined
): T | T[] | null | undefined {
  const orders = Array.isArray(orderOrOrders) ? orderOrOrders : orderOrOrders ? [orderOrOrders] : [];
  for (const order of orders) {
    for (const item of order.items || []) {
      if (!item.product) {
        item.product = { name: item.productName || "Produto removido" };
      }
    }
  }
  return orderOrOrders;
}

export const roundMoney = (value: number) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function parsePaymentDetailSafe(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function splitAmountByCount(total: number, count: number) {
  const totalCents = Math.max(0, Math.round(total * 100));
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents % count;
  return Array.from(
    { length: count },
    (_unused, index) => (baseCents + (index === 0 ? remainderCents : 0)) / 100
  );
}

export function recalculateOpenOrderAmounts(
  order: any,
  nextItems: Array<{ quantity: number; price: number }>
) {
  const previousSubtotal = roundMoney(
    (order.items || []).reduce(
      (acc: number, item: any) =>
        acc + Number(item.price || 0) * Number(item.quantity || 0),
      0
    )
  );
  const subtotal = roundMoney(
    nextItems.reduce(
      (acc, item) => acc + Number(item.price || 0) * Number(item.quantity || 0),
      0
    )
  );

  let discountAmount = 0;
  if (Number(order.discount || 0) > 0) {
    if (order.discountType === "PERCENT" && previousSubtotal > 0) {
      const inferredPercent = Math.min(
        1,
        Math.max(0, Number(order.discount || 0) / previousSubtotal)
      );
      discountAmount = roundMoney(subtotal * inferredPercent);
    } else {
      discountAmount = roundMoney(
        Math.min(Number(order.discount || 0), subtotal)
      );
    }
  }

  const totalBeforeFee = roundMoney(Math.max(0, subtotal - discountAmount));
  const serviceFeePercent = Number(order.serviceFeePercent || 0);
  const serviceFeeAmount =
    serviceFeePercent > 0
      ? roundMoney(subtotal * (serviceFeePercent / 100))
      : 0;

  let feeAmount = 0;
  if (order.feePassedToCustomer) {
    if (Number(order.feePercent || 0) > 0) {
      feeAmount = roundMoney(
        totalBeforeFee * (Number(order.feePercent || 0) / 100)
      );
    } else if (totalBeforeFee > 0 && previousSubtotal > 0) {
      feeAmount = roundMoney(
        Number(order.feeAmount || 0) * (subtotal / previousSubtotal)
      );
    }
  }

  const total = roundMoney(totalBeforeFee + serviceFeeAmount + feeAmount);
  const paymentDetail = parsePaymentDetailSafe(order.paymentDetail);

  if (
    order.paymentMethod === "SPLIT" &&
    Array.isArray(paymentDetail?.splits) &&
    paymentDetail.splits.length > 0
  ) {
    const currentSplits = paymentDetail.splits;
    const redistributedAmounts = splitAmountByCount(
      total,
      currentSplits.length
    );
    paymentDetail.splits = currentSplits.map((split: any, index: number) => ({
      ...split,
      amount: redistributedAmounts[index],
    }));
  }

  return {
    subtotal,
    discountAmount,
    feeAmount,
    feePassedToCustomer: !!order.feePassedToCustomer,
    serviceFeeAmount,
    total,
    paymentDetail,
  };
}

// Converte uma quantidade pedida (na unidade do ingrediente/receita) para a unidade
// em que `InventoryItem.quantity` é armazenado (unidade de compra: garrafa, pacote, etc).
// Ex: receita pede "200 ml", item tem purchaseQty=1000 + stockUnit="ml" (1 garrafa = 1000ml)
// → 200ml / 1000 = 0.2 garrafa a debitar de `quantity`.
export function convertToPurchaseUnitQuantity(
  item: { unit?: string | null; purchaseQty?: number | null; stockUnit?: string | null },
  requestedQuantity: number,
  requestedUnit?: string | null
): number | null {
  if (!requestedUnit) return requestedQuantity;

  const { effectiveUnit } = getInventoryStockInGranularUnit(item as any);
  const granularQuantity = convertProductionQuantity(requestedQuantity, requestedUnit, effectiveUnit);
  if (granularQuantity === null) return null;

  const hasConversion = item.purchaseQty && item.stockUnit;
  return hasConversion ? granularQuantity / Number(item.purchaseQty) : granularQuantity;
}

export async function deductStockFIFO(
  tx: any,
  tenantId: string,
  baseInventoryItemId: string,
  quantityToDeduct: number,
  orderId: string,
  reason: string = "SALE",
  requestedUnit?: string | null
) {
  if (!baseInventoryItemId || quantityToDeduct <= 0) return [];

  const targetItem = await tx.inventoryItem
    .findUnique({ where: { id: baseInventoryItemId } })
    .catch(() => null);
  if (!targetItem) return [];

  const convertedQuantity = convertToPurchaseUnitQuantity(targetItem, quantityToDeduct, requestedUnit);
  if (convertedQuantity === null) return [];

  const batches = await tx.inventoryItem.findMany({
    where: { tenantId, name: targetItem.name },
  });

  batches.sort((a: any, b: any) => {
    if (a.expirationDate && !b.expirationDate) return -1;
    if (!a.expirationDate && b.expirationDate) return 1;
    if (a.expirationDate && b.expirationDate)
      return a.expirationDate.getTime() - b.expirationDate.getTime();
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  let remaining = convertedQuantity;
  const availableBatches = batches.filter((b: any) => b.quantity > 0);
  const batchesToDeduct =
    availableBatches.length > 0 ? availableBatches : [batches[0]];
  const updatedBatches = [];

  for (const batch of batchesToDeduct) {
    if (remaining <= 0) break;

    const deductQty =
      batch === batchesToDeduct[batchesToDeduct.length - 1]
        ? remaining
        : Math.min(remaining, batch.quantity);

    const updatedItem = await tx.inventoryItem.update({
      where: { id: batch.id },
      data: {
        quantity: { decrement: deductQty },
        movements: {
          create: {
            type: "OUT",
            quantity: deductQty,
            reason: reason,
            orderId,
          },
        },
      },
    });

    updatedBatches.push(updatedItem);
    remaining -= deductQty;
  }

  return updatedBatches;
}

export async function restockOrderItemInventory(
  tx: any,
  tenantId: string,
  orderId: string,
  baseInventoryItemId: string | null | undefined,
  quantity: number,
  outReason: string = "SALE",
  inReason: string = "ORDER_ITEM_REMOVED_SALE",
  requestedUnit?: string | null
) {
  if (!baseInventoryItemId || quantity <= 0) return false;

  const targetItem = await tx.inventoryItem
    .findUnique({ where: { id: baseInventoryItemId } })
    .catch(() => null);
  if (!targetItem) return false;

  const convertedQuantity = convertToPurchaseUnitQuantity(targetItem, quantity, requestedUnit);
  if (convertedQuantity === null) return false;

  const batches = await tx.inventoryItem.findMany({
    where: { tenantId, name: targetItem.name },
  });
  const batchIds = batches.map((b: any) => b.id);

  const movements = await tx.stockMovement.findMany({
    where: {
      orderId,
      itemId: { in: batchIds },
      reason: {
        in: [outReason, inReason, inReason.replace("REMOVED", "CANCELLED")],
      },
    },
    select: { itemId: true, type: true, quantity: true, reason: true },
  });

  const batchNetSold: Record<string, number> = {};
  for (const mov of movements) {
    if (!batchNetSold[mov.itemId]) batchNetSold[mov.itemId] = 0;
    if (mov.type === "OUT" && mov.reason === outReason)
      batchNetSold[mov.itemId] += Number(mov.quantity || 0);
    else if (mov.type === "IN" && mov.reason !== outReason)
      batchNetSold[mov.itemId] -= Number(mov.quantity || 0);
  }

  let remainingToRestock = roundMoney(convertedQuantity);
  let restockedAnything = false;

  for (const [batchId, netSold] of Object.entries(batchNetSold)) {
    if (remainingToRestock <= 0) break;

    if (netSold > 0) {
      const restockQty = Math.min(remainingToRestock, netSold);

      await tx.inventoryItem.update({
        where: { id: batchId },
        data: {
          quantity: { increment: restockQty },
          movements: {
            create: {
              type: "IN",
              quantity: restockQty,
              reason: inReason,
              orderId,
            },
          },
        },
      });
      remainingToRestock -= restockQty;
      restockedAnything = true;
    }
  }

  if (remainingToRestock > 0) {
    await tx.inventoryItem.update({
      where: { id: baseInventoryItemId },
      data: {
        quantity: { increment: remainingToRestock },
        movements: {
          create: {
            type: "IN",
            quantity: remainingToRestock,
            reason: inReason,
            orderId,
          },
        },
      },
    });
    restockedAnything = true;
  }

  return restockedAnything;
}

export async function restockOrderItemRecipe(
  tx: any,
  tenantId: string,
  orderId: string,
  product: any,
  removedQuantity: number
) {
  if (!product?.recipeId || removedQuantity <= 0) return [];

  const recipe = await tx.productionRecipe.findUnique({
    where: { id: product.recipeId },
  });
  if (!recipe || !recipe.outputQuantity || Number(recipe.outputQuantity) <= 0)
    return [];

  let ingredients: Array<{ inventoryItemId: string; quantity: number; unit?: string }> = [];
  try {
    ingredients = JSON.parse(recipe.ingredients as string) || [];
  } catch {
    ingredients = [];
  }

  const touchedInventoryIds: string[] = [];
  const ratio = removedQuantity / Number(recipe.outputQuantity);

  for (const ingredient of ingredients) {
    if (!ingredient.inventoryItemId || !ingredient.quantity) continue;

    const expectedQty = roundMoney(Number(ingredient.quantity) * ratio);
    if (expectedQty <= 0) continue;

    const restocked = await restockOrderItemInventory(
      tx,
      tenantId,
      orderId,
      ingredient.inventoryItemId,
      expectedQty,
      "PRODUCTION",
      "ORDER_ITEM_REMOVED_RECIPE",
      ingredient.unit
    );
    if (restocked) touchedInventoryIds.push(ingredient.inventoryItemId);
  }

  return touchedInventoryIds;
}

// Devolve ao estoque os insumos vinculados aos adicionais selecionados nesse item (ex:
// "Embalagem de viagem"), proporcional à quantidade removida — usado tanto no cancelamento
// do pedido inteiro quanto na redução de quantidade de um item numa comanda aberta.
export async function restockSelectedExtras(
  tx: any,
  tenantId: string,
  orderId: string,
  item: { selectedExtras?: string | null },
  removedQuantity: number
): Promise<string[]> {
  if (!item.selectedExtras || removedQuantity <= 0) return [];
  let extras: ResolvedExtra[] = [];
  try {
    extras = JSON.parse(item.selectedExtras) || [];
  } catch {
    return [];
  }
  const touched: string[] = [];
  for (const extra of extras) {
    for (const link of extra.stockLinks || []) {
      if (!link.inventoryItemId || !link.quantity) continue;
      const restocked = await restockOrderItemInventory(
        tx,
        tenantId,
        orderId,
        link.inventoryItemId,
        roundMoney(Number(link.quantity) * removedQuantity),
        "SALE",
        "ORDER_ITEM_REMOVED_SALE",
        link.unit
      );
      if (restocked) touched.push(link.inventoryItemId);
    }
  }
  return touched;
}

export async function restockCancelledOrder(tx: any, order: any) {
  const touchedInventoryIds = new Set<string>();

  for (const item of order.items || []) {
    const inventoryItemId = item.productVariantId
      ? item.productVariant?.inventoryItemId
      : item.product?.inventoryItemId;

    const directRestocked = await restockOrderItemInventory(
      tx,
      order.tenantId,
      order.id,
      inventoryItemId,
      Number(item.quantity || 0)
    );
    if (directRestocked && inventoryItemId)
      touchedInventoryIds.add(inventoryItemId);

    const recipeInventoryIds = await restockOrderItemRecipe(
      tx,
      order.tenantId,
      order.id,
      item.product,
      Number(item.quantity || 0)
    );
    for (const touchedId of recipeInventoryIds)
      touchedInventoryIds.add(touchedId);

    const extrasInventoryIds = await restockSelectedExtras(
      tx,
      order.tenantId,
      order.id,
      item,
      Number(item.quantity || 0)
    );
    for (const touchedId of extrasInventoryIds)
      touchedInventoryIds.add(touchedId);
  }

  return Array.from(touchedInventoryIds);
}

export interface OrderHelpersDeps {
  io: Server;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any;
  awardLoyaltyPoints: (
    tenantLoyaltyConfigRaw: string | null | undefined,
    customerId: string,
    orderTotal: number,
  ) => Promise<{ pointsEarned: number; newBalance: number } | null>;
}

/**
 * Efeitos colaterais de pedido/estoque compartilhados por vários domínios
 * (pedidos, cozinha, PDV, admin) — dependem de `io` e `prisma`, por isso vivem
 * numa factory em vez de funções soltas de módulo.
 */
export function createOrderHelpers({ io, prisma, awardLoyaltyPoints }: OrderHelpersDeps) {
  // Atualiza o status de um pedido e aplica os efeitos colaterais (baixa de estoque/produção,
  // notificação via socket e WhatsApp). Compartilhada entre a rota autenticada normal e o
  // painel de cozinha (que usa sua própria sessão, sem conta de usuário).
  async function updateOrderStatus(
    orderId: string,
    previousStatus: string,
    status: string,
    kitchenReady?: boolean
  ) {
    // Só considera "pronto na cozinha" quem de fato tem item que vai pra cozinha
    // (kitchenPrint: true) — pedidos só com itens de prateleira (ex: água, refrigerante)
    // não passam pela cozinha, então marcá-los como SHIPPED direto no Painel de
    // Pedidos não deveria disparar o alerta sonoro "Pronto na Cozinha".
    let forceKitchenReady = kitchenReady;
    if (status === "SHIPPED" || status === "DELIVERED") {
      const hasKitchenItem = await prisma.orderItem.findFirst({
        where: { orderId, product: { kitchenPrint: true } },
        select: { id: true },
      });
      forceKitchenReady = !!hasKitchenItem;
    }

    // Métricas de tempo de preparo/entrega — grava só na primeira vez que o pedido atinge
    // cada marco (nunca sobrescreve se já tinha valor), pra não distorcer o tempo caso o
    // pedido regrida de status e avance de novo.
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { readyAt: true, deliveredAt: true },
    });
    const isNowReady = (status === "SHIPPED" || forceKitchenReady === true) && !existingOrder?.readyAt;
    const isNowDelivered = status === "DELIVERED" && !existingOrder?.deliveredAt;

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        ...(forceKitchenReady !== undefined
          ? { kitchenReady: forceKitchenReady }
          : {}),
        ...(isNowReady ? { readyAt: new Date() } : {}),
        ...(isNowDelivered ? { deliveredAt: new Date() } : {}),
      },
      include: {
        tenant: true,
        items: {
          include: {
            product: true,
            productVariant: true,
          },
        },
      },
    });

    // Debita estoque ao entrar em preparo — ou, se o pedido pulou PREPARING e foi direto
    // para DELIVERED (ex: garçom marcando mesa como servida sem passar pelo KDS), debita
    // agora mesmo, pra garantir que a baixa aconteça uma única vez por pedido.
    const shouldDeductInventory =
      (status === "PREPARING" && previousStatus !== "PREPARING") ||
      (status === "DELIVERED" &&
        previousStatus !== "DELIVERED" &&
        previousStatus !== "PREPARING" &&
        previousStatus !== "SHIPPED");

    if (shouldDeductInventory) {
      for (const item of updatedOrder.items) {
        // Produto pode ter sido excluído do cardápio depois que o pedido foi feito —
        // sem produto não há o que debitar do estoque, mas isso não pode quebrar a
        // confirmação de entrega do pedido.
        if (!item.productVariantId && !item.product) continue;

        // Deduct direct inventory link
        let inventoryItemId = item.productVariantId
          ? (
              await prisma.productVariant.findUnique({
                where: { id: item.productVariantId },
              })
            )?.inventoryItemId
          : item.product?.inventoryItemId;

        if (inventoryItemId) {
          const beforeItem = await prisma.inventoryItem.findUnique({
            where: { id: inventoryItemId },
          });
          const updatedBatches = await deductStockFIFO(
            prisma,
            updatedOrder.tenantId,
            inventoryItemId,
            item.quantity,
            updatedOrder.id,
            "SALE"
          );

          if (updatedBatches.length > 0) {
            await handleStockBatchSideEffects(
              updatedOrder.tenantId,
              updatedOrder.tenant.whatsapp,
              updatedBatches,
              item.quantity
            );
          }
        }

        // Deduct production recipe ingredients when product is linked to a recipe
        const productRecipeId = (item.product as any)?.recipeId;
        if (productRecipeId) {
          const recipeRaw = await prisma.productionRecipe.findUnique({
            where: { id: productRecipeId },
          });
          if (recipeRaw && recipeRaw.outputQuantity > 0) {
            const ingredients: Array<{
              inventoryItemId: string;
              quantity: number;
              unit?: string;
            }> = (() => {
              try {
                return JSON.parse(recipeRaw.ingredients as string) || [];
              } catch {
                return [];
              }
            })();
            const ratio = item.quantity / recipeRaw.outputQuantity;
            for (const ingredient of ingredients) {
              if (!ingredient.inventoryItemId || !ingredient.quantity) continue;
              const deductQty = ingredient.quantity * ratio;
              const updatedBatches = await deductStockFIFO(
                prisma,
                updatedOrder.tenantId,
                ingredient.inventoryItemId,
                deductQty,
                updatedOrder.id,
                "PRODUCTION",
                ingredient.unit
              );
              if (updatedBatches.length > 0) {
                await handleStockBatchSideEffects(
                  updatedOrder.tenantId,
                  updatedOrder.tenant.whatsapp,
                  updatedBatches,
                  deductQty
                );
              }
            }
          }
        }

        await deductSelectedExtrasStock(
          updatedOrder.tenantId,
          updatedOrder.tenant.whatsapp,
          item,
          updatedOrder.id
        );
      }
    }

    io.to(`tenant-${updatedOrder.tenantId}`).emit(
      "order-status-updated",
      updatedOrder
    );
    await sendOrderStatusMessage(updatedOrder, updatedOrder.tenant).catch(
      () => undefined
    );

    // Avisa o garçom (em qualquer tela do sistema, não só no painel de cozinha) que a
    // comanda da mesa está pronta pra servir — configurável por loja em Configurações.
    if (
      status === "SHIPPED" &&
      previousStatus !== "SHIPPED" &&
      updatedOrder.orderType === "DINE_IN" &&
      (updatedOrder.tenant as any).waiterNotifyOnReady
    ) {
      io.to(`tenant-${updatedOrder.tenantId}`).emit("comanda-ready", {
        orderId: updatedOrder.id,
        tableId: updatedOrder.tableId,
        customerName: updatedOrder.customerName,
        operatorName: updatedOrder.operatorName,
      });
    }

    // Pedidos DINE_IN (comanda de garçom): "DELIVERED" aqui significa "prato servido",
    // não "conta paga" — o pagamento/faturamento da mesa é um pedido separado, lançado
    // pelo caixa/PDV completo (que já dá pontos na própria criação). Por isso pontos de
    // fidelidade só disparam nesta transição para pedidos que não são de mesa.
    if (
      status === "DELIVERED" &&
      previousStatus !== "DELIVERED" &&
      updatedOrder.orderType !== "DINE_IN" &&
      updatedOrder.customerId
    ) {
      const result = await awardLoyaltyPoints(
        updatedOrder.tenant.loyaltyConfig as string | null,
        updatedOrder.customerId,
        updatedOrder.total
      );
      if (result) {
        await sendLoyaltyPointsMessage(
          updatedOrder,
          updatedOrder.tenant,
          result.pointsEarned,
          result.newBalance
        ).catch(() => undefined);
      }
    }

    // Envia o recibo em PDF pro cliente quando o pedido é entregue (não aplica a comandas de mesa)
    if (
      status === "DELIVERED" &&
      previousStatus !== "DELIVERED" &&
      updatedOrder.orderType !== "DINE_IN"
    ) {
      await sendReceiptPdfMessage(updatedOrder, updatedOrder.tenant).catch(
        () => undefined
      );
    }

    // Avisa qualquer painel/dashboard aberto (Painel de Pedidos, PDV, outra aba) da
    // mudança de status — sem isso um pedido cancelado pelo painel da Cozinha (que
    // usa essa mesma função mas nunca emitia nada) ficava "preso" na coluna antiga
    // do Painel de Pedidos até a próxima atualização manual da página.
    io.to(`tenant-${updatedOrder.tenantId}`).emit(
      "order-status-updated",
      updatedOrder
    );

    return updatedOrder;
  }

  // Efeitos colaterais de uma baixa de estoque via `deductStockFIFO`: emite a atualização
  // de quantidade, dispara alerta de estoque mínimo e — se o total do lote (somando todos
  // os lotes com esse nome) zerou — desativa produtos vinculados que tenham
  // `autoDisableWhenOutOfStock` marcado. Extraído pra ser chamado tanto pela rota de status
  // do pedido (KDS) quanto pela criação direta de pedido no PDV, que antes não rodava essa
  // checagem e por isso um produto podia zerar por venda de balcão sem ser desativado.
  async function handleStockBatchSideEffects(
    tenantId: string,
    tenantWhatsapp: string | null | undefined,
    updatedBatches: { id: string; name: string; quantity: number; minStock: number | null; unit: string }[],
    deductedQuantity: number
  ) {
    if (updatedBatches.length === 0) return;

    const allBatchesNow = await prisma.inventoryItem.findMany({
      where: { tenantId, name: updatedBatches[0].name },
    });
    const totalQty = allBatchesNow.reduce((acc, b) => acc + b.quantity, 0);
    const beforeQty = totalQty + deductedQuantity;

    for (const b of updatedBatches) {
      io.to(`tenant-${tenantId}`).emit("inventory-update", {
        id: b.id,
        quantity: b.quantity,
      });
    }

    const minStock = updatedBatches[0].minStock;
    if (minStock != null && totalQty <= minStock && beforeQty > minStock) {
      sendLowStockAlert(
        tenantId,
        { whatsapp: tenantWhatsapp },
        {
          name: updatedBatches[0].name,
          quantity: totalQty,
          minStock: minStock,
          unit: updatedBatches[0].unit,
        }
      ).catch((err: unknown) =>
        console.warn("[WPP] Failed to send low stock alert:", err)
      );
    }

    if (totalQty <= 0) {
      const batchIds = allBatchesNow.map((b) => b.id);
      const productsToDisable = await prisma.product.findMany({
        where: { inventoryItemId: { in: batchIds }, available: true },
      });
      for (const p of productsToDisable) {
        if (!(p as any).autoDisableWhenOutOfStock) continue;
        await prisma.product.update({
          where: { id: p.id },
          data: { available: false },
        });
        io.to(`tenant-${tenantId}`).emit("product-availability-changed", {
          id: p.id,
          available: false,
        });
        // O front do Dashboard (Cardápio, Estoque, PDV) já escuta "menu-updated" pra
        // recarregar a árvore do tenant — "product-availability-changed" sozinho não tinha
        // nenhum listener real, então a desativação nunca aparecia em tempo real na tela.
        io.to(`tenant-${tenantId}`).emit("menu-updated", { tenantId });
      }
    }
  }

  // Dá baixa no estoque vinculado aos adicionais selecionados nesse item (ex: adicional
  // "Embalagem de viagem" vinculado a 1un de "Caixa Kraft P") — a quantidade configurada no
  // adicional é multiplicada pela quantidade do item no pedido. Chamado nos mesmos pontos
  // onde o produto/receita já é debitado, tanto no fluxo de status (KDS) quanto no PDV.
  async function deductSelectedExtrasStock(
    tenantId: string,
    tenantWhatsapp: string | null | undefined,
    item: { selectedExtras?: string | null; quantity: number },
    orderId: string
  ) {
    if (!item.selectedExtras) return;
    let extras: ResolvedExtra[] = [];
    try {
      extras = JSON.parse(item.selectedExtras) || [];
    } catch {
      return;
    }
    for (const extra of extras) {
      for (const link of extra.stockLinks || []) {
        if (!link.inventoryItemId || !link.quantity) continue;
        const deductQty = link.quantity * item.quantity;
        const updatedBatches = await deductStockFIFO(
          prisma,
          tenantId,
          link.inventoryItemId,
          deductQty,
          orderId,
          "SALE"
        );
        if (updatedBatches.length > 0) {
          await handleStockBatchSideEffects(tenantId, tenantWhatsapp, updatedBatches, deductQty);
        }
      }
    }
  }

  async function emitInventoryRestockSideEffects(
    tenantId: string,
    inventoryItemId: string
  ) {
    const updatedItem = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
    });
    if (!updatedItem) return;

    io.to(`tenant-${tenantId}`).emit("inventory-update", {
      id: updatedItem.id,
      quantity: updatedItem.quantity,
    });

    if (updatedItem.quantity > 0) {
      const productsToEnable = await prisma.product.findMany({
        where: {
          inventoryItemId: updatedItem.id,
          available: false,
          autoDisableWhenOutOfStock: true,
        },
      });
      for (const product of productsToEnable) {
        await prisma.product.update({
          where: { id: product.id },
          data: { available: true },
        });
        io.to(`tenant-${tenantId}`).emit("product-availability-changed", {
          id: product.id,
          available: true,
        });
        io.to(`tenant-${tenantId}`).emit("menu-updated", { tenantId });
      }
    }
  }

  // Anexa a cada movimento de venda (orderId preenchido) os dados completos do pedido —
  // valor bruto, desconto, taxa de maquininha/serviço e itens vendidos — para a tela de
  // Fluxo de Caixa poder detalhar cada venda sem só mostrar o valor líquido lançado.
  // CashMovement.orderId não é uma relação Prisma formal (é só uma string solta), então
  // o join é feito em memória com um segundo findMany, sem precisar de migration.
  async function attachOrderDetails<T extends { orderId?: string | null }>(
    movements: T[]
  ) {
    const orderIds = [
      ...new Set(
        movements.map((m) => m.orderId).filter((id): id is string => !!id)
      ),
    ];
    if (orderIds.length === 0)
      return movements.map((m) => ({ ...m, order: null }));

    const orders: any[] = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: { items: { include: { product: { select: { name: true } } } } },
    });
    hydrateOrderItemNames(orders);
    const orderMap = new Map<string, any>(orders.map((o) => [o.id, o]));

    return movements.map((m) => {
      const order = m.orderId ? orderMap.get(m.orderId) : null;
      if (!order) return { ...m, order: null };
      const grossTotal = order.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      let paymentDetail: {
        cardBrand?: string;
        installments?: number;
        splits?: Array<{
          method: string;
          amount: number;
          cardBrand?: string;
          installments?: number;
        }>;
      } = {};
      try {
        paymentDetail = order.paymentDetail
          ? JSON.parse(order.paymentDetail)
          : {};
      } catch {}
      return {
        ...m,
        order: {
          id: order.id,
          grossTotal,
          discount: order.discount || 0,
          discountType: order.discountType,
          feeAmount: order.feeAmount || 0,
          feePercent: order.feePercent,
          feePassedToCustomer: order.feePassedToCustomer,
          serviceFeeAmount: order.serviceFeeAmount || 0,
          serviceFeePercent: order.serviceFeePercent,
          total: order.total,
          paymentMethod: order.paymentMethod,
          cardBrand: paymentDetail.cardBrand || null,
          installments: paymentDetail.installments || null,
          paymentSplits: paymentDetail.splits || null,
          items: order.items.map((item) => ({
            productName: item.product?.name || "Produto removido",
            quantity: item.quantity,
            price: item.price,
            notes: item.notes,
          })),
        },
      };
    });
  }

  return {
    updateOrderStatus,
    handleStockBatchSideEffects,
    deductSelectedExtrasStock,
    emitInventoryRestockSideEffects,
    attachOrderDetails,
  };
}
