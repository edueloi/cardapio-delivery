import type { Express, Request, RequestHandler, Response } from "express";
import type { Server } from "socket.io";
import { hydrateOrderItemNames } from "../shared/order-helpers";

export interface RegisterPaymentRoutesOptions {
  app: Express;
  io: Server;
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
  updateOrderStatus: (
    orderId: string,
    previousStatus: string,
    status: string,
    kitchenReady?: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any>;
}

export function registerPaymentRoutes({
  app,
  io,
  prisma,
  requireAuth,
  requireTenantBySlug,
  updateOrderStatus,
}: RegisterPaymentRoutesOptions) {
  // ── STONE / MAQUININHA ──────────────────────────────────────────────────────
  // Sends a charge to the Stone (Pagar.me) POS terminal.
  // The terminal displays the payment for the customer; result comes via webhook.
  // ─────────────────────────────────────────────────────────────────────────────

  app.post("/api/tenants/:slug/stone/charge", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "pos");
    if (!tenant) return;

    let stoneCfg: {
      enabled: boolean;
      secretKey: string;
      stonecode: string;
    } | null = null;
    try {
      stoneCfg = tenant.stoneConfig
        ? JSON.parse(tenant.stoneConfig as string)
        : null;
    } catch {
      /* ignore */
    }

    if (!stoneCfg?.enabled || !stoneCfg.secretKey || !stoneCfg.stonecode) {
      return res
        .status(400)
        .json({ error: "Stone não configurado para este estabelecimento." });
    }

    const { orderId, amount, paymentType } = req.body;
    // paymentType: "credit" | "debit" | "pix"

    if (!orderId || !amount || !paymentType) {
      return res
        .status(400)
        .json({ error: "orderId, amount e paymentType são obrigatórios." });
    }

    try {
      const order = await prisma.order.findFirst({
        where: { id: orderId, tenantId: tenant.id },
      });
      if (!order)
        return res.status(404).json({ error: "Pedido não encontrado." });

      const authToken = Buffer.from(`${stoneCfg.secretKey}:`).toString("base64");
      const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(
        /\/$/,
        ""
      );

      const pagarmePayload: any = {
        items: [
          {
            amount: Math.round(amount * 100), // centavos
            description: `Pedido ${orderId.slice(-6).toUpperCase()}`,
            quantity: 1,
            code: orderId.slice(-8),
          },
        ],
        customer: {
          name: order.customerName || "Cliente",
          type: "individual",
          document: "00000000000",
          document_type: "CPF",
          phones: {
            home_phone: {
              country_code: "55",
              area_code: "11",
              number: "000000000",
            },
          },
        },
        payments: [
          {
            payment_method: paymentType === "pix" ? "pix" : "credit_card",
            ...(paymentType !== "pix" && {
              credit_card: {
                installments: 1,
                statement_descriptor: (tenant.name || "Loja").slice(0, 22),
              },
            }),
          },
        ],
        closed: false,
        poi_payment_settings: {
          stonecode: stoneCfg.stonecode,
          payment_origin: "pos",
        },
        metadata: { order_id: orderId, tenant_slug: tenant.slug },
      };

      const response = await fetch("https://api.pagar.me/core/v5/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authToken}`,
        },
        body: JSON.stringify(pagarmePayload),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        console.error("Stone charge error:", data);
        return res
          .status(502)
          .json({ error: data.message || "Erro ao criar cobrança na Stone." });
      }

      // Store Stone charge ID on the order
      await prisma.order.update({
        where: { id: orderId },
        data: { stoneChargeId: data.id },
      });

      res.json({ chargeId: data.id, status: data.status });
    } catch (error) {
      console.error("Stone charge error:", error);
      res.status(500).json({ error: "Erro ao comunicar com a Stone." });
    }
  });

  // Webhook from Stone terminal — confirms payment result
  app.post("/api/tenants/:slug/stone/webhook", async (req, res) => {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug },
    });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    try {
      const event = req.body;
      const chargeId: string = event?.data?.id || event?.id;
      const status: string = event?.data?.status || event?.status;

      if (!chargeId) return res.status(400).json({ error: "Missing charge id" });

      // Find matching order
      const order = await prisma.order.findFirst({
        where: { stoneChargeId: chargeId, tenantId: tenant.id },
        include: { items: { include: { product: true } } },
      });
      if (!order) return res.status(200).json({ received: true }); // idempotent
      hydrateOrderItemNames(order);

      if (status === "paid") {
        // Mark order delivered (debita estoque, dá pontos, avisa socket — via updateOrderStatus,
        // mesma função usada em toda mudança de status no resto do app) e registra o movimento de caixa.
        if (order.status !== "DELIVERED") {
          await updateOrderStatus(order.id, order.status, "DELIVERED");
        }

        const currentCash = await prisma.cashRegister.findFirst({
          where: { tenantId: tenant.id, status: "OPEN" },
          orderBy: { openedAt: "desc" },
        });
        if (currentCash) {
          const chargeAmount = event?.data?.amount
            ? event.data.amount / 100
            : order.total;
          await prisma.cashMovement.create({
            data: {
              cashRegisterId: currentCash.id,
              tenantId: tenant.id,
              type: "PAYMENT_STONE",
              amount: chargeAmount,
              description: `Stone Maquininha #${order.id
                .slice(-6)
                .toUpperCase()}`,
              orderId: order.id,
            },
          });
        }

        io.to(`tenant-${tenant.id}`).emit("stone:paid", {
          orderId: order.id,
          chargeId,
        });
      } else if (status === "failed" || status === "canceled") {
        io.to(`tenant-${tenant.id}`).emit("stone:failed", {
          orderId: order.id,
          chargeId,
          status,
        });
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Stone webhook error:", error);
      res.status(500).json({ error: "Webhook processing error" });
    }
  });

  // Poll Stone charge status (fallback when webhook is not available)
  app.get(
    "/api/tenants/:slug/stone/charge/:chargeId",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(req, res, req.params.slug, "pos");
      if (!tenant) return;

      let stoneCfg: {
        enabled: boolean;
        secretKey: string;
        stonecode: string;
      } | null = null;
      try {
        stoneCfg = tenant.stoneConfig
          ? JSON.parse(tenant.stoneConfig as string)
          : null;
      } catch {
        /* ignore */
      }

      if (!stoneCfg?.secretKey)
        return res.status(400).json({ error: "Stone não configurado." });

      try {
        const authToken = Buffer.from(`${stoneCfg.secretKey}:`).toString(
          "base64"
        );
        const response = await fetch(
          `https://api.pagar.me/core/v5/orders/${req.params.chargeId}`,
          {
            headers: { Authorization: `Basic ${authToken}` },
          }
        );
        const data = (await response.json()) as any;
        if (!response.ok)
          return res
            .status(502)
            .json({ error: data.message || "Erro ao consultar Stone." });

        // If paid and not yet registered, process it
        if (data.status === "paid") {
          const order = await prisma.order.findFirst({
            where: { stoneChargeId: req.params.chargeId, tenantId: tenant.id },
          });
          if (order && order.status !== "DELIVERED") {
            await updateOrderStatus(order.id, order.status, "DELIVERED");
            const currentCash = await prisma.cashRegister.findFirst({
              where: { tenantId: tenant.id, status: "OPEN" },
              orderBy: { openedAt: "desc" },
            });
            if (currentCash) {
              await prisma.cashMovement
                .create({
                  data: {
                    cashRegisterId: currentCash.id,
                    tenantId: tenant.id,
                    type: "PAYMENT_STONE",
                    amount: data.amount ? data.amount / 100 : order.total,
                    description: `Stone Maquininha #${order.id
                      .slice(-6)
                      .toUpperCase()}`,
                    orderId: order.id,
                  },
                })
                .catch(() => {});
            }
            io.to(`tenant-${tenant.id}`).emit("stone:paid", {
              orderId: order.id,
              chargeId: req.params.chargeId,
            });
          }
        }

        res.json({ status: data.status, chargeId: req.params.chargeId });
      } catch (error) {
        console.error("Stone poll error:", error);
        res.status(500).json({ error: "Erro ao consultar Stone." });
      }
    }
  );

  // ── CIELO LIO SMART (integração remota) ─────────────────────────────────────
  // O PDV cria um pedido na Order Manager API da Cielo; o terminal físico (LIO
  // Smart) busca esse pedido na nuvem e exibe pro cliente passar o cartão/PIX.
  // A Cielo confirma via webhook (push), sem precisar de polling na maioria dos
  // casos — o endpoint de poll abaixo é só um fallback, igual ao da Stone.
  //
  // Client-ID e Access Token são da APLICAÇÃO (Develoi), cadastrada uma única
  // vez no Portal de Desenvolvedores Cielo — os mesmos para todos os tenants,
  // por isso vêm de env var (igual STRIPE_SECRET_KEY), não do cadastro de cada
  // cliente. Só o Merchant-ID muda por tenant (identifica o estabelecimento/
  // terminal físico dele) — esse sim fica em cieloConfig no banco.
  // ─────────────────────────────────────────────────────────────────────────────

  type CieloCfg = {
    enabled: boolean;
    merchantId: string;
  };

  function getCieloCfg(tenant: any): CieloCfg | null {
    try {
      const cfg = tenant.cieloConfig ? JSON.parse(tenant.cieloConfig as string) : null;
      if (!cfg?.enabled || !cfg.merchantId) return null;
      if (!process.env.CIELO_CLIENT_ID || !process.env.CIELO_ACCESS_TOKEN) return null;
      return cfg;
    } catch {
      return null;
    }
  }

  function cieloBaseUrl() {
    return process.env.CIELO_ENVIRONMENT === "production"
      ? "https://api.cielo.com.br/order-management/v1"
      : "https://api.cielo.com.br/sandbox-lio/order-management/v1";
  }

  function cieloHeaders(cfg: CieloCfg) {
    return {
      "Content-Type": "application/json",
      "client-id": process.env.CIELO_CLIENT_ID!,
      "access-token": process.env.CIELO_ACCESS_TOKEN!,
      "merchant-id": cfg.merchantId,
    };
  }

  const CIELO_PAYMENT_CODE: Record<string, string> = {
    credit: "CREDIT",
    debit: "DEBIT",
    pix: "PIX",
  };

  app.post("/api/tenants/:slug/cielo/charge", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "pos");
    if (!tenant) return;

    const cieloCfg = getCieloCfg(tenant);
    if (!cieloCfg) {
      return res
        .status(400)
        .json({ error: "Cielo não configurada para este estabelecimento." });
    }

    const { orderId, amount, paymentType } = req.body;
    // paymentType: "credit" | "debit" | "pix"

    if (!orderId || !amount || !paymentType) {
      return res
        .status(400)
        .json({ error: "orderId, amount e paymentType são obrigatórios." });
    }

    try {
      const order = await prisma.order.findFirst({
        where: { id: orderId, tenantId: tenant.id },
      });
      if (!order)
        return res.status(404).json({ error: "Pedido não encontrado." });

      const cieloPayload = {
        reference: `Pedido ${orderId.slice(-6).toUpperCase()}`,
        status: "DRAFT",
        items: [
          {
            sku: orderId.slice(-12),
            name: `Pedido ${orderId.slice(-6).toUpperCase()}`,
            unit_price: String(Math.round(amount * 100)), // centavos
            quantity: "1",
            unit_of_measure: "EACH",
          },
        ],
        price: String(Math.round(amount * 100)), // centavos
        payment_code: CIELO_PAYMENT_CODE[paymentType] || "CREDIT",
      };

      const response = await fetch(`${cieloBaseUrl()}/orders`, {
        method: "POST",
        headers: cieloHeaders(cieloCfg),
        body: JSON.stringify(cieloPayload),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        console.error("Cielo charge error:", data);
        return res
          .status(502)
          .json({ error: data.message || "Erro ao criar cobrança na Cielo." });
      }

      // Store Cielo order id on the order
      await prisma.order.update({
        where: { id: orderId },
        data: { cieloOrderId: data.id },
      });

      res.json({ chargeId: data.id, status: data.status });
    } catch (error) {
      console.error("Cielo charge error:", error);
      res.status(500).json({ error: "Erro ao comunicar com a Cielo." });
    }
  });

  // Webhook from Cielo Order Manager — pushed on every order status change.
  // URL FIXA (uma só, cadastrada uma vez no Portal de Desenvolvedores Cielo, não
  // por tenant): a Cielo não permite uma URL por estabelecimento nesse modelo de
  // credenciamento, então o tenant é resolvido pelo cieloOrderId salvo no Order
  // (globalmente único, gerado pela própria Cielo) e confirmado batendo o
  // merchant-id do evento contra o cieloConfig do tenant — evita que alguém
  // chame esse endpoint forjando eventos de outro estabelecimento.
  app.post("/api/webhooks/cielo", async (req, res) => {
    try {
      const event = req.body;
      const cieloOrderId: string = event?.id || event?.order?.id;
      const status: string = event?.status || event?.order?.status;
      const merchantId: string | undefined = event?.merchant_id || event?.merchantId;

      if (!cieloOrderId) return res.status(400).json({ error: "Missing order id" });

      const order = await prisma.order.findFirst({
        where: { cieloOrderId },
        include: { items: { include: { product: true } }, tenant: true },
      });
      if (!order) return res.status(200).json({ received: true }); // idempotent

      const tenant = order.tenant;
      const cieloCfg = getCieloCfg(tenant);
      if (!cieloCfg || (merchantId && merchantId !== cieloCfg.merchantId)) {
        return res.status(200).json({ received: true }); // merchant não bate — ignora silenciosamente
      }

      hydrateOrderItemNames(order);

      // Status da Cielo: DRAFT, ENTERED, PAID, CLOSED, RE_ENTERED
      if (status === "PAID" || status === "CLOSED") {
        if (order.status !== "DELIVERED") {
          await updateOrderStatus(order.id, order.status, "DELIVERED");

          const currentCash = await prisma.cashRegister.findFirst({
            where: { tenantId: tenant.id, status: "OPEN" },
            orderBy: { openedAt: "desc" },
          });
          if (currentCash) {
            const chargeAmount = event?.price
              ? Number(event.price) / 100
              : order.total;
            await prisma.cashMovement.create({
              data: {
                cashRegisterId: currentCash.id,
                tenantId: tenant.id,
                type: "PAYMENT_CIELO",
                amount: chargeAmount,
                description: `Cielo Maquininha #${order.id
                  .slice(-6)
                  .toUpperCase()}`,
                orderId: order.id,
              },
            });
          }

          io.to(`tenant-${tenant.id}`).emit("cielo:paid", {
            orderId: order.id,
            cieloOrderId,
          });
        }
      } else if (status === "CANCELLED" || status === "CANCELED") {
        io.to(`tenant-${tenant.id}`).emit("cielo:failed", {
          orderId: order.id,
          cieloOrderId,
          status,
        });
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Cielo webhook error:", error);
      res.status(500).json({ error: "Webhook processing error" });
    }
  });

  // Poll Cielo order status (fallback when webhook is not received)
  app.get(
    "/api/tenants/:slug/cielo/charge/:chargeId",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(req, res, req.params.slug, "pos");
      if (!tenant) return;

      const cieloCfg = getCieloCfg(tenant);
      if (!cieloCfg)
        return res.status(400).json({ error: "Cielo não configurada." });

      try {
        const response = await fetch(
          `${cieloBaseUrl()}/orders/${req.params.chargeId}`,
          { headers: cieloHeaders(cieloCfg) }
        );
        const data = (await response.json()) as any;
        if (!response.ok)
          return res
            .status(502)
            .json({ error: data.message || "Erro ao consultar Cielo." });

        if (data.status === "PAID" || data.status === "CLOSED") {
          const order = await prisma.order.findFirst({
            where: { cieloOrderId: req.params.chargeId, tenantId: tenant.id },
          });
          if (order && order.status !== "DELIVERED") {
            await updateOrderStatus(order.id, order.status, "DELIVERED");
            const currentCash = await prisma.cashRegister.findFirst({
              where: { tenantId: tenant.id, status: "OPEN" },
              orderBy: { openedAt: "desc" },
            });
            if (currentCash) {
              await prisma.cashMovement
                .create({
                  data: {
                    cashRegisterId: currentCash.id,
                    tenantId: tenant.id,
                    type: "PAYMENT_CIELO",
                    amount: data.price ? Number(data.price) / 100 : order.total,
                    description: `Cielo Maquininha #${order.id
                      .slice(-6)
                      .toUpperCase()}`,
                    orderId: order.id,
                  },
                })
                .catch(() => {});
            }
            io.to(`tenant-${tenant.id}`).emit("cielo:paid", {
              orderId: order.id,
              cieloOrderId: req.params.chargeId,
            });
          }
        }

        res.json({ status: data.status, chargeId: req.params.chargeId });
      } catch (error) {
        console.error("Cielo poll error:", error);
        res.status(500).json({ error: "Erro ao consultar Cielo." });
      }
    }
  );
}
