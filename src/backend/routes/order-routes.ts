import type { Express, Request, RequestHandler, Response } from "express";
import type { Server } from "socket.io";
import { verifyPassword, type AuthenticatedRequest } from "../auth";
import {
  sendOrderCreatedMessage,
  sendOwnerOrderAlert,
} from "../wpp/messages";
import {
  resolveSelectedExtras,
  restockCancelledOrder,
  restockOrderItemInventory,
  restockOrderItemRecipe,
  restockSelectedExtras,
  recalculateOpenOrderAmounts,
  expireStaleComandaOrders,
} from "../shared/order-helpers";

export interface RegisterOrderRoutesOptions {
  app: Express;
  io: Server;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any;
  requireAuth: RequestHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentAccount: (req: Request) => any;
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
  requireTenantFromOrder: (
    req: Request,
    res: Response,
    orderId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any | null>;
  updateOrderStatus: (
    orderId: string,
    previousStatus: string,
    status: string,
    kitchenReady?: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any>;
  emitInventoryRestockSideEffects: (
    tenantId: string,
    inventoryItemId: string,
  ) => Promise<void>;
  deductSelectedExtrasStock: (
    tenantId: string,
    tenantWhatsapp: string | null | undefined,
    item: { selectedExtras?: string | null; quantity: number },
    orderId: string,
  ) => Promise<void>;
}

export function registerOrderRoutes({
  app,
  io,
  prisma,
  requireAuth,
  currentAccount,
  requireTenantById,
  requireTenantBySlug,
  requireTenantFromOrder,
  updateOrderStatus,
  emitInventoryRestockSideEffects,
  deductSelectedExtrasStock,
}: RegisterOrderRoutesOptions) {
  app.post("/api/orders", async (req, res) => {
    console.log("Incoming Order Body:", JSON.stringify(req.body, null, 2));
    const {
      customerName,
      customerPhone,
      address,
      items,
      tenantId,
      orderType,
      paymentMethod,
      paymentDetail,
      tableId,
      scheduledDate,
      scheduledTime,
      notes,
      birthday,
      consumptionType,
    } = req.body;

    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });

      // Todos os pedidos recebem uma senha sequencial que reseta todo dia —
      // assim o cliente pode acompanhar pelo número no painel de TV,
      // independente de ser balcão, mesa ou delivery.
      const isCounterOrder = tableId === "Balcao";

      // Balcão precisa saber se o cliente vai comer ali ou levar pra viagem —
      // mesa e delivery já deixam isso implícito, então só exigimos aqui.
      if (isCounterOrder && consumptionType !== "EAT_IN" && consumptionType !== "TAKEOUT") {
        return res.status(400).json({ error: "Informe se é para comer no local ou para viagem." });
      }
      // Loja pode desativar a senha sequencial do Balcão em Configurações (nem todo
      // estabelecimento chama por número — alguns identificam só pelo nome do cliente).
      // Mesa e Delivery continuam recebendo o número normalmente (acompanhamento no painel).
      const usesCounterTicket = !isCounterOrder || tenant.counterTicketMode !== "NAME";

      let total = 0;
      const orderItemsData: Array<{
        productId: string;
        productVariantId: string | null;
        quantity: number;
        price: number;
        notes: string | null;
        selectedExtras: string | null;
        productName: string;
        ncm: string | null;
        cfop: string | null;
        csosn: string | null;
        unitCom: string | null;
        origem: number | null;
        aliqIcms: number | null;
      }> = [];

      for (const item of items || []) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          include: { variants: true },
        });

        if (!product) continue;

        let itemPrice = product.price;
        if (item.productVariantId) {
          const variant = product.variants.find(
            (current) => current.id === item.productVariantId
          );
          if (variant) itemPrice = variant.price;
        }

