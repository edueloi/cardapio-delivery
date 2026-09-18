import type { Express, Request, RequestHandler, Response } from "express";
import { hydrateOrderItemNames } from "../shared/order-helpers";
import { CONCLUDED_SALE_OR, splitPaymentBreakdown } from "../shared/utils";

export interface RegisterReportRoutesOptions {
  app: Express;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any;
  requireAuth: RequestHandler;
  requireTenantBySlug: (
    req: Request,
    res: Response,
    slug: string,
    tabId?: string | string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any | null>;
}

export function registerReportRoutes({
  app,
  prisma,
  requireAuth,
  requireTenantBySlug,
}: RegisterReportRoutesOptions) {
  // ─────────────────────────────────────────────────────────────
  // FINANCIAL REPORTS
  // ─────────────────────────────────────────────────────────────

  app.get("/api/tenants/:slug/reports/summary", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "reports"
    );
    if (!tenant) return;

    try {
      const { from, to } = req.query as Record<string, string>;
      const dateFrom = from
        ? new Date(from)
        : new Date(new Date().setHours(0, 0, 0, 0));
      const dateTo = to
        ? new Date(to)
        : new Date(new Date().setHours(23, 59, 59, 999));

      // Concluída = Delivery entregue OU Balcão/Mesa já faturado (billed) — esse último
      // fica preso em AWAITING_PAYMENT/PREPARING pra sempre, nunca vira DELIVERED.
      const orders = await prisma.order.findMany({
        where: {
          tenantId: tenant.id,
          OR: CONCLUDED_SALE_OR,
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        include: { items: { include: { product: true } } },
      });
      hydrateOrderItemNames(orders);

      const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
      const totalOrders = orders.length;
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Taxa de maquininha: custo total (sempre, é o que a adquirente cobra) e quanto foi absorvido pelo lojista
      const totalFees = orders.reduce((s, o) => s + (o.feeAmount || 0), 0);
      const totalFeesAbsorbed = orders.reduce(
        (s, o) => s + (o.feePassedToCustomer ? 0 : o.feeAmount || 0),
        0
      );
      const netRevenue = totalRevenue - totalFeesAbsorbed;

      // Revenue by payment method — decompõe pedido com pagamento dividido nos
      // métodos reais em vez de jogar tudo num balde "SPLIT".
      const byPaymentMethod: Record<
        string,
        { count: number; total: number; fees: number }
      > = {};
      for (const order of orders) {
        const parts = splitPaymentBreakdown(order.paymentMethod, order.paymentDetail, order.total);
        parts.forEach((part, idx) => {
          if (!byPaymentMethod[part.method])
            byPaymentMethod[part.method] = { count: 0, total: 0, fees: 0 };
          byPaymentMethod[part.method].count++;
          byPaymentMethod[part.method].total += part.amount;
          // Taxa de maquininha é um valor único por pedido (não sabemos qual fatia do
          // split gerou a taxa) — atribui só à primeira parte, pra não contar 2x.
          if (idx === 0) byPaymentMethod[part.method].fees += order.feeAmount || 0;
        });
      }

      // Revenue by order type
      const byOrderType: Record<string, { count: number; total: number }> = {};
      for (const order of orders) {
        const ot = order.orderType;
        if (!byOrderType[ot]) byOrderType[ot] = { count: 0, total: 0 };
        byOrderType[ot].count++;
        byOrderType[ot].total += order.total;
      }

      // Top products
      const productSales: Record<
        string,
        { name: string; qty: number; total: number }
      > = {};
      for (const order of orders) {
        for (const item of order.items) {
          const pid = item.productId;
          if (!productSales[pid])
            productSales[pid] = {
              name: item.product?.name || pid,
              qty: 0,
              total: 0,
            };
          productSales[pid].qty += item.quantity;
          productSales[pid].total += item.price * item.quantity;
        }
      }
      const topProducts = Object.entries(productSales)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      // Hourly distribution
      const hourlyMap: Record<number, number> = {};
      for (const order of orders) {
        const h = new Date(order.createdAt).getHours();
        hourlyMap[h] = (hourlyMap[h] || 0) + order.total;
      }
      const hourly = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        total: hourlyMap[h] || 0,
      }));

