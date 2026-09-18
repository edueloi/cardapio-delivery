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
}

export function registerPaymentRoutes({
  app,
  io,
  prisma,
  requireAuth,
  requireTenantBySlug,
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
        // Mark order delivered and register cash movement
        await prisma.order.update({
          where: { id: order.id },
          data: { status: "DELIVERED" },
        });

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
            await prisma.order.update({
              where: { id: order.id },
              data: { status: "DELIVERED" },
            });
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
}
