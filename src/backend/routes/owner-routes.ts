import type { Express, RequestHandler, Request, Response } from "express";
import type { Multer } from "multer";
import { getAuthorizedTenantById, listAccountTenants } from "../auth";
import { sendInviteEmail } from "../mailer";
import {
  connectSession,
  disconnectSession,
  getQrCode,
  getSessionInfo,
  sendMessage,
} from "../wpp/baileys-manager";
import { normalizeEmail, sanitizeSlug } from "../shared/utils";

export interface RegisterOwnerRoutesOptions {
  app: Express;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any;
  requireAuth: RequestHandler;
  upload: Multer;
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
  ensureWppSetup: (tenantId: string, tenantName: string) => Promise<unknown>;
}

export function registerOwnerRoutes({
  app,
  prisma,
  requireAuth,
  upload,
  currentAccount,
  requireTenantById,
  requireTenantBySlug,
  ensureWppSetup,
}: RegisterOwnerRoutesOptions) {
  app.get("/api/owner/tenants", requireAuth, async (req, res) => {
    const account = currentAccount(req)!;
    const tenants = await listAccountTenants(account.id);
    res.json(tenants);
  });

  app.post("/api/owner/tenants", requireAuth, async (req, res) => {
    const account = currentAccount(req)!;
    const { name, slug, description, address, whatsapp } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({ error: "Nome do estabelecimento é obrigatório." });
    }

    try {
      const normalizedSlug = sanitizeSlug(slug || name);
      if (!normalizedSlug) {
        return res.status(400).json({ error: "Slug inválido." });
      }

      const existing = await prisma.tenant.findUnique({
        where: { slug: normalizedSlug },
      });
      if (existing) {
        return res
          .status(400)
          .json({ error: "Já existe um estabelecimento com esse link." });
      }

      const tenant = await prisma.tenant.create({
        data: {
          name: String(name).trim(),
          slug: normalizedSlug,
          description: description || null,
          address: address || null,
          whatsapp: whatsapp || null,
        },
      });

      await prisma.tenantMembership.create({
        data: {
          accountId: account.id,
          tenantId: tenant.id,
          role: "OWNER",
        },
      });

      await ensureWppSetup(tenant.id, tenant.name);

      res.json(await getAuthorizedTenantById(account.id, tenant.id));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao criar estabelecimento." });
    }
  });

  app.post("/api/owner/tenants/claim", requireAuth, async (req, res) => {
    const account = currentAccount(req)!;
    const { slug } = req.body;
    const normalizedSlug = sanitizeSlug(slug);

    if (!normalizedSlug) {
      return res
        .status(400)
        .json({ error: "Slug do estabelecimento é obrigatório." });
    }

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: normalizedSlug },
      });
      if (!tenant) {
        return res.status(404).json({ error: "Estabelecimento não encontrado." });
      }

      const existingMembership = await prisma.tenantMembership.findFirst({
        where: { tenantId: tenant.id },
      });

      if (existingMembership) {
        return res
          .status(400)
          .json({ error: "Este estabelecimento já possui um dono vinculado." });
      }

      await prisma.tenantMembership.create({
        data: {
          accountId: account.id,
          tenantId: tenant.id,
          role: "OWNER",
        },
      });

      await ensureWppSetup(tenant.id, tenant.name);

      res.json(await getAuthorizedTenantById(account.id, tenant.id));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao vincular estabelecimento." });
    }
  });

  app.patch("/api/owner/tenants/:tenantId", requireAuth, async (req, res) => {
    const tenant = await requireTenantById(req, res, req.params.tenantId);
    if (!tenant) return;

    const {
      name,
      description,
      address,
      whatsapp,
      logoUrl,
      isOpen,
      isDeliveryOpen,
      counterTicketMode,
      scheduleMode,
      scheduleType,
      scheduleDays,
      scheduleNotes,
      orderMode,
      businessHours,
      deliveryConfig,
      paymentMethods,
      stoneConfig,
      cieloConfig,
      fiscalConfig,
      displayPanelConfig,
      printingConfig,
      waiterNotifyOnReady,
      requireCashRegister,
      receiptPaperWidth,
    } = req.body;

    // Valida o certificado A1 ANTES de gravar, quando um novo certBase64 vier na config
    // fiscal — sem isso, senha errada/certificado vencido/CNPJ diferente só apareciam na
    // hora de emitir uma nota de verdade no PDV, tarde demais pro dono corrigir.
    if (fiscalConfig !== undefined && fiscalConfig !== null && fiscalConfig !== "null") {
      try {
        const parsedFiscal =
          typeof fiscalConfig === "string" ? JSON.parse(fiscalConfig) : fiscalConfig;
        if (parsedFiscal?.certBase64 && parsedFiscal?.certPassword) {
          const { parseCertificate } = await import("../../lib/fiscal.js");
          let certInfo;
          try {
            certInfo = parseCertificate(parsedFiscal.certBase64, parsedFiscal.certPassword);
          } catch (e: any) {
            return res.status(422).json({ error: e?.message || "Certificado inválido." });
          }

          if (certInfo.validTo.getTime() < Date.now()) {
            return res.status(422).json({
              error: `Certificado vencido em ${certInfo.validTo.toLocaleDateString("pt-BR")}. Envie um certificado A1 válido.`,
            });
          }

          const cnpjDigits = String(parsedFiscal.cnpj || "").replace(/\D/g, "");
          if (cnpjDigits.length === 14) {
            if (certInfo.titularCpf && !certInfo.titularCnpj) {
              return res.status(422).json({
                error:
                  "Este é um certificado e-CPF (pessoa física), mas o cadastro fiscal usa CNPJ. Envie um certificado e-CNPJ da empresa.",
              });
            }
            if (certInfo.titularCnpj && certInfo.titularCnpj !== cnpjDigits) {
              return res.status(422).json({
                error: "O CNPJ do certificado não corresponde ao CNPJ cadastrado na configuração fiscal.",
              });
            }
          }
        }
      } catch (err) {
        console.error("[Fiscal] Erro ao validar certificado:", err);
        return res.status(422).json({ error: "Não foi possível validar o certificado enviado." });
      }
    }

    try {
      const updated = await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          ...(name !== undefined && { name: String(name).trim() }),
          ...(description !== undefined && { description: description || null }),
          ...(address !== undefined && { address: address || null }),
          ...(whatsapp !== undefined && { whatsapp: whatsapp || null }),
          ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
          ...(isOpen !== undefined && { isOpen: Boolean(isOpen) }),
          ...(isDeliveryOpen !== undefined && {
            isDeliveryOpen: Boolean(isDeliveryOpen),
          }),
          ...(counterTicketMode !== undefined && {
            counterTicketMode: counterTicketMode === "NAME" ? "NAME" : "TICKET",
          }),
          ...(waiterNotifyOnReady !== undefined && {
            waiterNotifyOnReady: Boolean(waiterNotifyOnReady),
          }),
          ...(requireCashRegister !== undefined && {
            requireCashRegister: Boolean(requireCashRegister),
          }),
          ...(receiptPaperWidth !== undefined && {
            receiptPaperWidth: Number(receiptPaperWidth) === 58 ? 58 : 80,
          }),
          ...(scheduleMode !== undefined && {
            scheduleMode: Boolean(scheduleMode),
          }),
          ...(scheduleType !== undefined && {
            scheduleType: scheduleType || "CLIENT_CHOOSES",
          }),
          ...(scheduleDays !== undefined && {
            scheduleDays: scheduleDays
              ? typeof scheduleDays === "string"
                ? scheduleDays
                : JSON.stringify(scheduleDays)
              : null,
          }),
          ...(scheduleNotes !== undefined && {
            scheduleNotes: scheduleNotes || null,
          }),
          ...(orderMode !== undefined && {
            orderMode: orderMode || "DELIVERY_ONLY",
          }),
          ...(businessHours !== undefined && {
            businessHours:
              businessHours === null || businessHours === "null"
                ? null
                : typeof businessHours === "string"
                ? businessHours
                : JSON.stringify(businessHours),
          }),
          ...(deliveryConfig !== undefined && {
            deliveryConfig:
              deliveryConfig === null || deliveryConfig === "null"
                ? null
                : typeof deliveryConfig === "string"
                ? deliveryConfig
                : JSON.stringify(deliveryConfig),
          }),
          ...(paymentMethods !== undefined && {
            paymentMethods:
              paymentMethods === null || paymentMethods === "null"
                ? null
                : typeof paymentMethods === "string"
                ? paymentMethods
                : JSON.stringify(paymentMethods),
          }),
          ...(stoneConfig !== undefined && {
            stoneConfig:
              stoneConfig === null || stoneConfig === "null"
                ? null
                : typeof stoneConfig === "string"
                ? stoneConfig
                : JSON.stringify(stoneConfig),
          }),
          ...(cieloConfig !== undefined && {
            cieloConfig:
              cieloConfig === null || cieloConfig === "null"
                ? null
                : typeof cieloConfig === "string"
                ? cieloConfig
                : JSON.stringify(cieloConfig),
          }),
          ...(fiscalConfig !== undefined && {
            fiscalConfig:
              fiscalConfig === null || fiscalConfig === "null"
                ? null
                : typeof fiscalConfig === "string"
                ? fiscalConfig
                : JSON.stringify(fiscalConfig),
          }),
          ...(displayPanelConfig !== undefined && {
            displayPanelConfig:
              displayPanelConfig === null || displayPanelConfig === "null"
                ? null
                : typeof displayPanelConfig === "string"
                ? displayPanelConfig
                : JSON.stringify(displayPanelConfig),
          }),
          ...(printingConfig !== undefined && {
            printingConfig:
              printingConfig === null || printingConfig === "null"
                ? null
                : typeof printingConfig === "string"
                ? printingConfig
                : JSON.stringify(printingConfig),
          }),
        },
      });

      // Invalida cache do wizard se config fiscal mudou
      if (fiscalConfig !== undefined) {
        try {
          const { invalidateFiscalCache } = await import("../../lib/fiscal.js");
          invalidateFiscalCache(tenant.id);
        } catch {
          // nfewizard-io não instalado — ignora
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("TENANT UPDATE ERROR:", error);
      res.status(500).json({ error: "Falha ao atualizar estabelecimento." });
    }

    if (name) {
      try {
        await ensureWppSetup(req.params.tenantId, String(name).trim());
      } catch (wppError) {
        console.error("Erro ao configurar WhatsApp (não crítico):", wppError);
      }
    }
  });

  app.get("/api/owner/tenants/by-slug/:slug", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug);
    if (!tenant) return;
    res.json(tenant);
  });

  app.get("/api/owner/tenants/:tenantId", requireAuth, async (req, res) => {
    const tenant = await requireTenantById(req, res, req.params.tenantId);
    if (!tenant) return;
    res.json(tenant);
  });

  // ── STAFF / MEMBERSHIPS ──────────────────────────────────────────────────────

  // List all staff members for a tenant
  app.get("/api/owner/tenants/:tenantId/staff", requireAuth, async (req, res) => {
    const tenant = await requireTenantById(req, res, req.params.tenantId);
    if (!tenant) return;

    // OWNER e ADMIN podem gerenciar a equipe (proteção contra mexer no próprio OWNER
    // fica nas rotas de edição/remoção, não aqui — essa é só a listagem).
    const account = currentAccount(req)!;
    const myMembership = await prisma.tenantMembership.findFirst({
      where: { accountId: account.id, tenantId: tenant.id },
    });
    if (!myMembership || (myMembership.role !== "OWNER" && myMembership.role !== "ADMIN"))
      return res
        .status(403)
        .json({ error: "Apenas o proprietário ou administradores podem gerenciar a equipe." });

    const [members, pendingInvites] = await Promise.all([
      prisma.tenantMembership.findMany({
        where: { tenantId: tenant.id },
        include: { account: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.inviteToken.findMany({
        where: {
          tenantId: tenant.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    res.json({
      members: members.map((m: any) => ({
        id: m.id,
        role: m.role,
        name: m.name ?? null,
        permissions: m.permissions ? JSON.parse(m.permissions) : null,
        createdAt: m.createdAt,
        account: m.account,
      })),
      pendingInvites: pendingInvites.map((i: any) => ({
        id: i.id,
        email: i.targetEmail,
        role: i.role,
        name: i.memberName ?? null,
        permissions: i.permissions ? JSON.parse(i.permissions) : null,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
      })),
    });
  });

  // Cancela um convite de equipe pendente
  app.delete(
    "/api/owner/tenants/:tenantId/staff/invite/:inviteId",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(req, res, req.params.tenantId);
      if (!tenant) return;

      const account = currentAccount(req)!;
      const myMembership = await prisma.tenantMembership.findFirst({
        where: { accountId: account.id, tenantId: tenant.id },
      });
      if (!myMembership || (myMembership.role !== "OWNER" && myMembership.role !== "ADMIN"))
        return res
          .status(403)
          .json({ error: "Apenas o proprietário ou administradores podem cancelar convites." });

      const invite = await prisma.inviteToken.findFirst({
        where: { id: req.params.inviteId, tenantId: tenant.id },
      });
      if (!invite)
        return res.status(404).json({ error: "Convite não encontrado." });

      await prisma.inviteToken.delete({ where: { id: invite.id } });
      res.json({ ok: true });
    }
  );

  // Invite a new staff member by email
  app.post(
    "/api/owner/tenants/:tenantId/staff/invite",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(req, res, req.params.tenantId);
      if (!tenant) return;

      const account = currentAccount(req)!;
      const myMembership = await prisma.tenantMembership.findFirst({
        where: { accountId: account.id, tenantId: tenant.id },
      });
      if (!myMembership || (myMembership.role !== "OWNER" && myMembership.role !== "ADMIN"))
        return res
          .status(403)
          .json({ error: "Apenas o proprietário ou administradores podem convidar membros." });

      const { email, role, name, permissions } = req.body;
      if (!email || !role)
        return res.status(400).json({ error: "email e role são obrigatórios." });
      if (!["ADMIN", "STAFF"].includes(role))
        return res.status(400).json({ error: "role deve ser ADMIN ou STAFF." });

      const normalizedEmail = normalizeEmail(email);

      // Find the account by email
      const targetAccount = await prisma.account.findUnique({
        where: { email: normalizedEmail },
      });

      if (!targetAccount) {
        // Sem conta ainda: cria um convite por e-mail em vez de exigir cadastro prévio.
        // A membership só é criada quando o convidado aceita (ver /api/auth/register-invite).
        const existingInvite = await prisma.inviteToken.findFirst({
          where: {
            tenantId: tenant.id,
            targetEmail: normalizedEmail,
            usedAt: null,
          },
        });
        if (existingInvite && new Date(existingInvite.expiresAt) > new Date()) {
          return res
            .status(409)
            .json({ error: "Já existe um convite pendente para este e-mail." });
        }

        const token = [...Array(32)]
          .map(() => Math.random().toString(36)[2])
          .join("");
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
        const invite = await prisma.inviteToken.create({
          data: {
            token,
            createdById: account.id,
            expiresAt,
            tenantId: tenant.id,
            targetEmail: normalizedEmail,
            role,
            memberName: name || null,
            permissions: permissions ? JSON.stringify(permissions) : null,
          },
        });

        sendInviteEmail(normalizedEmail, token, null, tenant.name).catch(
          (err) => {
            console.error("[mailer] staff invite:", err);
          }
        );

        return res.status(202).json({
          pending: true,
          inviteId: invite.id,
          email: normalizedEmail,
          role,
          name: name || null,
          permissions: permissions ?? null,
          message:
            "Convite enviado por e-mail. O acesso será liberado assim que a pessoa criar a conta.",
        });
      }

      // Check if already a member
      const existing = await prisma.tenantMembership.findFirst({
        where: { accountId: targetAccount.id, tenantId: tenant.id },
      });
      if (existing)
        return res
          .status(409)
          .json({ error: "Este usuário já é membro deste estabelecimento." });

      const member = await prisma.tenantMembership.create({
        data: {
          accountId: targetAccount.id,
          tenantId: tenant.id,
          role,
          name: name || null,
          permissions: permissions ? JSON.stringify(permissions) : null,
        },
        include: { account: { select: { id: true, email: true, name: true } } },
      });

      res.json({
        id: (member as any).id,
        role: (member as any).role,
        name: (member as any).name ?? null,
        permissions: (member as any).permissions
          ? JSON.parse((member as any).permissions)
          : null,
        account: (member as any).account,
      });
    }
  );

  // Update staff member role/permissions/name
  app.patch(
    "/api/owner/tenants/:tenantId/staff/:membershipId",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(req, res, req.params.tenantId);
      if (!tenant) return;

      const account = currentAccount(req)!;
      const myMembership = await prisma.tenantMembership.findFirst({
        where: { accountId: account.id, tenantId: tenant.id },
      });
      if (!myMembership || (myMembership.role !== "OWNER" && myMembership.role !== "ADMIN"))
        return res
          .status(403)
          .json({ error: "Apenas o proprietário ou administradores podem editar permissões." });

      const target = await prisma.tenantMembership.findFirst({
        where: { id: req.params.membershipId, tenantId: tenant.id },
      });
      if (!target)
        return res.status(404).json({ error: "Membro não encontrado." });
      if ((target as any).role === "OWNER")
        return res
          .status(400)
          .json({ error: "Não é possível alterar o proprietário." });

      const { role, name, permissions } = req.body;

      const updated = await prisma.tenantMembership.update({
        where: { id: req.params.membershipId },
        data: {
          ...(role && ["ADMIN", "STAFF"].includes(role) && { role }),
          ...(name !== undefined && { name: name || null }),
          ...(permissions !== undefined && {
            permissions:
              permissions === null ? null : JSON.stringify(permissions),
          }),
        },
        include: { account: { select: { id: true, email: true, name: true } } },
      });

      res.json({
        id: (updated as any).id,
        role: (updated as any).role,
        name: (updated as any).name ?? null,
        permissions: (updated as any).permissions
          ? JSON.parse((updated as any).permissions)
          : null,
        account: (updated as any).account,
      });
    }
  );

  // Remove a staff member
  app.delete(
    "/api/owner/tenants/:tenantId/staff/:membershipId",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(req, res, req.params.tenantId);
      if (!tenant) return;

      const account = currentAccount(req)!;
      const myMembership = await prisma.tenantMembership.findFirst({
        where: { accountId: account.id, tenantId: tenant.id },
      });
      if (!myMembership || (myMembership.role !== "OWNER" && myMembership.role !== "ADMIN"))
        return res
          .status(403)
          .json({ error: "Apenas o proprietário ou administradores podem remover membros." });

      const target = await prisma.tenantMembership.findFirst({
        where: { id: req.params.membershipId, tenantId: tenant.id },
      });
      if (!target)
        return res.status(404).json({ error: "Membro não encontrado." });
      if ((target as any).role === "OWNER")
        return res
          .status(400)
          .json({ error: "Não é possível remover o proprietário." });

      await prisma.tenantMembership.delete({
        where: { id: req.params.membershipId },
      });
      res.json({ ok: true });
    }
  );

  // Get my own membership for a tenant (used by dashboard to load permissions)
  app.get(
    "/api/owner/tenants/:tenantId/my-membership",
    requireAuth,
    async (req, res) => {
      const account = currentAccount(req)!;
      const membership = await prisma.tenantMembership.findFirst({
        where: { accountId: account.id, tenantId: req.params.tenantId },
      });
      if (!membership) return res.status(404).json({ error: "Sem acesso." });

      res.json({
        id: (membership as any).id,
        role: (membership as any).role,
        name: (membership as any).name ?? null,
        permissions: (membership as any).permissions
          ? JSON.parse((membership as any).permissions)
          : null,
      });
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────

  app.get("/api/owner/tenants/:tenantId/wpp", requireAuth, async (req, res) => {
    const tenant = await requireTenantById(
      req,
      res,
      req.params.tenantId,
      "whatsapp"
    );
    if (!tenant) return;

    await ensureWppSetup(tenant.id, tenant.name);
    const info = getSessionInfo(tenant.id);
    const config = await prisma.wppBotConfig.findUnique({
      where: { tenantId: tenant.id },
    });
    const instance = await prisma.wppInstance.findUnique({
      where: { tenantId: tenant.id },
    });

    res.json({
      instance,
      config,
      session: info,
    });
  });

  app.post(
    "/api/owner/tenants/:tenantId/wpp/connect",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "whatsapp"
      );
      if (!tenant) return;

      await ensureWppSetup(tenant.id, tenant.name);
      const info = await connectSession(tenant.id);
      res.json({
        status: info.status,
        phone: info.phone,
        qrCode: info.qrDataUrl,
      });
    }
  );

  app.get(
    "/api/owner/tenants/:tenantId/wpp/status",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "whatsapp"
      );
      if (!tenant) return;

      const info = getSessionInfo(tenant.id);
      res.json({
        status: info.status,
        phone: info.phone,
        qrCode: info.qrDataUrl,
      });
    }
  );

  app.get(
    "/api/owner/tenants/:tenantId/wpp/qr",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "whatsapp"
      );
      if (!tenant) return;

      res.json({
        status: getSessionInfo(tenant.id).status,
        qrCode: getQrCode(tenant.id),
      });
    }
  );

  app.post(
    "/api/owner/tenants/:tenantId/wpp/disconnect",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "whatsapp"
      );
      if (!tenant) return;

      await disconnectSession(tenant.id);
      res.json({ success: true });
    }
  );

  app.patch(
    "/api/owner/tenants/:tenantId/wpp/config",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "whatsapp"
      );
      if (!tenant) return;

      const {
        botEnabled,
        autoReplyEnabled,
        sendOrderCreated,
        sendStatusUpdates,
        sendLoyaltyPoints,
        sendReceiptPdf,
        sendLowStockAlert,
        ownerAlertPhone,
        welcomeMessage,
        instanceName,
        isPaused,
        startTime,
        endTime,
        preorderMessage,
      } = req.body;

      const [config, instance] = await Promise.all([
        prisma.wppBotConfig.upsert({
          where: { tenantId: tenant.id },
          create: {
            tenantId: tenant.id,
            botEnabled: !!botEnabled,
            autoReplyEnabled: autoReplyEnabled !== false,
            sendOrderCreated: sendOrderCreated !== false,
            sendStatusUpdates: sendStatusUpdates !== false,
            sendLoyaltyPoints: sendLoyaltyPoints !== false,
            sendReceiptPdf: sendReceiptPdf !== false,
            sendLowStockAlert: !!sendLowStockAlert,
            ownerAlertPhone: ownerAlertPhone || null,
            welcomeMessage: welcomeMessage || null,
            isPaused: !!isPaused,
            startTime: startTime || null,
            endTime: endTime || null,
            preorderMessage: preorderMessage || null,
          },
          update: {
            ...(botEnabled !== undefined && { botEnabled: !!botEnabled }),
            ...(autoReplyEnabled !== undefined && {
              autoReplyEnabled: !!autoReplyEnabled,
            }),
            ...(sendOrderCreated !== undefined && {
              sendOrderCreated: !!sendOrderCreated,
            }),
            ...(sendStatusUpdates !== undefined && {
              sendStatusUpdates: !!sendStatusUpdates,
            }),
            ...(sendLoyaltyPoints !== undefined && {
              sendLoyaltyPoints: !!sendLoyaltyPoints,
            }),
            ...(sendReceiptPdf !== undefined && {
              sendReceiptPdf: !!sendReceiptPdf,
            }),
            ...(sendLowStockAlert !== undefined && {
              sendLowStockAlert: !!sendLowStockAlert,
            }),
            ...(ownerAlertPhone !== undefined && {
              ownerAlertPhone: ownerAlertPhone || null,
            }),
            ...(welcomeMessage !== undefined && {
              welcomeMessage: welcomeMessage || null,
            }),
            ...(isPaused !== undefined && { isPaused: !!isPaused }),
            ...(startTime !== undefined && { startTime: startTime || null }),
            ...(endTime !== undefined && { endTime: endTime || null }),
            ...(preorderMessage !== undefined && {
              preorderMessage: preorderMessage || null,
            }),
          },
        }),
        prisma.wppInstance.upsert({
          where: { tenantId: tenant.id },
          create: {
            tenantId: tenant.id,
            instanceName: String(instanceName || `${tenant.name} Bot`).trim(),
            status: "not_configured",
          },
          update: {
            ...(instanceName !== undefined && {
              instanceName: String(instanceName || `${tenant.name} Bot`).trim(),
            }),
          },
        }),
      ]);

      res.json({ config, instance, session: getSessionInfo(tenant.id) });
    }
  );

  app.post(
    "/api/owner/tenants/:tenantId/wpp/test",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "whatsapp"
      );
      if (!tenant) return;

      const { phone, message } = req.body;
      if (!phone || !message) {
        return res
          .status(400)
          .json({ error: "Telefone e mensagem são obrigatórios." });
      }

      const info = getSessionInfo(tenant.id);
      if (info.status !== "connected") {
        return res.status(400).json({ error: "WhatsApp não está conectado." });
      }

      await sendMessage(
        tenant.id,
        String(phone),
        String(message),
        0,
        "MANUAL_TEST"
      );
      res.json({ success: true });
    }
  );

  app.get(
    "/api/owner/tenants/:tenantId/wpp/logs",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "whatsapp"
      );
      if (!tenant) return;

      const limit = Math.min(
        parseInt(String(req.query.limit || "50"), 10) || 50,
        200
      );
      const logs = await prisma.wppMessageLog.findMany({
        where: { tenantId: tenant.id },
        orderBy: { sentAt: "desc" },
        take: limit,
      });
      res.json(logs);
    }
  );

  app.post("/api/upload", requireAuth, upload.single("file"), (req, res) => {
    if (!req.file)
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    res.json({ url: `/uploads/${req.file.filename}` });
  });
}