      res.json({
        totalRevenue,
        totalOrders,
        averageTicket,
        totalFees,
        totalFeesAbsorbed,
        netRevenue,
        byPaymentMethod,
        byOrderType,
        topProducts,
        hourly,
        dateFrom,
        dateTo,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao gerar relatório." });
    }
  });

  // GET /api/tenants/:slug/reports/timing — tempo de preparo (criação → pronto) e tempo de
  // entrega (pronto → entregue). Só considera pedidos com readyAt/deliveredAt preenchidos —
  // pedidos criados antes da introdução desses campos não têm esse histórico e são ignorados
  // aqui (mas continuam contando nos outros relatórios).
  app.get("/api/tenants/:slug/reports/timing", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "reports"
    );
    if (!tenant) return;

    try {
      const { from, to } = req.query as Record<string, string>;
      const dateFrom = from
        ? new Date(from)
        : new Date(new Date().setHours(0, 0, 0, 0));
      const dateTo = to
        ? new Date(to)
        : new Date(new Date().setHours(23, 59, 59, 999));

      const orders = await prisma.order.findMany({
        where: {
          tenantId: tenant.id,
          status: { in: ["DELIVERED", "SHIPPED"] },
          createdAt: { gte: dateFrom, lte: dateTo },
          readyAt: { not: null },
        },
        select: {
          id: true,
          customerName: true,
          counterTicketNumber: true,
          orderType: true,
          createdAt: true,
          readyAt: true,
          deliveredAt: true,
        },
      });

      const prepMinutes = (o: (typeof orders)[number]) =>
        (o.readyAt!.getTime() - o.createdAt.getTime()) / 60000;
      const deliveryMinutes = (o: (typeof orders)[number]) =>
        o.deliveredAt ? (o.deliveredAt.getTime() - o.readyAt!.getTime()) / 60000 : null;

      const prepTimes = orders.map(prepMinutes);
      const avgPrepMinutes =
        prepTimes.length > 0 ? prepTimes.reduce((s, v) => s + v, 0) / prepTimes.length : 0;

      const deliveryTimes = orders
        .map(deliveryMinutes)
        .filter((v): v is number => v !== null);
      const avgDeliveryMinutes =
        deliveryTimes.length > 0
          ? deliveryTimes.reduce((s, v) => s + v, 0) / deliveryTimes.length
          : 0;

      // Distribuição do tempo médio de preparo por hora do dia (identifica picos de movimento)
      const hourlyMap: Record<number, { totalMinutes: number; count: number }> = {};
      for (const order of orders) {
        const h = new Date(order.createdAt).getHours();
        if (!hourlyMap[h]) hourlyMap[h] = { totalMinutes: 0, count: 0 };
        hourlyMap[h].totalMinutes += prepMinutes(order);
        hourlyMap[h].count++;
      }
      const hourly = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        avgPrepMinutes: hourlyMap[h] ? hourlyMap[h].totalMinutes / hourlyMap[h].count : 0,
        count: hourlyMap[h]?.count || 0,
      }));

      // Pedidos mais demorados no preparo — com data/horário, pra investigar casos específicos
      const slowest = orders
        .map((o) => ({
          id: o.id,
          customerName: o.customerName,
          counterTicketNumber: o.counterTicketNumber,
          orderType: o.orderType,
          createdAt: o.createdAt,
          readyAt: o.readyAt,
          prepMinutes: prepMinutes(o),
          deliveryMinutes: deliveryMinutes(o),
        }))
        .sort((a, b) => b.prepMinutes - a.prepMinutes)
        .slice(0, 15);

      res.json({
        avgPrepMinutes,
        avgDeliveryMinutes,
        ordersWithTiming: orders.length,
        hourly,
        slowest,
        dateFrom,
        dateTo,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao gerar relatório de tempo." });
    }
  });

  app.get("/api/tenants/:slug/reports/daily", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "reports"
    );
    if (!tenant) return;

    try {
      const days = parseInt((req.query.days as string) || "30");
      const from = new Date();
      from.setDate(from.getDate() - days);
      from.setHours(0, 0, 0, 0);

      const orders = await prisma.order.findMany({
        where: {
          tenantId: tenant.id,
          OR: CONCLUDED_SALE_OR,
          createdAt: { gte: from },
        },
        select: { createdAt: true, total: true },
      });

      const dailyMap: Record<
        string,
        { date: string; total: number; count: number }
      > = {};
      for (const order of orders) {
        const d = order.createdAt.toISOString().slice(0, 10);
        if (!dailyMap[d]) dailyMap[d] = { date: d, total: 0, count: 0 };
        dailyMap[d].total += order.total;
        dailyMap[d].count++;
      }

      const result = Object.values(dailyMap).sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao buscar dados diários." });
    }
  });

  // Receita agregada por mês (usado na visão "Este Ano" — 12 barras em vez de ~365)
  app.get("/api/tenants/:slug/reports/monthly", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "reports"
    );
    if (!tenant) return;

    try {
      const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));
      const from = new Date(year, 0, 1);
      const to = new Date(year, 11, 31, 23, 59, 59, 999);

      const orders = await prisma.order.findMany({
        where: {
          tenantId: tenant.id,
          OR: CONCLUDED_SALE_OR,
          createdAt: { gte: from, lte: to },
        },
        select: { createdAt: true, total: true },
      });

      const monthlyMap: Record<number, { total: number; count: number }> = {};
      for (const order of orders) {
        const m = order.createdAt.getMonth();
        if (!monthlyMap[m]) monthlyMap[m] = { total: 0, count: 0 };
        monthlyMap[m].total += order.total;
        monthlyMap[m].count++;
      }

      const result = Array.from({ length: 12 }, (_, m) => ({
        month: m,
        total: monthlyMap[m]?.total || 0,
        count: monthlyMap[m]?.count || 0,
      }));
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao buscar dados mensais." });
    }
  });

  // Itens de estoque que mais saem (consumo real via stock_movements, tipo OUT/venda)
  // no período — cobre tanto o vínculo direto (Product.inventoryItemId) quanto o
  // consumo de insumos de fichas técnicas (reason "PRODUCTION").
  app.get("/api/tenants/:slug/reports/top-inventory", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "reports"
    );
    if (!tenant) return;

    try {
      const { from, to } = req.query as Record<string, string>;
      const dateFrom = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
      const dateTo = to ? new Date(to) : new Date(new Date().setHours(23, 59, 59, 999));

      const movements = await prisma.stockMovement.findMany({
        where: {
          type: "OUT",
          reason: { in: ["SALE", "PRODUCTION"] },
          createdAt: { gte: dateFrom, lte: dateTo },
          item: { tenantId: tenant.id },
        },
        select: { quantity: true, item: { select: { id: true, name: true, unit: true } } },
      });

      const byItem: Record<string, { id: string; name: string; unit: string | null; quantity: number }> = {};
      for (const mov of movements) {
        if (!mov.item) continue;
        const key = mov.item.id;
        if (!byItem[key]) byItem[key] = { id: mov.item.id, name: mov.item.name, unit: mov.item.unit, quantity: 0 };
        byItem[key].quantity += mov.quantity;
      }

      const result = Object.values(byItem)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao buscar consumo de estoque." });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Placar do garçom: comandas lançadas hoje, agrupadas por operador
  // ─────────────────────────────────────────────────────────────

  app.get(
    "/api/tenants/:slug/waiter/leaderboard",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(
        req,
        res,
        req.params.slug,
        "waiter"
      );
      if (!tenant) return;

      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const orders = await prisma.order.findMany({
          where: {
            tenantId: tenant.id,
            orderType: "DINE_IN",
            status: { not: "CANCELLED" },
            createdAt: { gte: startOfDay },
            operatorName: { not: null },
          },
          select: { operatorName: true, total: true },
        });

        const byOperator = new Map<
          string,
          { operatorName: string; orderCount: number; total: number }
        >();
        for (const o of orders) {
          const name = o.operatorName as string;
          const entry = byOperator.get(name) ?? {
            operatorName: name,
            orderCount: 0,
            total: 0,
          };
          entry.orderCount += 1;
          entry.total += o.total;
          byOperator.set(name, entry);
        }

        const leaderboard = Array.from(byOperator.values()).sort(
          (a, b) => b.total - a.total
        );
        res.json(leaderboard);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Falha ao buscar placar." });
      }
    }
  );
}
