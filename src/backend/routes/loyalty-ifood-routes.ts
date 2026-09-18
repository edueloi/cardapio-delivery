import type { Express, Request, RequestHandler, Response } from "express";

export interface RegisterLoyaltyIfoodRoutesOptions {
  app: Express;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any;
  requireAuth: RequestHandler;
  requireTenantById: (
    req: Request,
    res: Response,
    tenantId: string,
    tabId?: string | string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any | null>;
}

export function registerLoyaltyIfoodRoutes({
  app,
  prisma,
  requireAuth,
  requireTenantById,
}: RegisterLoyaltyIfoodRoutesOptions) {
  // ── Fidelidade ──────────────────────────────────────────────────────────────
  app.post(
    "/api/admin/:tenantId/loyalty/config",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "loyalty"
      );
      if (!tenant) return;

      try {
        const {
          enabled,
          pointsPerReal,
          minPointsToRedeem,
          redemptionRatio,
          maxRedemptionValue,
        } = req.body;
        const config = {
          enabled: !!enabled,
          pointsPerReal: Number(pointsPerReal) || 1,
          minPointsToRedeem: Number(minPointsToRedeem) || 0,
          redemptionRatio: Number(redemptionRatio) || 0.1,
          maxRedemptionValue:
            maxRedemptionValue !== undefined &&
            maxRedemptionValue !== null &&
            maxRedemptionValue !== ""
              ? Number(maxRedemptionValue)
              : undefined,
        };
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { loyaltyConfig: JSON.stringify(config) },
        });
        res.json(config);
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ error: "Falha ao salvar configuração de fidelidade." });
      }
    }
  );

  app.get(
    "/api/admin/:tenantId/loyalty/customers",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "loyalty"
      );
      if (!tenant) return;

      try {
        const customers = await prisma.customer.findMany({
          where: { tenantId: tenant.id },
          orderBy: { totalSpent: "desc" },
        });
        res.json(
          customers.map((c) => ({
            id: c.id,
            tenantId: c.tenantId,
            customerPhone: c.phone,
            points: c.loyaltyPoints,
            totalSpent: c.totalSpent,
            ordersCount: c.ordersCount,
          }))
        );
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Falha ao buscar clientes." });
      }
    }
  );

  // ── Integração iFood ──────────────────────────────────────────────────────────
  // Guarda apenas as credenciais/config da loja. A conexão real com a Merchant API
  // (pedidos, catálogo, financeiro) é ativada depois que o iFood aprova a homologação
  // do client_id/client_secret gerados no Portal do Parceiro.
  app.get("/api/admin/:tenantId/ifood/config", requireAuth, async (req, res) => {
    const tenant = await requireTenantById(
      req,
      res,
      req.params.tenantId,
      "profile"
    );
    if (!tenant) return;

    try {
      const config = tenant.ifoodConfig ? JSON.parse(tenant.ifoodConfig) : null;
      // Nunca devolve o clientSecret em texto puro pro frontend — só indica se já foi preenchido
      if (config?.clientSecret) {
        config.hasClientSecret = true;
        delete config.clientSecret;
      }
      res.json(config);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao buscar configuração do iFood." });
    }
  });

  app.post("/api/admin/:tenantId/ifood/config", requireAuth, async (req, res) => {
    const tenant = await requireTenantById(
      req,
      res,
      req.params.tenantId,
      "profile"
    );
    if (!tenant) return;

    try {
      const { enabled, merchantId, clientId, clientSecret, autoAcceptOrders } =
        req.body;
      const existing = tenant.ifoodConfig ? JSON.parse(tenant.ifoodConfig) : {};

      const config = {
        enabled: !!enabled,
        merchantId: merchantId || existing.merchantId || null,
        clientId: clientId || existing.clientId || null,
        // só sobrescreve o secret se um novo valor foi enviado (evita apagar ao salvar outros campos)
        clientSecret:
          clientSecret !== undefined && clientSecret !== ""
            ? clientSecret
            : existing.clientSecret || null,
        autoAcceptOrders: !!autoAcceptOrders,
        status: existing.status || "NOT_CONNECTED", // NOT_CONNECTED | PENDING_APPROVAL | CONNECTED | ERROR
      };

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { ifoodConfig: JSON.stringify(config) },
      });

      const response = { ...config };
      if (response.clientSecret) {
        (response as any).hasClientSecret = true;
        delete (response as any).clientSecret;
      }
      res.json(response);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao salvar configuração do iFood." });
    }
  });

  // Webhook receiver — recebe eventos de pedido do iFood (PLACED, CONFIRMED, CANCELLED, etc).
  // Ainda não ativo: fica pronto para plugar assim que a homologação da Merchant API sair.
  app.post("/api/tenants/:slug/ifood/webhook", async (req, res) => {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug },
    });
    if (!tenant) return res.status(404).json({ error: "Loja não encontrada." });

    try {
      console.log(
        `[iFood webhook] ${tenant.slug}:`,
        JSON.stringify(req.body).slice(0, 500)
      );
      // TODO: quando a API estiver homologada, validar assinatura do iFood,
      // buscar detalhes do pedido via Order API e criar Order local com source: "IFOOD".
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to process iFood webhook" });
    }
  });
}
