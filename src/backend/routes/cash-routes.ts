import type { Express, Request, RequestHandler, Response } from "express";
import type { Server } from "socket.io";
import {
  applyLateFees,
  calculateLateFee,
  generateDueEntries,
  runLazyGeneration,
} from "../recurring";
import { CONCLUDED_SALE_OR, splitPaymentBreakdown } from "../shared/utils";

export interface RegisterCashRoutesOptions {
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
  attachOrderDetails: <T extends { orderId?: string | null }>(
    movements: T[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any[]>;
}

export function registerCashRoutes({
  app,
  io,
  prisma,
  requireAuth,
  currentAccount,
  requireTenantBySlug,
  attachOrderDetails,
}: RegisterCashRoutesOptions) {
  app.get("/api/tenants/:slug/orders", async (req, res) => {
    const { slug } = req.params;

    try {
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });

      const orders = await prisma.order.findMany({
        where: {
          tenantId: tenant.id,
          status: { in: ["PREPARING", "SHIPPED", "DELIVERED"] },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      res.json(orders);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch public orders" });
    }
  });

  app.get("/api/tenants/:slug/finance-summary", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "finance"
    );
    if (!tenant) return;

    try {
      const now = new Date();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const startOfWeek = new Date();
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [daily, weekly, monthly] = await Promise.all([
        prisma.order.aggregate({
          where: {
            tenantId: tenant.id,
            OR: CONCLUDED_SALE_OR,
            createdAt: { gte: startOfDay },
          },
          _sum: { total: true },
          _count: true,
        }),
        prisma.order.aggregate({
          where: {
            tenantId: tenant.id,
            OR: CONCLUDED_SALE_OR,
            createdAt: { gte: startOfWeek },
          },
          _sum: { total: true },
        }),
        prisma.order.aggregate({
          where: {
            tenantId: tenant.id,
            OR: CONCLUDED_SALE_OR,
            createdAt: { gte: startOfMonth },
          },
          _sum: { total: true },
        }),
      ]);

      res.json({
        daily: daily._sum.total || 0,
        dailyCount: daily._count || 0,
        weekly: weekly._sum.total || 0,
        monthly: monthly._sum.total || 0,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch finance summary" });
    }
  });


  app.get("/api/tenants/:slug/cash/current", requireAuth, async (req, res) => {
    // Abrir/fechar/consultar o caixa físico é operação do dia-a-dia do PDV, não do módulo
    // financeiro — quem só tem acesso ao PDV precisa poder abrir caixa pra começar a vender.
    const tenant = await requireTenantBySlug(req, res, req.params.slug, [
      "finance",
      "pos",
    ]);
    if (!tenant) return;

    try {
      const currentCash = await prisma.cashRegister.findFirst({
        where: { tenantId: tenant.id, status: "OPEN" },
        orderBy: { openedAt: "desc" },
      });

      if (!currentCash) {
        return res.json(null);
      }

      // Esperado em dinheiro na gaveta = fundo de troco + tudo que entrou/saiu como CASH
      // via CashMovement (SANGRIA/SUPRIMENTO inclusos). Usar CashMovement em vez de somar
      // Order.total é o que garante bater com o que realmente foi lançado no caixa —
      // ver commit que corrigiu o cálculo do fechamento (Order.status podia ficar
      // desincronizado, ex: comanda cobrada mas não "limpa").
      const cashMovements = await prisma.cashMovement.findMany({
        where: { cashRegisterId: currentCash.id },
        select: { type: true, amount: true },
      });
      const cashDelta = cashMovements.reduce((sum, m) => {
        if (m.type === "PAYMENT_CASH" || m.type === "SUPRIMENTO") return sum + m.amount;
        if (m.type === "REFUND_CASH" || m.type === "SANGRIA") return sum - m.amount;
        return sum;
      }, 0);

      res.json({
        ...currentCash,
        expectedBalance: currentCash.openingBalance + cashDelta,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch current cash" });
    }
  });

  app.post("/api/tenants/:slug/cash/open", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, [
      "finance",
      "pos",
    ]);
    if (!tenant) return;

    try {
      const existing = await prisma.cashRegister.findFirst({
        where: { tenantId: tenant.id, status: "OPEN" },
        orderBy: { openedAt: "desc" },
      });
      if (existing) {
        // Já existe um caixa aberto — devolve ele em vez de criar um segundo (evita duplicidade
        // por clique duplo / retry de rede, que deixava caixas OPEN órfãos no banco).
        return res.json(existing);
      }

      const account = currentAccount(req);
      const openCash = await prisma.cashRegister.create({
        data: {
          tenantId: tenant.id,
          openingBalance: parseFloat(req.body.openingBalance) || 0,
          operatorName: account?.name || req.body.operatorName || null,
          openedByAccountId: account?.id || null,
          openedByName: account?.name || null,
          openedByEmail: account?.email || null,
          status: "OPEN",
        },
      });

      // Avisa outras telas de PDV já abertas (outro operador, outra aba) que o caixa mudou de
      // estado, pra não ficarem presas mostrando "Caixa Fechado" até um F5 manual.
      io.to(`tenant-${tenant.id}`).emit("cash-status-changed", {
        status: "OPEN",
      });

      res.json(openCash);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to open cash" });
    }
  });

  app.post("/api/tenants/:slug/cash/close", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, [
      "finance",
      "pos",
    ]);
    if (!tenant) return;

    try {
      const currentCash = await prisma.cashRegister.findFirst({
        where: { tenantId: tenant.id, status: "OPEN" },
        orderBy: { openedAt: "desc" },
      });

      if (!currentCash) {
        return res.status(400).json({ error: "No open cash register found" });
      }

      // Base do fechamento é o CashMovement (o que de fato foi lançado no caixa), não
      // Order.status — uma comanda pode ser cobrada (cria o movement de pagamento) e a
      // Order original ficar presa em AWAITING_PAYMENT/PENDING se o operador não clicar
      // em "limpar comanda" depois, o que fazia o fechamento ignorar essa venda inteira
      // (esperado em dinheiro E resumo por forma de pagamento zerados, mesmo com vendas
      // reais no turno). CashMovement é criado no momento exato da cobrança e nunca
      // desincroniza dessa forma.
      const allMovements = await prisma.cashMovement.findMany({
        where: { cashRegisterId: currentCash.id },
        select: { type: true, amount: true, description: true, orderId: true },
      });

      const paymentMovements = allMovements.filter((m) => m.type.startsWith("PAYMENT_") || m.type.startsWith("REFUND_"));
      const closingBalance = Number(req.body.closingBalance);
      if (!Number.isFinite(closingBalance) || closingBalance < 0) {
        return res.status(400).json({ error: "Informe o valor contado em dinheiro para fechar o caixa." });
      }
      const countedBreakdown = req.body.countedBreakdown && typeof req.body.countedBreakdown === "object"
        ? req.body.countedBreakdown as Record<string, unknown>
        : {};
      const cashDelta = allMovements.reduce((sum, m) => {
        if (m.type === "PAYMENT_CASH" || m.type === "SUPRIMENTO") return sum + m.amount;
        if (m.type === "REFUND_CASH" || m.type === "SANGRIA") return sum - m.amount;
        return sum;
      }, 0);
      const expectedBalance = currentCash.openingBalance + cashDelta;

      // PAYMENT_SPLIT é um único movement com o valor cheio (o detalhe por forma de
      // pagamento fica em Order.paymentDetail, não no movement) — busca as orders desses
      // movements pra decompor "Dividido" em CASH/DEBIT/CREDIT/etc reais no resumo.
      const splitOrderIds = paymentMovements
        .filter((m) => m.type === "PAYMENT_SPLIT" && m.orderId)
        .map((m) => m.orderId as string);
      const orderIdsForBreakdown = [...new Set(paymentMovements.map((m) => m.orderId).filter((id): id is string => !!id))];
      const paymentOrders = orderIdsForBreakdown.length
        ? await prisma.order.findMany({
            where: { id: { in: orderIdsForBreakdown } },
            select: { id: true, paymentMethod: true, paymentDetail: true, feeAmount: true, feePassedToCustomer: true },
          })
        : [];
      const paymentOrderById = new Map<string, { id: string; paymentMethod: string | null; paymentDetail: string | null; feeAmount: number | null; feePassedToCustomer: boolean | null }>(paymentOrders.map((o) => [o.id, o]));

      // Resumo de vendas do turno pra imprimir junto com o fechamento — o dono usa isso pra
      // bater caixa (total por forma de pagamento, qtd de pedidos, sangrias/suprimentos), sem
      // precisar abrir o Fluxo de Caixa separado.
      const byMethod = new Map<string, { count: number; total: number }>();
      const addToMethod = (method: string, amount: number) => {
        const entry = byMethod.get(method) || { count: 0, total: 0 };
        entry.count += 1;
        entry.total += amount;
        byMethod.set(method, entry);
      };
      for (const m of paymentMovements) {
        if (m.type === "PAYMENT_SPLIT") {
          const detailRaw = m.orderId ? paymentOrderById.get(m.orderId)?.paymentDetail : null;
          let splits: Array<{ method: string; amount: number }> = [];
          try { splits = detailRaw ? JSON.parse(detailRaw).splits || [] : []; } catch {}
          if (splits.length > 0) {
            for (const split of splits) addToMethod(split.method, split.amount);
          } else {
            addToMethod("SPLIT", m.amount);
          }
          continue;
        }
        addToMethod(m.type.replace(/^(PAYMENT_|REFUND_)/, ""), m.type.startsWith("REFUND_") ? -m.amount : m.amount);
      }
      const salesByMethod = Array.from(byMethod.entries()).map(([method, v]) => ({
        method,
        total: v.total,
      }));

      const movementsSinceOpen = allMovements.filter((m) => m.type === "SANGRIA" || m.type === "SUPRIMENTO");

      // A conferência fica gravada junto ao fechamento: dinheiro é contado na gaveta;
      // os demais métodos são opcionais, mas permitem bater PIX e relatórios da máquina.
      // Estorno reduz o esperado sem apagar o pagamento original, preservando a auditoria.
      const methodTotals = new Map<string, number>();
      for (const entry of salesByMethod) methodTotals.set(entry.method, entry.total);
      const feeByMethod = new Map<string, number>();
      for (const order of paymentOrders) {
        // Um estorno pode ocorrer em outra sessão. Nesse caso a taxa pertence à venda
        // original, não ao caixa que apenas devolveu o valor.
        if (!paymentMovements.some((movement) => movement.orderId === order.id && movement.type.startsWith("PAYMENT_"))) continue;
        const fee = Number(order.feeAmount || 0);
        if (fee <= 0) continue;
        const parts = splitPaymentBreakdown(order.paymentMethod, order.paymentDetail, 0);
        const usableParts = parts.length > 0 && parts[0].method ? parts : [];
        if (usableParts.length > 0) {
          const totalParts = usableParts.reduce((sum, part) => sum + Number(part.amount || 0), 0);
          for (const part of usableParts) {
            if (part.method === "CASH" || totalParts <= 0) continue;
            feeByMethod.set(part.method, (feeByMethod.get(part.method) || 0) + fee * (part.amount / totalParts));
          }
        } else {
          const paymentMovement = paymentMovements.find((m) => m.orderId === order.id && m.type.startsWith("PAYMENT_"));
          const method = paymentMovement?.type.replace("PAYMENT_", "");
          if (method && method !== "CASH") feeByMethod.set(method, (feeByMethod.get(method) || 0) + fee);
        }
      }
      const roundMoney = (value: number) => Math.round(value * 100) / 100;
      const paymentBreakdown: Record<string, { expected: number; counted?: number; difference?: number; fee?: number; net?: number }> = {
        CASH: {
          expected: roundMoney(expectedBalance),
          counted: roundMoney(closingBalance),
          difference: roundMoney(closingBalance - expectedBalance),
        },
      };
      for (const [method, rawExpected] of methodTotals) {
        if (method === "CASH") continue;
        const expected = roundMoney(rawExpected);
        const rawCounted = countedBreakdown[method];
        const counted = typeof rawCounted === "number" ? rawCounted : Number(rawCounted);
        const hasCount = rawCounted !== undefined && rawCounted !== "" && Number.isFinite(counted) && counted >= 0;
        const fee = roundMoney(feeByMethod.get(method) || 0);
        paymentBreakdown[method] = {
          expected,
          ...(fee > 0 ? { fee, net: roundMoney(expected - fee) } : {}),
          ...(hasCount ? { counted: roundMoney(counted), difference: roundMoney(counted - expected) } : {}),
        };
      }

      const closingSummary = {
        openedAt: currentCash.openedAt,
        closedAt: new Date(),
        openingBalance: currentCash.openingBalance,
        expectedBalance,
        ordersCount: new Set(paymentMovements.filter((m) => m.type.startsWith("PAYMENT_")).map((m) => m.orderId || m.description)).size,
        grossTotal: Array.from(methodTotals.values()).reduce((sum, amount) => sum + amount, 0),
        salesByMethod,
        movements: movementsSinceOpen,
        paymentBreakdown,
      };

      const closingAccount = currentAccount(req);
      const closedCash = await prisma.cashRegister.update({
        where: { id: currentCash.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closingBalance: roundMoney(closingBalance),
          expectedBalance,
          paymentBreakdown,
          notes: req.body.notes,
          closedByAccountId: closingAccount?.id || null,
          closedByName: closingAccount?.name || null,
          closedByEmail: closingAccount?.email || null,
        },
      });

      io.to(`tenant-${tenant.id}`).emit("cash-status-changed", {
        status: "CLOSED",
      });

      res.json({ ...closedCash, summary: closingSummary });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to close cash" });
    }
  });

  app.get("/api/tenants/:slug/cash/history", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "finance"
    );
    if (!tenant) return;

    try {
      const { from, to } = req.query as { from?: string; to?: string };
      const where: any = { tenantId: tenant.id, status: "CLOSED" };
      if (from || to) {
        where.openedAt = {};
        if (from) where.openedAt.gte = new Date(from + "T00:00:00");
        if (to) where.openedAt.lte = new Date(to + "T23:59:59");
      }

      const history = await prisma.cashRegister.findMany({
        where,
        include: { movements: true },
        orderBy: { openedAt: "desc" },
        take: 100,
      });

      const historyWithOrders = await Promise.all(
        history.map(async (register: any) => ({
          ...register,
          movements: await attachOrderDetails(register.movements),
        }))
      );

      res.json(historyWithOrders);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch cash history" });
    }
  });

  // Resumo financeiro por período (entradas automáticas via orders + movimentos manuais)
  app.get("/api/tenants/:slug/cash/summary", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "finance"
    );
    if (!tenant) return;

    try {
      const { from, to } = req.query as { from?: string; to?: string };
      const dateFrom = from
        ? new Date(from + "T00:00:00")
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const dateTo = to ? new Date(to + "T23:59:59") : new Date();

      // Pedidos concluídos no período
      const orders = await prisma.order.findMany({
        where: {
          tenantId: tenant.id,
          OR: CONCLUDED_SALE_OR,
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        select: {
          total: true,
          paymentMethod: true,
          paymentDetail: true,
          createdAt: true,
          discount: true,
          feeAmount: true,
          feePassedToCustomer: true,
        },
      });

      // Movimentos manuais (sangrias/suprimentos) no período
      const movements = await prisma.cashMovement.findMany({
        where: {
          tenantId: tenant.id,
          createdAt: { gte: dateFrom, lte: dateTo },
          type: { in: ["SANGRIA", "SUPRIMENTO"] },
        },
        select: { type: true, amount: true, description: true, createdAt: true },
      });

      const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
      const totalSangrias = movements
        .filter((m) => m.type === "SANGRIA")
        .reduce((s, m) => s + m.amount, 0);
      const totalSuprimentos = movements
        .filter((m) => m.type === "SUPRIMENTO")
        .reduce((s, m) => s + m.amount, 0);
      // Taxa de maquininha absorvida pelo lojista (não repassada ao cliente) — reduz o líquido em caixa
      const totalFeesAbsorbed = orders.reduce(
        (s, o) => s + (o.feePassedToCustomer ? 0 : o.feeAmount || 0),
        0
      );

      // Agrupar receita por método — decompõe pagamento dividido nos métodos reais.
      const byMethod: Record<string, number> = {};
      for (const o of orders) {
        for (const part of splitPaymentBreakdown(o.paymentMethod, o.paymentDetail, o.total)) {
          byMethod[part.method] = (byMethod[part.method] || 0) + part.amount;
        }
      }

      // Receita por dia (para gráfico)
      const byDay: Record<string, number> = {};
      for (const o of orders) {
        const day = o.createdAt.toISOString().split("T")[0];
        byDay[day] = (byDay[day] || 0) + o.total;
      }

      res.json({
        totalRevenue,
        orderCount: orders.length,
        totalSangrias,
        totalSuprimentos,
        totalFeesAbsorbed,
        netBalance:
          totalRevenue + totalSuprimentos - totalSangrias - totalFeesAbsorbed,
        byMethod,
        byDay,
        movements,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch cash summary" });
    }
  });

  // ── Entradas e Saídas (financeiro geral) ─────────────────────────────────────
  app.get("/api/tenants/:slug/entries", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "entries"
    );
    if (!tenant) return;

    try {
      await runLazyGeneration(prisma, tenant.id);
      await applyLateFees(prisma, tenant.id);

      const { from, to } = req.query as { from?: string; to?: string };
      const dateFrom = from
        ? new Date(from + "T00:00:00")
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const dateTo = to ? new Date(to + "T23:59:59") : new Date();

      const entries = await prisma.financialEntry.findMany({
        where: { tenantId: tenant.id, date: { gte: dateFrom, lte: dateTo } },
        orderBy: { date: "desc" },
      });

      res.json(
        entries.map((e) => ({
          ...e,
          date: e.date.toISOString().split("T")[0],
          dueDate: e.dueDate ? e.dueDate.toISOString().split("T")[0] : null,
        }))
      );
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch entries" });
    }
  });

  // ── Recorrências financeiras (água/luz, aluguel, sistema, etc) ───────────────
  app.get(
    "/api/tenants/:slug/recurring-entries",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(
        req,
        res,
        req.params.slug,
        "entries"
      );
      if (!tenant) return;

      try {
        const entries = await prisma.recurringEntry.findMany({
          where: { tenantId: tenant.id },
          orderBy: { createdAt: "desc" },
        });
        res.json(
          entries.map((e: any) => ({
            ...e,
            startDate: e.startDate.toISOString().split("T")[0],
            endDate: e.endDate ? e.endDate.toISOString().split("T")[0] : null,
          }))
        );
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch recurring entries" });
      }
    }
  );

  app.post(
    "/api/tenants/:slug/recurring-entries",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(
        req,
        res,
        req.params.slug,
        "entries"
      );
      if (!tenant) return;

      try {
        const {
          type,
          category,
          description,
          frequency,
          amount,
          dueDay,
          startDate,
          endDate,
          installmentsTotal,
          lateFeeEnabled,
          lateFeeRate,
          lateFeeInterval,
          notes,
        } = req.body;

        if (
          !type ||
          !category ||
          !description ||
          !frequency ||
          !dueDay ||
          !startDate
        ) {
          return res.status(400).json({ error: "Campos obrigatórios faltando." });
        }
        if (frequency === "FIXED" && (!amount || amount <= 0)) {
          return res
            .status(400)
            .json({ error: "Recorrência fixa exige um valor." });
        }

        const entry = await prisma.recurringEntry.create({
          data: {
            tenantId: tenant.id,
            type,
            category,
            description,
            frequency,
            amount: frequency === "FIXED" ? parseFloat(amount) : null,
            dueDay: parseInt(dueDay, 10),
            startDate: new Date(startDate + "T00:00:00"),
            endDate: endDate ? new Date(endDate + "T00:00:00") : null,
            installmentsTotal: installmentsTotal
              ? parseInt(installmentsTotal, 10)
              : null,
            lateFeeEnabled: !!lateFeeEnabled,
            lateFeeRate:
              lateFeeEnabled && lateFeeRate ? parseFloat(lateFeeRate) : null,
            lateFeeInterval: lateFeeEnabled ? lateFeeInterval || "MONTHLY" : null,
            notes: notes || null,
          },
        });

        await generateDueEntries(prisma, entry);

        res.json({
          ...entry,
          startDate: entry.startDate.toISOString().split("T")[0],
          endDate: entry.endDate
            ? entry.endDate.toISOString().split("T")[0]
            : null,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create recurring entry" });
      }
    }
  );

  app.patch(
    "/api/tenants/:slug/recurring-entries/:id",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(
        req,
        res,
        req.params.slug,
        "entries"
      );
      if (!tenant) return;

      try {
        const existing = await prisma.recurringEntry.findFirst({
          where: { id: req.params.id, tenantId: tenant.id },
        });
        if (!existing)
          return res.status(404).json({ error: "Recorrência não encontrada." });

        const {
          type,
          category,
          description,
          amount,
          dueDay,
          endDate,
          lateFeeEnabled,
          lateFeeRate,
          lateFeeInterval,
          active,
          notes,
        } = req.body;

        const entry = await prisma.recurringEntry.update({
          where: { id: existing.id },
          data: {
            ...(type !== undefined ? { type } : {}),
            ...(category !== undefined ? { category } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(amount !== undefined
              ? {
                  amount:
                    existing.frequency === "FIXED" ? parseFloat(amount) : null,
                }
              : {}),
            ...(dueDay !== undefined ? { dueDay: parseInt(dueDay, 10) } : {}),
            ...(endDate !== undefined
              ? { endDate: endDate ? new Date(endDate + "T00:00:00") : null }
              : {}),
            ...(lateFeeEnabled !== undefined
              ? { lateFeeEnabled: !!lateFeeEnabled }
              : {}),
            ...(lateFeeRate !== undefined
              ? {
                  lateFeeRate:
                    lateFeeEnabled === false
                      ? null
                      : lateFeeRate
                      ? parseFloat(lateFeeRate)
                      : null,
                }
              : {}),
            ...(lateFeeInterval !== undefined ? { lateFeeInterval } : {}),
            ...(active !== undefined ? { active: !!active } : {}),
            ...(notes !== undefined ? { notes: notes || null } : {}),
          },
        });

        res.json({
          ...entry,
          startDate: entry.startDate.toISOString().split("T")[0],
          endDate: entry.endDate
            ? entry.endDate.toISOString().split("T")[0]
            : null,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update recurring entry" });
      }
    }
  );

  app.delete(
    "/api/tenants/:slug/recurring-entries/:id",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(
        req,
        res,
        req.params.slug,
        "entries"
      );
      if (!tenant) return;

      try {
        const existing = await prisma.recurringEntry.findFirst({
          where: { id: req.params.id, tenantId: tenant.id },
        });
        if (!existing)
          return res.status(404).json({ error: "Recorrência não encontrada." });

        await prisma.recurringEntry.delete({ where: { id: existing.id } });
        res.json({ ok: true });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to delete recurring entry" });
      }
    }
  );

  // Preenche/confirma um lançamento gerado por recorrência VARIABLE (ex: conta de luz do mês)
  app.post(
    "/api/tenants/:slug/entries/:id/confirm",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(
        req,
        res,
        req.params.slug,
        "entries"
      );
      if (!tenant) return;

      try {
        const existing = await prisma.financialEntry.findFirst({
          where: { id: req.params.id, tenantId: tenant.id },
          include: { recurringEntry: true },
        });
        if (!existing)
          return res.status(404).json({ error: "Lançamento não encontrado." });

        const { amount, date } = req.body as { amount: number; date?: string };
        if (!amount || amount <= 0)
          return res.status(400).json({ error: "Informe um valor válido." });

        const paidAt = date ? new Date(date + "T00:00:00") : new Date();
        const baseAmount = parseFloat(String(amount));

        // Se o pagamento ocorre após o vencimento e a recorrência tem juros configurados,
        // calcula o juro de atraso já no momento da confirmação.
        const rec = existing.recurringEntry;
        let lateFeeApplied: number | null = null;
        let finalAmount = baseAmount;
        if (rec?.lateFeeEnabled && rec.lateFeeRate && existing.dueDate) {
          const fee = calculateLateFee(
            baseAmount,
            new Date(existing.dueDate),
            paidAt,
            rec.lateFeeRate,
            rec.lateFeeInterval || "MONTHLY"
          );
          if (fee > 0) {
            lateFeeApplied = fee;
            finalAmount = baseAmount + fee;
          }
        }

        const entry = await prisma.financialEntry.update({
          where: { id: existing.id },
          data: {
            amount: finalAmount,
            baseAmount,
            lateFeeApplied,
            status: "PAID",
            paidAt,
            ...(date ? { date: paidAt } : {}),
          },
        });

        res.json({
          ...entry,
          date: entry.date.toISOString().split("T")[0],
          dueDate: entry.dueDate
            ? entry.dueDate.toISOString().split("T")[0]
            : null,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to confirm entry" });
      }
    }
  );

  app.post("/api/tenants/:slug/entries", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "entries"
    );
    if (!tenant) return;

    try {
      const { type, category, description, amount, date, notes, source } =
        req.body;
      if (!type || !category || !description || !amount || !date) {
        return res.status(400).json({ error: "Campos obrigatórios faltando." });
      }

      const entry = await prisma.financialEntry.create({
        data: {
          tenantId: tenant.id,
          type,
          category,
          description,
          amount: parseFloat(amount),
          date: new Date(date + "T00:00:00"),
          notes: notes || null,
          source: source || "MANUAL",
        },
      });

      res.json({ ...entry, date: entry.date.toISOString().split("T")[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create entry" });
    }
  });

  app.patch("/api/tenants/:slug/entries/:id", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "entries"
    );
    if (!tenant) return;

    try {
      const existing = await prisma.financialEntry.findFirst({
        where: { id: req.params.id, tenantId: tenant.id },
      });
      if (!existing)
        return res.status(404).json({ error: "Lançamento não encontrado." });

      const { type, category, description, amount, date, notes } = req.body;
      const entry = await prisma.financialEntry.update({
        where: { id: existing.id },
        data: {
          ...(type !== undefined ? { type } : {}),
          ...(category !== undefined ? { category } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(amount !== undefined ? { amount: parseFloat(amount) } : {}),
          ...(date !== undefined ? { date: new Date(date + "T00:00:00") } : {}),
          ...(notes !== undefined ? { notes: notes || null } : {}),
        },
      });

      res.json({ ...entry, date: entry.date.toISOString().split("T")[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update entry" });
    }
  });

  app.delete("/api/tenants/:slug/entries/:id", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "entries"
    );
    if (!tenant) return;

    try {
      const existing = await prisma.financialEntry.findFirst({
        where: { id: req.params.id, tenantId: tenant.id },
      });
      if (!existing)
        return res.status(404).json({ error: "Lançamento não encontrado." });

      await prisma.financialEntry.delete({ where: { id: existing.id } });
      res.json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete entry" });
    }
  });


  // ─────────────────────────────────────────────────────────────
  // CASH MOVEMENTS (Sangria / Suprimento)
  // ─────────────────────────────────────────────────────────────

  app.post("/api/tenants/:slug/cash/movement", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "finance"
    );
    if (!tenant) return;

    try {
      const currentCash = await prisma.cashRegister.findFirst({
        where: { tenantId: tenant.id, status: "OPEN" },
        orderBy: { openedAt: "desc" },
      });
      if (!currentCash)
        return res.status(400).json({ error: "Nenhum caixa aberto." });

      const { type, amount, description, operatorName } = req.body;
      if (!type || !amount)
        return res.status(400).json({ error: "type e amount são obrigatórios." });
      if (!["SANGRIA", "SUPRIMENTO"].includes(type))
        return res.status(400).json({ error: "Tipo inválido." });

      const movement = await prisma.cashMovement.create({
        data: {
          cashRegisterId: currentCash.id,
          tenantId: tenant.id,
          type,
          amount: parseFloat(amount),
          description,
          operatorName,
        },
      });
      res.json(movement);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao registrar movimento." });
    }
  });

  // Anexa a cada movimento de venda (orderId preenchido) os dados completos do pedido —
  // valor bruto, desconto, taxa de maquininha/serviço e itens vendidos — para a tela de
  // Fluxo de Caixa poder detalhar cada venda sem só mostrar o valor líquido lançado.
  // CashMovement.orderId não é uma relação Prisma formal (é só uma string solta), então
  // o join é feito em memória com um segundo findMany, sem precisar de migration.
  app.get("/api/tenants/:slug/cash/movements", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "finance"
    );
    if (!tenant) return;

    try {
      const currentCash = await prisma.cashRegister.findFirst({
        where: { tenantId: tenant.id, status: "OPEN" },
        orderBy: { openedAt: "desc" },
      });
      if (!currentCash) return res.json([]);

      const movements = await prisma.cashMovement.findMany({
        where: { cashRegisterId: currentCash.id },
        orderBy: { createdAt: "asc" },
      });
      res.json(await attachOrderDetails(movements));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao buscar movimentos." });
    }
  });
}
