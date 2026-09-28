import type { Express, Request, Response, NextFunction } from "express";
import { hashPassword } from "../auth";
import { sanitizeSlug } from "../shared/utils";

export interface RegisterExternalApiRoutesOptions {
  app: Express;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any;
}

// API server-to-server para outras aplicações (ex: store-stock) gerenciarem
// contas/tenants deste sistema — autenticada por API Key fixa (env var
// EXTERNAL_API_KEY), não pelo login de sessão humana usado no resto do app.
export function registerExternalApiRoutes({
  app,
  prisma,
}: RegisterExternalApiRoutesOptions) {
  function requireApiKey(req: Request, res: Response, next: NextFunction) {
    const key = req.header("x-api-key");
    if (!process.env.EXTERNAL_API_KEY) {
      return res.status(503).json({ error: "API externa não configurada no servidor." });
    }
    if (!key || key !== process.env.EXTERNAL_API_KEY) {
      return res.status(401).json({ error: "API key inválida ou ausente." });
    }
    next();
  }

  function serializeAccount(account: any) {
    return {
      id: account.id,
      name: account.name,
      email: account.email,
      createdAt: account.createdAt,
    };
  }

  function serializeTenant(tenant: any) {
    const subscription = tenant.account?.subscriptions?.[0] ?? null;
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      isOpen: tenant.isOpen,
      createdAt: tenant.createdAt,
      account: tenant.account
        ? {
            id: tenant.account.id,
            name: tenant.account.name,
            email: tenant.account.email,
          }
        : null,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            planId: subscription.planId,
            planName: subscription.plan?.name ?? null,
            pricePaid: subscription.pricePaid,
            startsAt: subscription.startsAt,
            expiresAt: subscription.expiresAt,
          }
        : null,
    };
  }

  const tenantWithAccountInclude = {
    account: {
      include: {
        subscriptions: {
          orderBy: { createdAt: "desc" as const },
          take: 1,
          include: { plan: true },
        },
      },
    },
  };

  // Precisa do accountId do dono para incluir a assinatura mais recente — Tenant
  // não tem accountId direto, o vínculo é via TenantMembership (role OWNER).
  async function findTenantWithOwner(tenantId: string) {
    const membership = await prisma.tenantMembership.findFirst({
      where: { tenantId, role: "OWNER" },
      select: { accountId: true },
    });
    if (!membership) return null;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return null;
    const account = await prisma.account.findUnique({
      where: { id: membership.accountId },
      include: tenantWithAccountInclude.account,
    });
    return { ...tenant, account };
  }

  // ── LISTAR / CONSULTAR ───────────────────────────────────────────────────────

  app.get("/api/external/tenants", requireApiKey, async (req, res) => {
    try {
      const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: "desc" } });
      const memberships = await prisma.tenantMembership.findMany({
        where: { tenantId: { in: tenants.map((t: any) => t.id) }, role: "OWNER" },
        select: { tenantId: true, accountId: true },
      });
      const accountIdByTenant = new Map(memberships.map((m: any) => [m.tenantId, m.accountId]));
      const accountIds = [...new Set(memberships.map((m: any) => m.accountId))];
      const accounts = await prisma.account.findMany({
        where: { id: { in: accountIds } },
        include: tenantWithAccountInclude.account,
      });
      const accountById = new Map(accounts.map((a: any) => [a.id, a]));

      const result = tenants.map((tenant: any) => {
        const accountId = accountIdByTenant.get(tenant.id);
        const account = accountId ? accountById.get(accountId) : null;
        return serializeTenant({ ...tenant, account });
      });
      res.json(result);
    } catch (error) {
      console.error("external/tenants list error:", error);
      res.status(500).json({ error: "Falha ao listar estabelecimentos." });
    }
  });

  app.get("/api/external/tenants/:id", requireApiKey, async (req, res) => {
    try {
      const tenant = await findTenantWithOwner(req.params.id);
      if (!tenant) return res.status(404).json({ error: "Estabelecimento não encontrado." });
      res.json(serializeTenant(tenant));
    } catch (error) {
      console.error("external/tenants get error:", error);
      res.status(500).json({ error: "Falha ao consultar estabelecimento." });
    }
  });

  // ── CRIAR (Conta + Tenant + Membership OWNER) ───────────────────────────────

  app.post("/api/external/tenants", requireApiKey, async (req, res) => {
    const { ownerName, ownerEmail, ownerPassword, tenantName, tenantSlug, planId } = req.body;

    if (!ownerName || !ownerEmail || !ownerPassword) {
      return res.status(400).json({ error: "ownerName, ownerEmail e ownerPassword são obrigatórios." });
    }
    if (!tenantName) {
      return res.status(400).json({ error: "tenantName é obrigatório." });
    }

    try {
      const existingAccount = await prisma.account.findUnique({ where: { email: ownerEmail } });
      if (existingAccount) {
        return res.status(400).json({ error: "Já existe uma conta com esse e-mail." });
      }

      const normalizedSlug = sanitizeSlug(tenantSlug || tenantName);
      if (!normalizedSlug) {
        return res.status(400).json({ error: "Slug inválido." });
      }
      const existingTenant = await prisma.tenant.findUnique({ where: { slug: normalizedSlug } });
      if (existingTenant) {
        return res.status(400).json({ error: "Já existe um estabelecimento com esse link." });
      }

      let plan = null;
      if (planId) {
        plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
        if (!plan) return res.status(400).json({ error: "Plano não encontrado." });
      }

      const account = await prisma.account.create({
        data: {
          name: String(ownerName).trim(),
          email: String(ownerEmail).trim().toLowerCase(),
          passwordHash: hashPassword(ownerPassword),
        },
      });

      const tenant = await prisma.tenant.create({
        data: {
          name: String(tenantName).trim(),
          slug: normalizedSlug,
        },
      });

      await prisma.tenantMembership.create({
        data: { accountId: account.id, tenantId: tenant.id, role: "OWNER" },
      });

      let subscription = null;
      if (plan) {
        const startsAt = new Date();
        const expiresAt = new Date(startsAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
        subscription = await prisma.subscription.create({
          data: {
            accountId: account.id,
            planId: plan.id,
            status: "ACTIVE",
            startsAt,
            expiresAt,
            pricePaid: plan.price,
          },
        });
      }

      res.status(201).json({
        account: serializeAccount(account),
        tenant: serializeTenant({ ...tenant, account: { ...account, subscriptions: subscription ? [{ ...subscription, plan }] : [] } }),
      });
    } catch (error) {
      console.error("external/tenants create error:", error);
      res.status(500).json({ error: "Falha ao criar estabelecimento." });
    }
  });

  // ── EDITAR ───────────────────────────────────────────────────────────────────

  app.patch("/api/external/tenants/:id", requireApiKey, async (req, res) => {
    const { name, description, address, whatsapp } = req.body;
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
      if (!tenant) return res.status(404).json({ error: "Estabelecimento não encontrado." });

      const updated = await prisma.tenant.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined && { name: String(name).trim() }),
          ...(description !== undefined && { description }),
          ...(address !== undefined && { address }),
          ...(whatsapp !== undefined && { whatsapp }),
        },
      });
      const withOwner = await findTenantWithOwner(updated.id);
      res.json(serializeTenant(withOwner));
    } catch (error) {
      console.error("external/tenants update error:", error);
      res.status(500).json({ error: "Falha ao editar estabelecimento." });
    }
  });

  // ── BLOQUEAR / DESBLOQUEAR (via status da assinatura) ───────────────────────

  app.post("/api/external/tenants/:id/block", requireApiKey, async (req, res) => {
    try {
      const membership = await prisma.tenantMembership.findFirst({
        where: { tenantId: req.params.id, role: "OWNER" },
        select: { accountId: true },
      });
      if (!membership) return res.status(404).json({ error: "Estabelecimento não encontrado." });

      await prisma.subscription.updateMany({
        where: { accountId: membership.accountId, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });

      const tenant = await findTenantWithOwner(req.params.id);
      res.json(serializeTenant(tenant));
    } catch (error) {
      console.error("external/tenants block error:", error);
      res.status(500).json({ error: "Falha ao bloquear estabelecimento." });
    }
  });

  app.post("/api/external/tenants/:id/unblock", requireApiKey, async (req, res) => {
    const { planId, durationDays } = req.body;
    try {
      const membership = await prisma.tenantMembership.findFirst({
        where: { tenantId: req.params.id, role: "OWNER" },
        select: { accountId: true },
      });
      if (!membership) return res.status(404).json({ error: "Estabelecimento não encontrado." });

      const latestCancelled = await prisma.subscription.findFirst({
        where: { accountId: membership.accountId },
        orderBy: { createdAt: "desc" },
        include: { plan: true },
      });

      const resolvedPlanId = planId || latestCancelled?.planId;
      if (!resolvedPlanId) {
        return res.status(400).json({ error: "planId é obrigatório (nenhuma assinatura anterior encontrada)." });
      }
      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: resolvedPlanId } });
      if (!plan) return res.status(400).json({ error: "Plano não encontrado." });

      const startsAt = new Date();
      const days = durationDays || plan.durationDays;
      const expiresAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);

      await prisma.subscription.create({
        data: {
          accountId: membership.accountId,
          planId: plan.id,
          status: "ACTIVE",
          startsAt,
          expiresAt,
          pricePaid: plan.price,
        },
      });

      const tenant = await findTenantWithOwner(req.params.id);
      res.json(serializeTenant(tenant));
    } catch (error) {
      console.error("external/tenants unblock error:", error);
      res.status(500).json({ error: "Falha ao desbloquear estabelecimento." });
    }
  });

  // ── DELETAR ──────────────────────────────────────────────────────────────────

  app.delete("/api/external/tenants/:id", requireApiKey, async (req, res) => {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
      if (!tenant) return res.status(404).json({ error: "Estabelecimento não encontrado." });
      await prisma.tenant.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (error) {
      console.error("external/tenants delete error:", error);
      res.status(500).json({ error: "Falha ao deletar estabelecimento." });
    }
  });

  // ── PLANOS (só leitura — "ver valores") ─────────────────────────────────────

  app.get("/api/external/plans", requireApiKey, async (req, res) => {
    try {
      const plans = await prisma.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: { price: "asc" },
      });
      res.json(
        plans.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          durationDays: p.durationDays,
        }))
      );
    } catch (error) {
      console.error("external/plans error:", error);
      res.status(500).json({ error: "Falha ao listar planos." });
    }
  });
}