        // Valida os adicionais selecionados contra a definição real do produto — nunca
        // confia em preço ou vínculo de estoque vindo do cliente, só no id selecionado.
        const selectedExtrasSnapshot = resolveSelectedExtras(product.extras, item.selectedExtras, isCounterOrder ? consumptionType : null);
        for (const extra of selectedExtrasSnapshot) itemPrice += extra.price || 0;

        total += itemPrice * item.quantity;
        orderItemsData.push({
          productId: item.productId,
          productVariantId: item.productVariantId || null,
          quantity: item.quantity,
          price: itemPrice,
          notes: item.notes || null,
          selectedExtras: selectedExtrasSnapshot.length > 0 ? JSON.stringify(selectedExtrasSnapshot) : null,
          productName: product.name,
          ncm: product.ncm,
          cfop: product.cfop,
          csosn: product.csosn,
          unitCom: product.unitCom,
          origem: product.origem,
          aliqIcms: product.aliqIcms,
        });
      }

      // Vincula/atualiza o cliente pelo telefone. Pontos de fidelidade são concedidos
      // somente quando o pedido é marcado como entregue (ver updateOrderStatus).
      let customerId: string | undefined;
      if (customerPhone && customerName) {
        const digits = customerPhone.replace(/\D/g, "");
        const birthdayDate = birthday ? new Date(birthday) : undefined;
        const customer = await prisma.customer.upsert({
          where: { tenantId_phone: { tenantId, phone: digits } },
          create: {
            tenantId,
            name: customerName,
            phone: digits,
            birthday: birthdayDate,
            totalSpent: total,
            ordersCount: 1,
            lastOrderAt: new Date(),
          },
          update: {
            name: customerName,
            totalSpent: { increment: total },
            ordersCount: { increment: 1 },
            lastOrderAt: new Date(),
            ...(birthdayDate && { birthday: birthdayDate }),
          },
        });
        customerId = customer.id;
      }

      // Calcula a senha e cria o pedido na MESMA transação, com um lock na linha do tenant
      // segurando o cálculo até o commit — sem isso, dois pedidos quase simultâneos (dois
      // clientes pedindo ao mesmo tempo, ou um cliente e uma ação do PDV) podiam ler o mesmo
      // "último número" antes de qualquer um confirmar, e os dois criavam pedidos com a
      // MESMA senha — o segundo aparecia como um "pedido fantasma" junto do primeiro na
      // tela de comandas do PDV, mesmo sendo de gente/pedidos completamente diferentes.
      const order = await prisma.$transaction(async (tx) => {
        let counterTicketNumber: number | null = null;
        if (usesCounterTicket) {
          await tx.$executeRawUnsafe(
            "SELECT id FROM tenants WHERE id = ? FOR UPDATE",
            tenantId
          );
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const lastTicket = await tx.order.findFirst({
            where: {
              tenantId,
              counterTicketNumber: { not: null },
              createdAt: { gte: startOfDay },
            },
            orderBy: { counterTicketNumber: "desc" },
            select: { counterTicketNumber: true },
          });
          counterTicketNumber = (lastTicket?.counterTicketNumber ?? 0) + 1;
        }

        return tx.order.create({
          data: {
            customerName,
            customerPhone,
            customerId: customerId || null,
            address,
            orderType: orderType || "DELIVERY",
            paymentMethod: paymentMethod || "CASH",
            paymentDetail,
            notes: notes || null,
            scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
            scheduledTime: scheduledTime || null,
            total,
            tenantId,
            tableId: isCounterOrder ? null : tableId || null,
            counterTicketNumber,
            consumptionType: isCounterOrder ? consumptionType : null,
            items: {
              create: orderItemsData,
            },
          },
          include: {
            items: {
              include: {
                product: true,
                productVariant: true,
              },
            },
            tenant: true,
          },
        });
      });

      // Dá baixa nos insumos vinculados aos adicionais selecionados (ex: kit de embalagem
      // do "Para viagem") — faltava aqui: só o PDV descontava isso, então um pedido criado
      // pelo cardápio público/balcão digital já marcado como TAKEOUT nunca consumia a
      // embalagem do estoque, mesmo o cliente levando o produto embalado de verdade.
      for (const item of order.items) {
        await deductSelectedExtrasStock(tenantId, order.tenant?.whatsapp, item, order.id);
      }

      io.to(`tenant-${tenant.id}`).emit("new-order", order);
      io.to(`tenant-${tenant.id}`).emit("order-created", order);
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
          status: { notIn: ["DELIVERED", "CANCELLED", "MERGED"] },
        },
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
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar pedidos" });
    }
  });

  // Retorna a próxima senha sequencial do dia (sem criar pedido) — usado pelo PDV
  // para pré-visualizar a senha antes de abrir a comanda, evitando duplicatas.
  app.get("/api/tenants/:slug/next-ticket", async (req, res) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: req.params.slug },
        select: { id: true },
      });
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const lastTicket = await prisma.order.findFirst({
        where: {
          tenantId: tenant.id,
          counterTicketNumber: { not: null },
          createdAt: { gte: startOfDay },
        },
        orderBy: { counterTicketNumber: "desc" },
        select: { counterTicketNumber: true },
      });
      res.json({ nextTicket: (lastTicket?.counterTicketNumber ?? 0) + 1 });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar próxima senha." });
    }
  });

  // Acompanhamento de um pedido de balcão pela senha (sem mesa fixa) — o cliente guarda o
  // id do pedido recém-criado no localStorage e consulta o status daqui, já que balcão não
  // tem tableId (usa counterTicketNumber só como número de exibição, não como chave de busca).
  app.get("/api/orders/counter/:slug/:orderId", async (req, res) => {
    const { slug, orderId } = req.params;
    try {
      const order = await prisma.order.findFirst({
        where: { id: orderId, tenant: { slug } },
        include: {
          items: {
            include: {
              product: true,
              productVariant: true,
            },
          },
        },
      });
      if (!order)
        return res.status(404).json({ error: "Pedido não encontrado." });
      res.json(order);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar pedido." });
    }
  });

  app.patch("/api/orders/:id/status", requireAuth, async (req, res) => {
    const tenantOrder = await requireTenantFromOrder(req, res, req.params.id);
    if (!tenantOrder) return;

    const { order } = tenantOrder;
    const { status, kitchenReady } = req.body;

    try {
      const updatedOrder = await updateOrderStatus(
        order.id,
        order.status,
        status,
        kitchenReady
      );
      // Sem isso, só a aba que fez a chamada via toque via a mudança (pela resposta HTTP
      // direta) — qualquer outra aba/painel aberto (ex: outro operador no Painel de
      // Pedidos) continuava mostrando o pedido no status antigo até dar F5. Isso incluía
      // cancelamentos: um pedido cancelado ainda em "Pendentes" ficava visível lá até
      // recarregar a página, mesmo já cancelado no banco.
      io.to(`tenant-${updatedOrder.tenantId}`).emit(
        "order-status-updated",
        updatedOrder
      );
      res.json(updatedOrder);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  // Corrige "Local"/"Para viagem" depois que o pedido já foi lançado (ex: operador
  // esqueceu de marcar no balcão, ou o cliente mudou de ideia). Reaplica os adicionais
  // com autoApplyOnTakeout (o kit de embalagem) e ajusta o estoque na hora — sem isso,
  // corrigir manualmente exigiria excluir e recriar o pedido inteiro. Só toca nos
  // adicionais automáticos do kit de viagem; nunca remove um adicional que o cliente
  // escolheu manualmente (ex: "Sem cebola").
  app.patch("/api/orders/:id/consumption-type", requireAuth, async (req, res) => {
    const tenantOrder = await requireTenantFromOrder(req, res, req.params.id);
    if (!tenantOrder) return;

    const { order, tenant } = tenantOrder;
    const { consumptionType } = req.body as { consumptionType?: string };

    if (consumptionType !== "EAT_IN" && consumptionType !== "TAKEOUT") {
      return res.status(400).json({ error: "Informe se é para comer no local ou para viagem." });
    }
    if (consumptionType === order.consumptionType) {
      return res.json(order);
    }

    try {
      for (const item of order.items) {
        // resolveSelectedExtras só deve receber o que foi escolhido MANUALMENTE — os
        // autoApplyOnTakeout ela mesma adiciona a partir do consumptionType. O snapshot
        // salvo em selectedExtras já inclui o kit de viagem resolvido de antes, então
        // precisamos tirá-lo daqui antes de recalcular, senão ele nunca é reconhecido
        // como algo que pode sair ao voltar para EAT_IN (ficava preso pra sempre).
        let savedExtras: any[] = [];
        try { savedExtras = item.selectedExtras ? JSON.parse(item.selectedExtras) : []; } catch { savedExtras = []; }
        const manuallySelected = savedExtras.filter((e: any) => !e?.autoApplyOnTakeout);

        const previousExtras = resolveSelectedExtras(item.product?.extras, manuallySelected, order.consumptionType);
        const nextExtras = resolveSelectedExtras(item.product?.extras, manuallySelected, consumptionType);

        const previousIds = new Set(previousExtras.map((e) => e.id));
        const nextIds = new Set(nextExtras.map((e) => e.id));

        // Só o kit automático de viagem entra/sai sozinho — o que o cliente escolheu
        // manualmente (não tem autoApplyOnTakeout) nunca muda aqui.
        const added = nextExtras.filter((e) => e.autoApplyOnTakeout && !previousIds.has(e.id));
        const removed = previousExtras.filter((e) => e.autoApplyOnTakeout && !nextIds.has(e.id));

        for (const extra of added) {
          await deductSelectedExtrasStock(
            tenant.id,
            tenant.whatsapp,
            { selectedExtras: JSON.stringify([extra]), quantity: item.quantity },
            order.id
          );
        }
        for (const extra of removed) {
          await restockSelectedExtras(
            prisma,
            tenant.id,
            order.id,
            { selectedExtras: JSON.stringify([extra]) },
            item.quantity
          );
        }

        await prisma.orderItem.update({
          where: { id: item.id },
          data: { selectedExtras: nextExtras.length > 0 ? JSON.stringify(nextExtras) : null },
        });
      }

      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: { consumptionType },
        include: { items: { include: { product: true, productVariant: true } }, tenant: true },
      });

      io.to(`tenant-${tenant.id}`).emit("order-status-updated", updatedOrder);
      res.json(updatedOrder);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao atualizar o tipo de consumo do pedido." });
    }
  });

  // Operador clicou em "chamar novamente" no Painel de Pedidos — repete o anúncio de
  // voz/som no Painel de TV pra pedidos prontos que o cliente não veio buscar.
  app.post("/api/orders/:id/reannounce", requireAuth, async (req, res) => {
    const tenantOrder = await requireTenantFromOrder(req, res, req.params.id);
    if (!tenantOrder) return;

    const { order, tenant } = tenantOrder;
    if (order.status !== "SHIPPED") {
      return res.status(400).json({ error: "Só é possível chamar novamente um pedido pronto." });
    }

    io.to(`tenant-${tenant.id}`).emit("order-reannounced", order);
    res.json({ ok: true });
  });

  // Cancela um pedido já concluído no Histórico. Não apaga o registro (preserva rastreabilidade
  // e não quebra o fechamento de caixa de dias já encerrados) — só muda pra CANCELLED, que já
  // é filtrado fora de todo relatório/receita. Restrito ao proprietário e exige confirmar a
  // própria senha de novo, pra evitar que qualquer operador cancele uma venda por engano.
  app.post("/api/orders/:id/cancel", requireAuth, async (req, res) => {
    const tenantOrder = await requireTenantFromOrder(req, res, req.params.id);
    if (!tenantOrder) return;

    const membership = (req as AuthenticatedRequest).membership;
    if (!membership || membership.role !== "OWNER") {
      return res
        .status(403)
        .json({
          error: "Apenas o proprietário pode cancelar um pedido do histórico.",
        });
    }

    const { password, restockInventory = false } = req.body;
    const account = currentAccount(req);
    const fullAccount = account
      ? await prisma.account.findUnique({ where: { id: account.id } })
      : null;
    if (
      !fullAccount ||
      !password ||
      !verifyPassword(String(password), fullAccount.passwordHash)
    ) {
      return res.status(401).json({ error: "Senha incorreta." });
    }

    const { order } = tenantOrder;
    if (order.status === "CANCELLED")
      return res.status(400).json({ error: "Pedido já está cancelado." });

    try {
      if (order.nfceStatus === "AUTHORIZED") {
        return res.status(400).json({ error: "Este pedido possui NFC-e autorizada. Cancele a NFC-e antes de cancelar a venda." });
      }

      const orderWithItems = await prisma.order.findUnique({
        where: { id: order.id },
        include: { tenant: true, items: { include: { product: true, productVariant: true } } },
      });
      if (!orderWithItems) return res.status(404).json({ error: "Pedido não encontrado." });

      // Mantém a venda original e cria o estorno no caixa aberto atual: isso preserva
      // a auditoria, inclusive se o pagamento ocorreu em um caixa já fechado.
      const paymentMovements = await prisma.cashMovement.findMany({
        where: { tenantId: order.tenantId, orderId: order.id, type: { startsWith: "PAYMENT_" } },
      });
      const currentCash = paymentMovements.length
        ? await prisma.cashRegister.findFirst({ where: { tenantId: order.tenantId, status: "OPEN" }, orderBy: { openedAt: "desc" } })
        : null;
      if (paymentMovements.length && !currentCash) {
        return res.status(400).json({ error: "Abra o caixa para registrar o estorno deste pedido pago." });
      }

      const result = await prisma.$transaction(async (tx: any) => {
        const touchedInventoryIds = restockInventory ? await restockCancelledOrder(tx, orderWithItems) : [];
        const updatedOrder = await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
        if (currentCash && paymentMovements.length) {
          await tx.cashMovement.createMany({ data: paymentMovements.map((movement) => ({
            cashRegisterId: currentCash.id,
            tenantId: order.tenantId,
            type: movement.type.replace("PAYMENT_", "REFUND_"),
            amount: movement.amount,
            description: `Estorno pedido #${order.id.slice(-6).toUpperCase()}`,
            orderId: order.id,
            operatorName: fullAccount.name || null,
          })) });
        }
        return { updatedOrder, touchedInventoryIds };
      });
      for (const inventoryItemId of result.touchedInventoryIds) await emitInventoryRestockSideEffects(order.tenantId, inventoryItemId);
      io.to(`tenant-${order.tenantId}`).emit("order-status-updated", result.updatedOrder);
      res.json(result.updatedOrder);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao cancelar pedido." });
    }
  });

  // Edição de pedido aberto no PDV: reduz/remove itens de uma mesa ou comanda ainda
  // não faturada. Se já houve baixa de estoque, devolve apenas a quantidade ainda não
  // restaurada, evitando estorno duplicado em múltiplas edições.
  app.patch(
    "/api/tenants/:slug/pdv/orders/:orderId/items/:orderItemId",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(req, res, req.params.slug, [
        "pos",
        "waiter",
      ]);
      if (!tenant) return;

      const nextQuantity = Number(req.body?.quantity);
      if (!Number.isInteger(nextQuantity) || nextQuantity < 0) {
        return res.status(400).json({ error: "Quantidade inválida." });
      }
      // Se o item já tinha sido preparado (perda/desperdício), o operador confirma isso na
      // hora de cancelar — nesse caso NÃO devolvemos ao estoque (a baixa original vira perda).
      // Sem perda, devolve normalmente (comportamento de antes).
      const hadLoss = req.body?.hadLoss === true;

      try {
        const order = await prisma.order.findFirst({
          where: { id: req.params.orderId, tenantId: tenant.id },
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
        if (!order)
          return res.status(404).json({ error: "Pedido não encontrado." });
        if (order.orderType !== "DINE_IN")
          return res
            .status(400)
            .json({ error: "Somente mesas e comandas podem ser editadas aqui." });
        if (["DELIVERED", "CANCELLED", "MERGED"].includes(order.status)) {
          return res
            .status(400)
            .json({ error: "Este pedido não pode mais ser editado." });
        }

        const billedMovement = await prisma.cashMovement.findFirst({
          where: { tenantId: tenant.id, orderId: order.id },
          select: { id: true },
        });
        if (billedMovement)
          return res
            .status(400)
            .json({ error: "Este pedido já foi faturado no caixa." });

        const targetItem = order.items.find(
          (item: any) => item.id === req.params.orderItemId
        );
        if (!targetItem)
          return res
            .status(404)
            .json({ error: "Item do pedido não encontrado." });
        if (nextQuantity > Number(targetItem.quantity || 0)) {
          return res
            .status(400)
            .json({ error: "A nova quantidade não pode ser maior que a atual." });
        }
        if (nextQuantity === Number(targetItem.quantity || 0))
          return res.json(order);

        const removedQuantity = Number(targetItem.quantity || 0) - nextQuantity;
        const remainingItems = order.items
          .map((item: any) =>
            item.id === targetItem.id ? { ...item, quantity: nextQuantity } : item
          )
          .filter((item: any) => Number(item.quantity || 0) > 0);

        const result = await prisma.$transaction(async (tx: any) => {
          const touchedInventoryIds = new Set<string>();

          if (!hadLoss) {
            const inventoryItemId = targetItem.productVariantId
              ? targetItem.productVariant?.inventoryItemId
              : targetItem.product?.inventoryItemId;

            const directRestocked = await restockOrderItemInventory(
              tx,
              tenant.id,
              order.id,
              inventoryItemId,
              removedQuantity
            );
            if (directRestocked && inventoryItemId)
              touchedInventoryIds.add(inventoryItemId);

            const recipeInventoryIds = await restockOrderItemRecipe(
              tx,
              tenant.id,
              order.id,
              targetItem.product,
              removedQuantity
            );
            for (const touchedId of recipeInventoryIds)
              touchedInventoryIds.add(touchedId);

            const extrasInventoryIds = await restockSelectedExtras(
              tx,
              tenant.id,
              order.id,
              targetItem,
              removedQuantity
            );
            for (const touchedId of extrasInventoryIds)
              touchedInventoryIds.add(touchedId);
          }

          let updatedOrder;
          if (remainingItems.length === 0) {
            updatedOrder = await tx.order.update({
              where: { id: order.id },
              data: { status: "CANCELLED" },
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
          } else {
            if (nextQuantity === 0) {
              await tx.orderItem.delete({ where: { id: targetItem.id } });
            } else {
              await tx.orderItem.update({
                where: { id: targetItem.id },
                data: { quantity: nextQuantity },
              });
            }

            const recalculated = recalculateOpenOrderAmounts(
              order,
              remainingItems
            );
            updatedOrder = await tx.order.update({
              where: { id: order.id },
              data: {
                total: recalculated.total,
                discount: recalculated.discountAmount,
                feeAmount: recalculated.feePassedToCustomer
                  ? recalculated.feeAmount
                  : order.feeAmount ?? null,
                serviceFeeAmount: recalculated.serviceFeeAmount || null,
                paymentDetail: recalculated.paymentDetail
                  ? JSON.stringify(recalculated.paymentDetail)
                  : order.paymentDetail,
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
          }

          return {
            updatedOrder,
            touchedInventoryIds: Array.from(touchedInventoryIds),
          };
        });

        for (const inventoryItemId of result.touchedInventoryIds) {
          await emitInventoryRestockSideEffects(tenant.id, inventoryItemId);
        }

        io.to(`tenant-${tenant.id}`).emit(
          "order-status-updated",
          result.updatedOrder
        );
        if (order.tableId)
          io.to(`${tenant.id}-mesa-${order.tableId}`).emit("table-update");
        res.json(result.updatedOrder);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Falha ao editar item do pedido." });
      }
    }
  );

  // Cancela uma mesa/comanda ainda aberta no PDV. Diferente do cancelamento do histórico,
  // aqui também desfaz as baixas de estoque já feitas, porque a venda ainda não foi faturada.
  app.post(
    "/api/tenants/:slug/pdv/orders/:orderId/cancel-open",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(req, res, req.params.slug, [
        "pos",
        "waiter",
      ]);
      if (!tenant) return;

      try {
        const order = await prisma.order.findFirst({
          where: { id: req.params.orderId, tenantId: tenant.id },
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
        if (!order)
          return res.status(404).json({ error: "Pedido não encontrado." });
        if (order.orderType !== "DINE_IN")
          return res
            .status(400)
            .json({
              error: "Somente mesas e comandas podem ser canceladas aqui.",
            });
        if (["DELIVERED", "CANCELLED", "MERGED"].includes(order.status)) {
          return res
            .status(400)
            .json({ error: "Este pedido não pode mais ser cancelado." });
        }

        const billedMovement = await prisma.cashMovement.findFirst({
          where: { tenantId: tenant.id, orderId: order.id },
          select: { id: true },
        });
        if (billedMovement)
          return res
            .status(400)
            .json({ error: "Este pedido já foi faturado no caixa." });

        // Se houve perda (item já preparado/desperdiçado), o operador confirma isso no
        // momento do cancelamento e a baixa de estoque original NÃO é devolvida.
        const hadLoss = req.body?.hadLoss === true;

        const result = await prisma.$transaction(async (tx: any) => {
          const touchedInventoryIds = hadLoss ? [] : await restockCancelledOrder(tx, order);
          const updatedOrder = await tx.order.update({
            where: { id: order.id },
            data: { status: "CANCELLED" },
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
          return { updatedOrder, touchedInventoryIds };
        });

        for (const inventoryItemId of result.touchedInventoryIds) {
          await emitInventoryRestockSideEffects(tenant.id, inventoryItemId);
        }

        io.to(`tenant-${tenant.id}`).emit(
          "order-status-updated",
          result.updatedOrder
        );
        if (order.tableId)
          io.to(`${tenant.id}-mesa-${order.tableId}`).emit("table-update");
        res.json(result.updatedOrder);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Falha ao cancelar pedido aberto." });
      }
    }
  );

  app.get("/api/admin/:tenantId/orders", requireAuth, async (req, res) => {
    const tenant = await requireTenantById(req, res, req.params.tenantId);
    if (!tenant) return;

    try {
      // Expiração "lazy" de comandas de balcão abandonadas (mesmo padrão de
      // runLazyGeneration em recurring.ts) — roda a cada carregamento da lista de
      // pedidos do PDV, sem precisar de cron/scheduler separado. Ver comentário em
      // expireStaleComandaOrders (order-helpers.ts) pro porquê disso existir.
      const expiredOrderIds = await expireStaleComandaOrders(prisma, tenant.id).catch((err) => {
        console.error("Falha ao expirar comandas abandonadas:", err);
        return [] as string[];
      });
      if (expiredOrderIds.length > 0) {
        io.to(`tenant-${tenant.id}`).emit("orders-expired", { orderIds: expiredOrderIds });
      }

      const orders = await prisma.order.findMany({
        where: { tenantId: tenant.id },
        include: {
          items: {
            include: {
              product: true,
              productVariant: true,
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
}
