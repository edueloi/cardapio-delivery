import type { Express, Request, RequestHandler, Response } from "express";
import type { Server } from "socket.io";
import { randomUUID } from "crypto";
import { type AuthenticatedRequest } from "../auth";
import {
  deductStockFIFO,
  resolveSelectedExtras,
} from "../shared/order-helpers";
import { buildPaymentCashMovements, counterTicketSameDayWhere } from "../shared/utils";

export interface RegisterPdvRoutesOptions {
  app: Express;
  io: Server;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any;
  requireAuth: RequestHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentAccount: (req: Request) => any;
  requireTenantBySlug: (
    req: Request,
    res: Response,
    slug: string,
    tabId?: string | string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any | null>;
  awardLoyaltyPoints: (
    tenantLoyaltyConfigRaw: string | null | undefined,
    customerId: string,
    orderTotal: number,
  ) => Promise<{ pointsEarned: number; newBalance: number } | null>;
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
  deductSelectedExtrasStock: (
    tenantId: string,
    tenantWhatsapp: string | null | undefined,
    item: { selectedExtras?: string | null; quantity: number },
    orderId: string,
  ) => Promise<void>;
}

export function registerPdvRoutes({
  app,
  io,
  prisma,
  requireAuth,
  currentAccount,
  requireTenantBySlug,
  awardLoyaltyPoints,
  handleStockBatchSideEffects,
  deductSelectedExtrasStock,
}: RegisterPdvRoutesOptions) {
  // ─────────────────────────────────────────────────────────────
  // PDV: create order with discount + customer sync
  // ─────────────────────────────────────────────────────────────

  app.post("/api/tenants/:slug/pdv/order", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, [
      "pos",
      "waiter",
    ]);
    if (!tenant) return;

    try {
      const {
        customerName,
        customerPhone,
        orderType,
        tableId,
        paymentMethod,
        paymentMetadata,
        items,
        discount,
        discountType,
        notes,
        customerCpf,
        cardBrand,
        installments,
        serviceChargeIncluded,
        source,
        counterTicketNumber: requestedCounterTicketNumber,
        consumptionType,
      } = req.body;

      // O placar do garçom (leaderboard) só conta pedidos com operatorName preenchido —
      // sem esse fallback, um membro sem "nome de exibição" configurado (membership.name)
      // ficava fora da contagem mesmo lançando pedidos normalmente.
      const account = currentAccount(req);
      const operatorName =
        req.body.operatorName ||
        (req as AuthenticatedRequest).membership?.name ||
        account?.name ||
        undefined;

      const validatedItems = Array.isArray(items) ? items : [];
      const isDineIn = orderType === "DINE_IN";
      const isCounterComanda = isDineIn && !tableId;
      const isDraftDineIn = isCounterComanda && validatedItems.length === 0;
      if (!isDineIn && validatedItems.length === 0) {
        return res.status(400).json({ error: "Nenhum item no pedido." });
      }

      // Venda de balcão — direta (sem comanda) ou comanda/senha sem mesa vinculada —
      // precisa dizer se é pra comer no local ou levar pra viagem. Mesa e delivery já
      // deixam isso implícito.
      const isCounterSale = orderType === "TAKEAWAY" || isCounterComanda;
      if (isCounterSale && consumptionType !== "EAT_IN" && consumptionType !== "TAKEOUT") {
        return res.status(400).json({ error: "Informe se é para comer no local ou para viagem." });
      }

      // Loja pode desativar a senha sequencial do Balcão em Configurações — nesse caso a
      // comanda fica sem número, identificada só pelo customerName (se o operador digitar um).
      // O número em si só é calculado mais abaixo, dentro da mesma transação que cria o
      // pedido (ver comentário perto do prisma.$transaction) — calcular aqui e usar só lá
      // na frente deixava uma janela grande pra outro pedido colidir no meio do caminho.
      const usesCounterTicket = isCounterComanda && tenant.counterTicketMode !== "NAME";

      // Lançamento do garçom (comanda) para a cozinha ver: nasce PENDING, sem debitar
      // estoque nem dar pontos agora — isso acontece depois, quando o pedido avançar de
      // status (igual ao delivery), via updateOrderStatus. Evita duplicar efeitos quando
      // a comanda for fechada/faturada mais tarde. PDV completo (caixa) continua igual:
      // fatura e debita na hora, pois ali a venda já está confirmada/paga.
      const isWaiterComanda = source === "waiter" && orderType === "DINE_IN";
      const isPDVComandaLaunch =
        orderType === "DINE_IN" && req.body.status === "PENDING";
      const initialStatus = isDraftDineIn
        ? "AWAITING_PAYMENT"
        : isWaiterComanda || isPDVComandaLaunch
        ? "PENDING"
        : "DELIVERED";

      // Fetch products and calculate totals
      const productIds = validatedItems.map((i: any) => i.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: { variants: true },
      });
      const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

      let subtotal = 0;
      const orderItems: any[] = [];
      for (const item of validatedItems) {
        const product = productMap[item.productId];
        if (!product)
          return res
            .status(400)
            .json({ error: `Produto ${item.productId} não encontrado.` });
        // Preço nunca confia no valor vindo do cliente — resolve pela variante (se houver)
        // ou pelo preço base do produto, sempre a partir do que está salvo no banco.
        let price = product.price;
        let productVariantId: string | null = null;
        if (item.productVariantId) {
          const variant = (product.variants ?? []).find(
            (v: any) => v.id === item.productVariantId
          );
          if (!variant)
            return res
              .status(400)
              .json({
                error: `Variante não encontrada para o produto ${product.name}.`,
              });
          price = variant.price;
          productVariantId = variant.id;
        }

        const selectedExtrasSnapshot = resolveSelectedExtras((product as any).extras, item.selectedExtras, isCounterSale ? consumptionType : null);
        for (const extra of selectedExtrasSnapshot) price += extra.price || 0;

        subtotal += price * item.quantity;
        orderItems.push({
          productId: item.productId,
          productVariantId,
          quantity: item.quantity,
          price,
          notes: item.notes,
          selectedExtras: selectedExtrasSnapshot.length > 0 ? JSON.stringify(selectedExtrasSnapshot) : null,
          productName: product.name,
          ncm: (product as any).ncm,
          cfop: (product as any).cfop,
          csosn: (product as any).csosn,
          unitCom: (product as any).unitCom,
          origem: (product as any).origem,
          aliqIcms: (product as any).aliqIcms,
        });
      }

      let discountAmount = 0;
      if (discount && parseFloat(discount) > 0) {
        discountAmount =
          discountType === "PERCENT"
            ? subtotal * (parseFloat(discount) / 100)
            : parseFloat(discount);
      }
      const totalBeforeFee = Math.max(0, subtotal - discountAmount);

      // Taxa de serviço — recalculada no servidor a partir da config salva do tenant (nunca confia no valor vindo do cliente).
      // Sempre opcional: só aplica se a loja tem a config ativada E o operador não desmarcou no pagamento.
      let serviceFeePercent = 0;
      if (serviceChargeIncluded && tenant.paymentMethods) {
        try {
          const pm = JSON.parse(tenant.paymentMethods as string);
          if (pm?.serviceCharge?.enabled)
            serviceFeePercent = Number(pm.serviceCharge.percent) || 0;
        } catch {}
      }
      const serviceFeeAmount = subtotal * (serviceFeePercent / 100);

      // Taxa de maquininha — recalculada no servidor a partir da config salva do tenant (nunca confia no valor vindo do cliente).
      // Quando o pagamento é dividido (SPLIT), soma a taxa de cada parcela proporcionalmente ao seu valor.
      let feePercent = 0;
      let feePassedToCustomer = false;
      let feeAmount = 0;
      const computeFeeForMethod = (
        pm: any,
        method: string,
        brand: string | undefined,
        installmentsCount: number
      ) => {
        if (method === "PIX") {
          const cfg = pm?.pix;
          return {
            percent: cfg?.brandFees?.["PIX"]?.installmentFees?.["1"] ?? 0,
            passToCustomer: !!cfg?.passFeeToCustomer,
          };
        }
        if (
          (method === "CREDIT" || method === "DEBIT" || method === "VR") &&
          brand
        ) {
          const methodKey =
            method === "CREDIT"
              ? "credit"
              : method === "DEBIT"
              ? "debit"
              : "meal";
          const cfg = pm?.[methodKey];
          const installmentKey =
            method === "CREDIT" ? String(installmentsCount || 1) : "1";
          return {
            percent:
              cfg?.brandFees?.[brand]?.installmentFees?.[installmentKey] ?? 0,
            passToCustomer: !!cfg?.passFeeToCustomer,
          };
        }
        return { percent: 0, passToCustomer: false };
      };
      if (tenant.paymentMethods) {
        try {
          const pm = JSON.parse(tenant.paymentMethods as string);
          if (
            paymentMethod === "SPLIT" &&
            Array.isArray(paymentMetadata?.splits)
          ) {
            for (const split of paymentMetadata.splits) {
              const { percent, passToCustomer } = computeFeeForMethod(
                pm,
                split.method,
                split.cardBrand,
                split.installments || 1
              );
              if (passToCustomer && percent > 0)
                feeAmount += Number(split.amount || 0) * (percent / 100);
            }
            feePassedToCustomer = feeAmount > 0;
          } else {
            const { percent, passToCustomer } = computeFeeForMethod(
              pm,
              paymentMethod,
              cardBrand,
              installments
            );
            feePercent = percent;
            feePassedToCustomer = passToCustomer;
            feeAmount = totalBeforeFee * (feePercent / 100);
          }
        } catch {}
      }
      const total =
        (feePassedToCustomer ? totalBeforeFee + feeAmount : totalBeforeFee) +
        serviceFeeAmount;

      // Split de pagamento: a soma das parcelas precisa cobrir o total (com folga de 1 centavo por arredondamento).
      if (paymentMethod === "SPLIT") {
        const splits = Array.isArray(paymentMetadata?.splits)
          ? paymentMetadata.splits
          : [];
        const splitSum = splits.reduce(
          (acc: number, s: any) => acc + Number(s.amount || 0),
          0
        );
        if (splits.length === 0 || Math.abs(splitSum - total) > 0.01) {
          return res
            .status(400)
            .json({
              error:
                "A soma das formas de pagamento não confere com o total da venda.",
            });
        }
      }

      // Upsert customer if phone provided. Para comanda de garçom, o vínculo com o cliente
      // (totalSpent/ordersCount/pontos) só é gravado quando o pedido for entregue — senão
      // conta a "venda" antes da mesa ser fechada e duplica pontos na transição de status.
      let customerId: string | undefined;
      if (customerPhone && customerPhone !== "00000000000" && customerName) {
        if (initialStatus === "PENDING") {
          const existing = await prisma.customer.findUnique({
            where: {
              tenantId_phone: { tenantId: tenant.id, phone: customerPhone },
            },
          });
          customerId = existing?.id;
        } else {
          const customer = await prisma.customer.upsert({
            where: {
              tenantId_phone: { tenantId: tenant.id, phone: customerPhone },
            },
            create: {
              tenantId: tenant.id,
              name: customerName,
              phone: customerPhone,
              totalSpent: total,
              ordersCount: 1,
              lastOrderAt: new Date(),
            },
            update: {
              name: customerName,
              totalSpent: { increment: total },
              ordersCount: { increment: 1 },
              lastOrderAt: new Date(),
            },
          });
          customerId = customer.id;
          await awardLoyaltyPoints(
            tenant.loyaltyConfig as string | null,
            customer.id,
            total
          );
        }
      }

      // Calcula a senha e cria o pedido na MESMA transação, com um lock na linha do tenant
      // segurando o cálculo até o commit — sem isso, dois lançamentos quase simultâneos
      // (ex: um atendente no PDV e um cliente pedindo pelo QR ao mesmo tempo) podiam ler o
      // mesmo "último número" antes de qualquer um confirmar, e os dois criavam pedidos com
      // a MESMA senha — o segundo aparecia como um "pedido fantasma" junto do primeiro na
      // tela de comandas do PDV, mesmo sendo de gente/pedidos completamente diferentes.
      const order = await prisma.$transaction(async (tx) => {
        let counterTicketNumber: number | null = null;
        // Identifica de forma definitiva (nunca reseta, nunca colide) a qual comanda
        // este lançamento pertence — ver comentário do campo no schema.prisma. Herdado
        // do pedido-base quando "adicionar mais itens" reaproveita a mesma senha;
        // gerado novo só quando não há nenhum pedido-base pra herdar de (comanda
        // realmente nova, ou senha sequencial desativada nas configurações).
        let comandaGroupId: string | null = null;
        if (usesCounterTicket) {
          await tx.$executeRawUnsafe(
            "SELECT id FROM tenants WHERE id = ? FOR UPDATE",
            tenant.id
          );
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const requested =
            Number.isInteger(Number(requestedCounterTicketNumber)) &&
            Number(requestedCounterTicketNumber) > 0
              ? Number(requestedCounterTicketNumber)
              : null;
          // O número sugerido pelo cliente (buscado quando o modal "Nova Comanda" abriu, ou
          // o ticket da comanda em "Adicionar mais itens") pode ter ficado desatualizado se
          // outra comanda foi criada nesse meio tempo — confiar cegamente nele já causou
          // duas comandas com a mesma "Senha ##" no mesmo dia. Sempre validamos contra o
          // banco antes de aceitar, e recalculamos se colidir. Isso vale também pra
          // "Adicionar mais itens": aqui é fila (painel/cozinha chamam por número), então um
          // lançamento novo tem que pegar a PRÓXIMA senha da fila, nunca reaproveitar uma
          // anterior — senão atropela quem já está na frente.
          const existingBase = requested
            ? await tx.order.findFirst({
                where: { tenantId: tenant.id, ...counterTicketSameDayWhere(requested) },
                select: { id: true, comandaGroupId: true },
                orderBy: { createdAt: "asc" },
              })
            : null;
          if (requested && !existingBase) {
            counterTicketNumber = requested;
          } else if (existingBase) {
            counterTicketNumber = requested;
            comandaGroupId = existingBase.comandaGroupId;
          } else {
            const lastTicket = await tx.order.findFirst({
              where: {
                tenantId: tenant.id,
                counterTicketNumber: { not: null },
                createdAt: { gte: startOfDay },
              },
              orderBy: { counterTicketNumber: "desc" },
              select: { counterTicketNumber: true },
            });
            counterTicketNumber = (lastTicket?.counterTicketNumber ?? 0) + 1;
          }
        }
        if (!comandaGroupId && isCounterComanda) comandaGroupId = randomUUID();

        return tx.order.create({
          data: {
            tenantId: tenant.id,
            customerName: customerName || (isCounterComanda ? "" : "Venda PDV"),
            customerPhone: customerPhone || "00000000000",
            comandaGroupId,
            orderType: orderType || "TAKEAWAY",
            tableId: tableId || null,
            counterTicketNumber,
            consumptionType: isCounterSale ? consumptionType : null,
            paymentMethod: paymentMethod || "CASH",
            paymentDetail: paymentMetadata ? JSON.stringify(paymentMetadata) : null,
            discount: discountAmount,
            discountType: discountType || null,
            notes: notes || null,
            operatorName: operatorName || null,
            customerId: customerId || null,
            customerCpf: customerCpf ? customerCpf.replace(/\D/g, "") : null,
            feeAmount: feeAmount || null,
            feePercent: feePercent || null,
            feePassedToCustomer,
            serviceFeeAmount: serviceFeeAmount || null,
            serviceFeePercent: serviceFeeAmount ? serviceFeePercent : null,
            status: initialStatus,
            total,
            items: { create: orderItems },
          },
          include: { items: { include: { product: true, productVariant: true } } },
        });
      });

      // Comanda do garçom ou lançamento pendente ainda não é venda faturada — sem movimento de caixa
      // e sem debitar estoque agora. Isso acontece quando o pedido avançar de status
      // (PREPARING debita estoque, DELIVERED fecha a venda), igual ao delivery.
      if (initialStatus !== "PENDING" && !isDraftDineIn) {
        // Register cash movement for the payment
        const currentCash = await prisma.cashRegister.findFirst({
          where: { tenantId: tenant.id, status: "OPEN" },
          orderBy: { openedAt: "desc" },
        });
        if (currentCash) {
          await prisma.cashMovement.createMany({
            data: buildPaymentCashMovements({
              cashRegisterId: currentCash.id,
              tenantId: tenant.id,
              paymentMethod: paymentMethod || "CASH",
              splits: paymentMetadata?.splits,
              fallbackAmount: total,
              description: `Venda PDV #${order.id.slice(-6).toUpperCase()}`,
              orderId: order.id,
              operatorName,
            }),
          });
        }

        // Deduct inventory — usa o estoque vinculado à variante quando o item tiver uma,
        // senão cai no estoque do produto base (mesma regra de updateOrderStatus).
        for (const item of order.items) {
          const inventoryItemId = item.productVariantId
            ? (
                await prisma.productVariant.findUnique({
                  where: { id: item.productVariantId },
                })
              )?.inventoryItemId
            : item.product?.inventoryItemId;
          if (inventoryItemId) {
            const updatedBatches = await deductStockFIFO(
              prisma,
              tenant.id,
              inventoryItemId,
              item.quantity,
              order.id,
              "SALE"
            );

            if (updatedBatches.length > 0) {
              await handleStockBatchSideEffects(
                tenant.id,
                tenant.whatsapp,
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
                  tenant.id,
                  ingredient.inventoryItemId,
                  deductQty,
                  order.id,
                  "SALE",
                  ingredient.unit
                );
                if (updatedBatches.length > 0) {
                  await handleStockBatchSideEffects(
                    tenant.id,
                    tenant.whatsapp,
                    updatedBatches,
                    deductQty
                  );
                }
              }
            }
          }

          await deductSelectedExtrasStock(tenant.id, tenant.whatsapp, item, order.id);
        }
      }

