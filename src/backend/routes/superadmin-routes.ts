import type { Express, RequestHandler } from "express";
import express from "express";
import type { Multer } from "multer";
import { hashPassword } from "../auth";
import { sendInviteEmail } from "../mailer";
import { cuid, sanitizeSlug } from "../shared/utils";

export interface RegisterSuperAdminRoutesOptions {
  app: Express;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any;
  requireAuth: RequestHandler;
  upload: Multer;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentAccount: (req: any) => any;
}

export function registerSuperAdminRoutes({
  app,
  prisma,
  requireAuth,
  upload,
  currentAccount,
}: RegisterSuperAdminRoutesOptions) {
  // ── SUPER ADMIN ──────────────────────────────────────────────────────────────

  function requireSuperAdmin(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const account = currentAccount(req) as any;
    if (!account) return res.status(401).json({ error: "Login obrigatório." });
    if (!account.isSuperAdmin)
      return res.status(403).json({ error: "Acesso restrito ao super admin." });
    next();
  }

  // Lista todas as contas
  app.get(
    "/api/superadmin/accounts",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const accounts = await prisma.account.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            isSuperAdmin: true,
            createdAt: true,
            memberships: {
              select: {
                role: true,
                tenant: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        });
        res.json(accounts);
      } catch (error) {
        res.status(500).json({ error: "Falha ao listar contas." });
      }
    }
  );

  // Remove uma conta (não pode remover a si mesmo)
  app.delete(
    "/api/superadmin/accounts/:id",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      const me = currentAccount(req)!;
      if (req.params.id === me.id)
        return res
          .status(400)
          .json({ error: "Você não pode remover sua própria conta." });
      try {
        await prisma.account.delete({ where: { id: req.params.id } });
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Falha ao remover conta." });
      }
    }
  );

  // Troca a senha de uma conta (dono de loja) sem precisar da senha atual — usado quando o
  // usuário perdeu acesso ao e-mail de recuperação e chama o suporte.
  app.post(
    "/api/superadmin/accounts/:id/reset-password",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      const { password } = req.body;
      if (!password || String(password).length < 6) {
        return res
          .status(400)
          .json({ error: "A senha precisa ter pelo menos 6 caracteres." });
      }
      try {
        await prisma.account.update({
          where: { id: req.params.id },
          data: { passwordHash: hashPassword(String(password)) },
        });
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Falha ao trocar a senha." });
      }
    }
  );

  // Lista os convites gerados
  app.get(
    "/api/superadmin/invites",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const invites = await prisma.inviteToken.findMany({
          orderBy: { createdAt: "desc" },
          include: { createdBy: { select: { name: true, email: true } } },
        });
        res.json(invites);
      } catch (error) {
        res.status(500).json({ error: "Falha ao listar convites." });
      }
    }
  );

  // Gera novo convite (opcionalmente envia por email)
  app.post(
    "/api/superadmin/invites",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      const me = currentAccount(req)!;
      const { note, expiresInHours = 48, sendTo } = req.body;
      try {
        const token = [...Array(32)]
          .map(() => Math.random().toString(36)[2])
          .join("");
        const expiresAt = new Date(
          Date.now() + Number(expiresInHours) * 60 * 60 * 1000
        );
        const invite = await prisma.inviteToken.create({
          data: { token, createdById: me.id, expiresAt, note: note || null },
        });
        if (sendTo) {
          sendInviteEmail(String(sendTo).trim(), token, note).catch((err) => {
            console.error("[mailer] invite:", err);
          });
        }
        res.json(invite);
      } catch (error) {
        res.status(500).json({ error: "Falha ao gerar convite." });
      }
    }
  );

  // Revoga/deleta um convite (se ainda não usado)
  app.delete(
    "/api/superadmin/invites/:id",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      try {
        await prisma.inviteToken.delete({ where: { id: req.params.id } });
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Falha ao revogar convite." });
      }
    }
  );

  // Dashboard stats do super admin
  app.get(
    "/api/superadmin/stats",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const now = new Date();
        const [accounts, tenants, subscriptions, plans, invites] =
          await Promise.all([
            prisma.account.count(),
            prisma.tenant.count(),
            (prisma as any).subscription.findMany({
              include: {
                plan: true,
                account: { select: { id: true, name: true, email: true } },
              },
              orderBy: { createdAt: "desc" },
            }),
            (prisma as any).subscriptionPlan.findMany({
              orderBy: { price: "asc" },
            }),
            prisma.inviteToken.count(),
          ]);

        const activeSubscriptions = subscriptions.filter(
          (s: any) => s.status === "ACTIVE" && new Date(s.expiresAt) > now
        );
        const expiredSubscriptions = subscriptions.filter(
          (s: any) => new Date(s.expiresAt) <= now
        );
        const monthlyRevenue = subscriptions
          .filter((s: any) => {
            const d = new Date(s.createdAt);
            return (
              d.getMonth() === now.getMonth() &&
              d.getFullYear() === now.getFullYear()
            );
          })
          .reduce((acc: number, s: any) => acc + s.pricePaid, 0);
        const totalRevenue = subscriptions.reduce(
          (acc: number, s: any) => acc + s.pricePaid,
          0
        );

        // Receita por mês (últimos 6 meses)
        const revenueByMonth: Record<string, number> = {};
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
            2,
            "0"
          )}`;
          revenueByMonth[key] = 0;
        }
        subscriptions.forEach((s: any) => {
          const d = new Date(s.createdAt);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
            2,
            "0"
          )}`;
          if (key in revenueByMonth) revenueByMonth[key] += s.pricePaid;
        });

        res.json({
          accounts,
          tenants,
          invites,
          totalRevenue,
          monthlyRevenue,
          activeSubscriptions: activeSubscriptions.length,
          expiredSubscriptions: expiredSubscriptions.length,
          revenueByMonth,
          subscriptions,
          plans,
        });
      } catch (error) {
        console.error("ERRO superadmin/stats:", error);
        res.status(500).json({ error: "Falha ao carregar stats." });
      }
    }
  );

  // Lista planos
  app.get(
    "/api/superadmin/plans",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const plans = await (prisma as any).subscriptionPlan.findMany({
          orderBy: { price: "asc" },
        });
        res.json(plans);
      } catch (error) {
        res.status(500).json({ error: "Falha ao listar planos." });
      }
    }
  );

  // Cria plano
  app.post(
    "/api/superadmin/plans",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      const {
        name,
        description,
        price,
        durationDays,
        features,
        color,
        defaultStaffPermissions,
      } = req.body;
      try {
        const plan = await (prisma as any).subscriptionPlan.create({
          data: {
            name,
            description: description || null,
            price: Number(price) || 0,
            durationDays: Number(durationDays) || 30,
            features: features || null,
            color: color || "#C9A227",
            defaultStaffPermissions: defaultStaffPermissions ?? null,
          },
        });
        res.json(plan);
      } catch (error) {
        res.status(500).json({ error: "Falha ao criar plano." });
      }
    }
  );

  // Edita plano
  app.patch(
    "/api/superadmin/plans/:id",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      const {
        name,
        description,
        price,
        durationDays,
        features,
        color,
        isActive,
        defaultStaffPermissions,
      } = req.body;
      try {
        const plan = await (prisma as any).subscriptionPlan.update({
          where: { id: req.params.id },
          data: {
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
            ...(price !== undefined && { price: Number(price) }),
            ...(durationDays !== undefined && {
              durationDays: Number(durationDays),
            }),
            ...(features !== undefined && { features }),
            ...(color !== undefined && { color }),
            ...(isActive !== undefined && { isActive: Boolean(isActive) }),
            ...(defaultStaffPermissions !== undefined && {
              defaultStaffPermissions: defaultStaffPermissions ?? null,
            }),
          },
        });
        res.json(plan);
      } catch (error) {
        res.status(500).json({ error: "Falha ao editar plano." });
      }
    }
  );

  // Remove plano
  app.delete(
    "/api/superadmin/plans/:id",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      try {
        await (prisma as any).subscriptionPlan.delete({
          where: { id: req.params.id },
        });
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Falha ao remover plano." });
      }
    }
  );

  // Lista assinaturas
  app.get(
    "/api/superadmin/subscriptions",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const subs = await (prisma as any).subscription.findMany({
          include: {
            plan: true,
            account: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        });
        res.json(subs);
      } catch (error) {
        res.status(500).json({ error: "Falha ao listar assinaturas." });
      }
    }
  );

  // Cria assinatura para uma conta
  app.post(
    "/api/superadmin/subscriptions",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      const me = currentAccount(req)!;
      const { accountId, planId, pricePaid, notes, startsAt } = req.body;
      try {
        const plan = await (prisma as any).subscriptionPlan.findUnique({
          where: { id: planId },
        });
        if (!plan)
          return res.status(404).json({ error: "Plano não encontrado." });
        const start = startsAt ? new Date(startsAt) : new Date();
        const expires = new Date(
          start.getTime() + plan.durationDays * 24 * 60 * 60 * 1000
        );
        const sub = await (prisma as any).subscription.create({
          data: {
            accountId,
            planId,
            pricePaid: Number(pricePaid) || plan.price,
            notes: notes || null,
            startsAt: start,
            expiresAt: expires,
            createdById: me.id,
            status: "ACTIVE",
          },
          include: {
            plan: true,
            account: { select: { id: true, name: true, email: true } },
          },
        });
        res.json(sub);
      } catch (error) {
        res.status(500).json({ error: "Falha ao criar assinatura." });
      }
    }
  );

  // Cancela assinatura
  app.delete(
    "/api/superadmin/subscriptions/:id",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      try {
        await (prisma as any).subscription.update({
          where: { id: req.params.id },
          data: { status: "CANCELLED" },
        });
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Falha ao cancelar assinatura." });
      }
    }
  );


  // ── Condomínios: CRUD superadmin (SQL raw — Prisma client não gerado ainda) ───
  function cuid() {
    return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
  }

  async function getCondominiumWithTenants(id?: string, slug?: string) {
    const where = id ? `c.id = ?` : `c.slug = ? AND c.is_active = 1`;
    const param = id ?? slug;
    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      SELECT c.id, c.name, c.slug, c.description, c.logo_url as logoUrl, c.banner_url as bannerUrl,
             c.primary_color as primaryColor, c.address, c.is_active as isActive,
             c.created_at as createdAt, c.updated_at as updatedAt,
             ct.id as ct_id, ct.sort_order as ct_sort,
             t.id as t_id, t.name as t_name, t.slug as t_slug, t.logoUrl as t_logo,
             t.description as t_desc, t.address as t_addr, t.is_open as t_isOpen,
             t.business_hours as t_hours, t.whatsapp as t_whatsapp
      FROM condominiums c
      LEFT JOIN condominium_tenants ct ON ct.condominium_id = c.id
      LEFT JOIN tenants t ON t.id = ct.tenant_id
      WHERE ${where}
      ORDER BY ct.sort_order ASC
    `,
      param
    );

    if (rows.length === 0) return null;

    const cond = {
      id: rows[0].id,
      name: rows[0].name,
      slug: rows[0].slug,
      description: rows[0].description,
      logoUrl: rows[0].logoUrl,
      bannerUrl: rows[0].bannerUrl,
      primaryColor: rows[0].primaryColor,
      address: rows[0].address,
      isActive: !!rows[0].isActive,
      createdAt: rows[0].createdAt,
      updatedAt: rows[0].updatedAt,
      tenants: rows
        .filter((r) => r.ct_id)
        .map((r) => ({
          id: r.ct_id,
          sortOrder: r.ct_sort,
          tenant: {
            id: r.t_id,
            name: r.t_name,
            slug: r.t_slug,
            logoUrl: r.t_logo,
            description: r.t_desc,
            address: r.t_addr,
            isOpen: !!r.t_isOpen,
            businessHours: r.t_hours,
            whatsapp: r.t_whatsapp,
          },
        })),
    };
    return cond;
  }


  app.get(
    "/api/superadmin/condominiums",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const ids: any[] = await prisma.$queryRawUnsafe(
          `SELECT id FROM condominiums ORDER BY created_at DESC`
        );
        const results = await Promise.all(
          ids.map((r: any) => getCondominiumWithTenants(r.id))
        );
        res.json(results.filter(Boolean));
      } catch (e: any) {
        res
          .status(500)
          .json({ error: "Erro ao listar condomínios.", detail: e?.message });
      }
    }
  );

  app.post(
    "/api/superadmin/condominiums",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      const { name, slug, description, address, primaryColor } = req.body;
      if (!name || !slug)
        return res.status(400).json({ error: "Nome e slug são obrigatórios." });
      const normalizedSlug = sanitizeSlug(slug);
      if (!normalizedSlug)
        return res.status(400).json({ error: "Slug inválido." });
      try {
        const existing: any[] = await prisma.$queryRawUnsafe(
          `SELECT id FROM condominiums WHERE slug = ?`,
          normalizedSlug
        );
        if (existing.length > 0)
          return res
            .status(400)
            .json({ error: "Já existe um condomínio com esse slug." });
        const id = cuid();
        await prisma.$executeRawUnsafe(
          `INSERT INTO condominiums (id, name, slug, description, address, primary_color, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?,1,NOW(),NOW())`,
          id,
          name,
          normalizedSlug,
          description ?? null,
          address ?? null,
          primaryColor || "#C9A227"
        );
        const cond = await getCondominiumWithTenants(id);
        if (!cond)
          return res
            .status(500)
            .json({ error: "Condomínio criado mas não encontrado." });
        res.json(cond);
      } catch (e: any) {
        res
          .status(500)
          .json({ error: "Erro ao criar condomínio.", detail: e?.message });
      }
    }
  );

  app.patch(
    "/api/superadmin/condominiums/:id",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      const {
        name,
        description,
        address,
        primaryColor,
        isActive,
        logoUrl,
        bannerUrl,
      } = req.body;
      try {
        // Se apenas removendo imagem (logoUrl ou bannerUrl passados explicitamente como null)
        if (
          Object.keys(req.body).length === 1 &&
          ("logoUrl" in req.body || "bannerUrl" in req.body)
        ) {
          const col = "logoUrl" in req.body ? "logo_url" : "banner_url";
          await prisma.$executeRawUnsafe(
            `UPDATE condominiums SET ${col}=NULL, updated_at=NOW() WHERE id=?`,
            req.params.id
          );
          return res.json({ success: true });
        }
        await prisma.$executeRawUnsafe(
          `UPDATE condominiums SET name=?, description=?, address=?, primary_color=?, is_active=?, updated_at=NOW() WHERE id=?`,
          name ?? null,
          description ?? null,
          address ?? null,
          primaryColor ?? null,
          isActive === undefined ? 1 : isActive ? 1 : 0,
          req.params.id
        );
        const cond = await getCondominiumWithTenants(req.params.id);
        res.json(cond);
      } catch (e: any) {
        res
          .status(500)
          .json({ error: "Erro ao atualizar condomínio.", detail: e?.message });
      }
    }
  );

  app.delete(
    "/api/superadmin/condominiums/:id",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      try {
        await prisma.$executeRawUnsafe(
          `DELETE FROM condominiums WHERE id=?`,
          req.params.id
        );
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: "Erro ao excluir condomínio." });
      }
    }
  );

  // upload logo/banner condomínio
  app.post(
    "/api/superadmin/condominiums/:id/logo",
    requireAuth,
    requireSuperAdmin,
    upload.single("file"),
    async (req, res) => {
      if (!req.file)
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
      const url = `/uploads/${req.file.filename}`;
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE condominiums SET logo_url=?, updated_at=NOW() WHERE id=?`,
          url,
          req.params.id
        );
        res.json({ url });
      } catch (e) {
        res.status(500).json({ error: "Erro ao salvar logo." });
      }
    }
  );

  app.post(
    "/api/superadmin/condominiums/:id/banner",
    requireAuth,
    requireSuperAdmin,
    upload.single("file"),
    async (req, res) => {
      if (!req.file)
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
      const url = `/uploads/${req.file.filename}`;
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE condominiums SET banner_url=?, updated_at=NOW() WHERE id=?`,
          url,
          req.params.id
        );
        res.json({ url });
      } catch (e) {
        res.status(500).json({ error: "Erro ao salvar banner." });
      }
    }
  );

  // vínculos: adicionar/remover tenant de um condomínio
  app.post(
    "/api/superadmin/condominiums/:id/tenants",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      const { tenantId, sortOrder } = req.body;
      if (!tenantId)
        return res.status(400).json({ error: "tenantId obrigatório." });
      try {
        const dup: any[] = await prisma.$queryRawUnsafe(
          `SELECT id FROM condominium_tenants WHERE condominium_id=? AND tenant_id=?`,
          req.params.id,
          tenantId
        );
        if (dup.length > 0)
          return res.status(400).json({ error: "Estabelecimento já vinculado." });
        const id = cuid();
        await prisma.$executeRawUnsafe(
          `INSERT INTO condominium_tenants (id, condominium_id, tenant_id, sort_order, created_at) VALUES (?,?,?,?,NOW())`,
          id,
          req.params.id,
          tenantId,
          sortOrder ?? 0
        );
        res.json({
          id,
          condominiumId: req.params.id,
          tenantId,
          sortOrder: sortOrder ?? 0,
        });
      } catch (e: any) {
        res
          .status(500)
          .json({
            error: "Erro ao vincular estabelecimento.",
            detail: e?.message,
          });
      }
    }
  );

  app.delete(
    "/api/superadmin/condominiums/:id/tenants/:tenantId",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      try {
        await prisma.$executeRawUnsafe(
          `DELETE FROM condominium_tenants WHERE condominium_id=? AND tenant_id=?`,
          req.params.id,
          req.params.tenantId
        );
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: "Erro ao desvincular estabelecimento." });
      }
    }
  );

  // ── Condomínios do tenant (painel do dono) ────────────────────────────────────
  app.get(
    "/api/owner/tenants/:tenantId/condominiums",
    requireAuth,
    async (req, res) => {
      try {
        const rows: any[] = await prisma.$queryRawUnsafe(
          `
        SELECT c.id, c.name, c.slug, c.logo_url as logoUrl, c.primary_color as primaryColor,
               ct.id as ct_id, ct.sort_order as sortOrder,
               ct.local_address as localAddress, ct.local_hours as localHours
        FROM condominium_tenants ct
        JOIN condominiums c ON c.id = ct.condominium_id
        WHERE ct.tenant_id = ?
        ORDER BY c.name ASC
      `,
          req.params.tenantId
        );
        res.json(rows);
      } catch (e: any) {
        res
          .status(500)
          .json({ error: "Erro ao buscar condomínios.", detail: e?.message });
      }
    }
  );

  // Salvar endereço/horário local do tenant no condomínio
  app.patch(
    "/api/owner/tenants/:tenantId/condominiums/:condId",
    requireAuth,
    async (req, res) => {
      const { localAddress, localHours } = req.body;
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE condominium_tenants SET local_address=?, local_hours=? WHERE tenant_id=? AND condominium_id=?`,
          localAddress ?? null,
          localHours ?? null,
          req.params.tenantId,
          req.params.condId
        );
        res.json({ success: true });
      } catch (e: any) {
        res.status(500).json({ error: "Erro ao salvar.", detail: e?.message });
      }
    }
  );

  // ── Condomínios: rota pública ─────────────────────────────────────────────────
  app.get("/api/cond/:slug", async (req, res) => {
    try {
      const cond = await getCondominiumWithTenants(undefined, req.params.slug);
      if (!cond)
        return res.status(404).json({ error: "Condomínio não encontrado." });
      res.json(cond);
    } catch (e) {
      res.status(500).json({ error: "Erro ao buscar condomínio." });
    }
  });

  // lista todos os tenants (para o superadmin vincular)
  app.get(
    "/api/superadmin/tenants-list",
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const tenants = await prisma.tenant.findMany({
          select: { id: true, name: true, slug: true, logoUrl: true },
          orderBy: { name: "asc" },
        });
        res.json(tenants);
      } catch (e) {
        res.status(500).json({ error: "Erro ao listar tenants." });
      }
    }
  );
}