      // "new-order" é o nome de evento escutado em todo o app (painel de cozinha, PDV,
      // etc) — "order:new" nunca foi ouvido em lugar nenhum, então pedidos lançados por
      // essa rota (PDV e comanda de garçom) nunca apareciam em tempo real na cozinha,
      // só depois de um refresh manual que buscava via HTTP.
      // Só emite quando o pedido de fato precisa de atenção da cozinha (nasce PENDING,
      // ex: comanda do garçom). Uma venda de balcão ou fechamento de conta via "Pagar"
      // já nasce DELIVERED (paga na hora) e não deve virar alerta de "novo pedido".
      if (order.status !== "DELIVERED" && order.items.length > 0) {
        io.to(`tenant-${tenant.id}`).emit("new-order", order);
      }
      // "order-created" é separado de "new-order": dispara SEMPRE que um pedido nasce por
      // essa rota (inclusive venda de balcão já DELIVERED), pois serve pra impressão
      // automática — que precisa acontecer pra toda venda, não só pras que alertam a cozinha.
      if (order.items.length > 0) {
        io.to(`tenant-${tenant.id}`).emit("order-created", order);
      }
      res.json(order);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao criar pedido PDV." });
    }
  });

  // Fatura no caixa um pedido de Delivery que já foi marcado como entregue (fora do PDV,
  // pelo Painel de Pedidos) mas ainda não teve a venda lançada — o motoboy saiu, entregou,
  // e só agora o cliente paga em dinheiro/cartão/pix na porta. Registra o CashMovement e
  // grava a forma de pagamento no pedido, sem duplicar o pedido nem re-debitar estoque
  // (isso já aconteceu quando o status avançou para PREPARING/DELIVERED).
  app.post(
    "/api/tenants/:slug/pdv/bill-order/:orderId",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(req, res, req.params.slug, "pos");
      if (!tenant) return;

      try {
        const { paymentMethod, paymentMetadata, cardBrand, installments } =
          req.body;
        const account = currentAccount(req);
        const operatorName =
          req.body.operatorName ||
          (req as AuthenticatedRequest).membership?.name ||
          account?.name ||
          undefined;

        const order = await prisma.order.findFirst({
          where: { id: req.params.orderId, tenantId: tenant.id },
        });
        if (!order)
          return res.status(404).json({ error: "Pedido não encontrado." });
        if (order.orderType !== "DELIVERY")
          return res
            .status(400)
            .json({ error: "Este pedido não é de Delivery." });

        const alreadyBilled = await prisma.cashMovement.findFirst({
          where: { tenantId: tenant.id, orderId: order.id },
        });
        if (alreadyBilled) {
          // Já existe o lançamento de caixa (dinheiro já contabilizado) — só o campo
          // "billed" do pedido ficou desatualizado (ex: corrida entre duas requisições
          // concorrentes). Sem isso, o pedido ficava preso pra sempre em "Ag. Faturamento":
          // toda tentativa de faturar esbarrava aqui, sem nunca sincronizar a tela do
          // operador, que via o mesmo erro indefinidamente. Autocorrige e trata como sucesso.
          if (!order.billed) {
            const fixedOrder = await prisma.order.update({
              where: { id: order.id },
              data: { billed: true },
            });
            io.to(`tenant-${tenant.id}`).emit("order-status-updated", fixedOrder);
          }
          return res.json({ success: true, alreadyBilled: true });
        }

        const currentCash = await prisma.cashRegister.findFirst({
          where: { tenantId: tenant.id, status: "OPEN" },
          orderBy: { openedAt: "desc" },
        });
        if (!currentCash)
          return res
            .status(400)
            .json({ error: "Abra o caixa antes de faturar o pedido." });

        const updatedOrder = await prisma.order.update({
          where: { id: order.id },
          data: {
            billed: true,
            paymentMethod: paymentMethod || "CASH",
            paymentDetail: paymentMetadata
              ? JSON.stringify({ ...paymentMetadata, cardBrand, installments })
              : order.paymentDetail,
          },
        });

        await prisma.cashMovement.createMany({
          data: buildPaymentCashMovements({
            cashRegisterId: currentCash.id,
            tenantId: tenant.id,
            paymentMethod: paymentMethod || "CASH",
            splits: paymentMetadata?.splits,
            fallbackAmount: order.total,
            description: `Delivery #${order.id.slice(-6).toUpperCase()}`,
            orderId: order.id,
            operatorName,
          }),
        });

        io.to(`tenant-${tenant.id}`).emit("order-status-updated", updatedOrder);
        res.json({ success: true });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Falha ao faturar pedido." });
      }
    }
  );

  // Fatura todas as comandas de uma mesa ou senha de uma vez, sem alterar o status delas
  // (se estiverem PENDING/PREPARING na cozinha, continuam lá). Cria um único CashMovement.
  app.post(
    "/api/tenants/:slug/pdv/bill-context",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(req, res, req.params.slug, "pos");
      if (!tenant) return;

      try {
        const {
          tableId,
          counterTicketNumber,
          paymentMethod,
          paymentMetadata,
          cardBrand,
          installments,
          operatorName: reqOperatorName,
          discount,
          discountType,
        } = req.body;
        const account = currentAccount(req);
        const operatorName =
          reqOperatorName ||
          (req as AuthenticatedRequest).membership?.name ||
          account?.name ||
          undefined;

        if (!tableId && !counterTicketNumber) {
          return res.status(400).json({ error: "Informe a mesa ou senha." });
        }

        // Resolve o comandaGroupId real da senha antes de buscar os pedidos — ele nunca
        // colide nem reseta (ao contrário de counterTicketNumber), então é a forma
        // definitiva de saber quais pedidos pertencem a esta comanda. Pedidos anteriores
        // à migration que introduziu esse campo não têm comandaGroupId — nesse caso o
        // filtro por senha+mesmo-dia (counterTicketSameDayWhere) continua sendo usado
        // como aproximação, exatamente como já funcionava antes.
        const comandaGroupId = !tableId
          ? (await prisma.order.findFirst({
              where: { tenantId: tenant.id, ...counterTicketSameDayWhere(Number(counterTicketNumber)) },
              select: { comandaGroupId: true },
              orderBy: { createdAt: "asc" },
            }))?.comandaGroupId ?? null
          : null;

        // Busca os pedidos abertos no contexto. billed:false evita faturar de novo um
        // pedido que outra requisição (duplo clique/reenvio) já processou.
        const orders = await prisma.order.findMany({
          where: {
            tenantId: tenant.id,
            orderType: "DINE_IN",
            status: { notIn: ["DELIVERED", "CANCELLED", "MERGED"] },
            billed: false,
            ...(tableId
              ? { tableId }
              : {
                  ...(comandaGroupId ? { comandaGroupId } : counterTicketSameDayWhere(Number(counterTicketNumber))),
                  tableId: null,
                }),
          },
        });

        if (orders.length === 0)
          return res
            .status(400)
            .json({ error: "Nenhum pedido em aberto encontrado." });

        const subtotalToBill = orders.reduce(
          (acc: number, o: any) => acc + o.total,
          0
        );

        // Desconto aplicado no momento de fechar a mesa/comanda (não no lançamento de
        // cada item individual) — sem isso, o campo de desconto do rodapé do carrinho
        // era descartado em silêncio sempre que o operador fechava uma comanda já
        // lançada (carrinho vazio, só faturando o que já estava na mesa), e a nota
        // saía sem o desconto combinado com o cliente.
        let discountAmount = 0;
        if (discount && parseFloat(discount) > 0) {
          discountAmount =
            discountType === "PERCENT"
              ? subtotalToBill * (parseFloat(discount) / 100)
              : Math.min(parseFloat(discount), subtotalToBill);
        }
        const totalToBill = Math.max(0, subtotalToBill - discountAmount);

        const currentCash = await prisma.cashRegister.findFirst({
          where: { tenantId: tenant.id, status: "OPEN" },
          orderBy: { openedAt: "desc" },
        });
        if (!currentCash)
          return res
            .status(400)
            .json({ error: "Abra o caixa antes de faturar." });

        // Atualiza os pedidos com os dados de pagamento (mas mantém o status!) — o
        // desconto do fechamento vai inteiro no PRIMEIRO pedido da comanda (não
        // rateado entre todos): é esse pedido que a notinha impressa usa como base
        // (lastOrderRef pega sempre orders[0]), então ratear faria a nota mostrar só
        // uma fração do desconto combinado com o cliente quando a mesa tem mais de
        // um pedido lançado.
        const updatedOrders = await Promise.all(
          orders.map(async (order: any, idx: number) => {
            const share = idx === 0 ? discountAmount : 0;
            const updated = await prisma.order.update({
              where: { id: order.id },
              data: {
                billed: true,
                paymentMethod: paymentMethod || "CASH",
                paymentDetail: paymentMetadata
                  ? JSON.stringify({
                      ...paymentMetadata,
                      cardBrand,
                      installments,
                    })
                  : order.paymentDetail,
                ...(share > 0 && {
                  discount: share,
                  discountType: discountType || "FIXED",
                  total: Math.max(0, order.total - share),
                }),
              },
              include: { items: { include: { product: true, productVariant: true } } },
            });
            return updated;
          })
        );

        const desc = tableId
          ? `Mesa ${tableId}`
          : `Senha ${String(counterTicketNumber).padStart(2, "0")}`;

        // Um CashMovement por pedido (em vez de um único somando todos) — cada linha do
        // Fluxo de Caixa fica rastreável ao seu orderId real, permitindo auditar depois
        // exatamente quais pedidos compuseram o faturamento de uma senha/mesa. Quando o
        // pagamento é dividido, os splits cobrem o total da senha/mesa inteira (não dá
        // pra saber qual parte veio de qual pedido específico), então gravamos uma linha
        // por método real (referenciando o primeiro pedido) em vez de uma por pedido.
        const cashMovementRows =
          paymentMethod === "SPLIT" && Array.isArray(paymentMetadata?.splits) && paymentMetadata.splits.length > 0
            ? buildPaymentCashMovements({
                cashRegisterId: currentCash.id,
                tenantId: tenant.id,
                paymentMethod: "SPLIT",
                splits: paymentMetadata.splits,
                fallbackAmount: totalToBill,
                description: `Faturamento ${desc}`,
                orderId: orders[0].id,
                operatorName,
              })
            : updatedOrders.map((order: any) => ({
                cashRegisterId: currentCash.id,
                tenantId: tenant.id,
                type: `PAYMENT_${paymentMethod || "CASH"}`,
                amount: order.total,
                description: `Faturamento ${desc}`,
                orderId: order.id,
                operatorName: operatorName || null,
              }));

        await prisma.cashMovement.createMany({ data: cashMovementRows });

        for (const o of updatedOrders) {
          io.to(`tenant-${tenant.id}`).emit("order-status-updated", {
            ...o,
            billed: true,
          });
        }
        if (tableId) io.to(`${tenant.id}-mesa-${tableId}`).emit("table-update");

        // A via final da comanda precisa trazer todos os itens e o total efetivamente
        // cobrado. O primeiro pedido ainda é a referência para auditoria, mas não pode
        // fazer a notinha do cliente omitir itens de lançamentos posteriores.
        const receiptOrder = updatedOrders.length > 0
          ? {
              ...updatedOrders[0],
              items: updatedOrders.flatMap((order: any) => order.items || []),
              total: totalToBill,
              discount: discountAmount,
            }
          : null;

        res.json({ success: true, total: totalToBill, orders: updatedOrders, receiptOrder });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Falha ao faturar contexto." });
      }
    }
  );
}
