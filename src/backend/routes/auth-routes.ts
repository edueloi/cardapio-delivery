import type { Express, RequestHandler } from "express";
import {
  createAuthSession,
  deleteAuthSession,
  hashPassword,
  listAccountTenants,
  verifyPassword,
} from "../auth";
import { sendPasswordResetEmail } from "../mailer";
import {
  normalizeEmail,
  normalizeUsername,
  sanitizeSlug,
  serializeAccount,
} from "../shared/utils";

export interface RegisterAuthRoutesOptions {
  app: Express;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any;
  requireAuth: RequestHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentAccount: (req: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentSessionToken: (req: any) => string | null;
  ensureWppSetup: (tenantId: string, tenantName: string) => Promise<unknown>;
}

export function registerAuthRoutes({
  app,
  prisma,
  requireAuth,
  currentAccount,
  currentSessionToken,
  ensureWppSetup,
}: RegisterAuthRoutesOptions) {
  app.post("/api/auth/register", async (req, res) => {
    const {
      name,
      email,
      password,
      establishmentName,
      establishmentSlug,
      description,
      address,
      whatsapp,
      claimSlug,
    } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Nome, e-mail e senha são obrigatórios." });
    }

    try {
      const normalizedEmail = normalizeEmail(email);
      const existingAccount = await prisma.account.findUnique({
        where: { email: normalizedEmail },
      });
      if (existingAccount) {
        return res.status(400).json({ error: "E-mail já cadastrado." });
      }

      const ownerName = String(name).trim();
      const passwordHash = hashPassword(String(password));
      let claimTenant = null;
      let createTenantData: {
        name: string;
        slug: string;
        description: string | null;
        address: string | null;
        whatsapp: string | null;
      } | null = null;

      if (claimSlug) {
        const slug = sanitizeSlug(claimSlug);
        claimTenant = await prisma.tenant.findUnique({ where: { slug } });

        if (!claimTenant) {
          return res
            .status(404)
            .json({ error: "Estabelecimento não encontrado para vincular." });
        }

        const existingMembership = await prisma.tenantMembership.findFirst({
          where: { tenantId: claimTenant.id },
        });

        if (existingMembership) {
          return res
            .status(400)
            .json({ error: "Este estabelecimento já possui um dono vinculado." });
        }
      } else {
        if (!establishmentName) {
          return res
            .status(400)
            .json({ error: "Informe o nome do estabelecimento." });
        }

        const slug = sanitizeSlug(establishmentSlug || establishmentName);
        if (!slug) {
          return res
            .status(400)
            .json({ error: "Slug inválido para o estabelecimento." });
        }

        const existingTenant = await prisma.tenant.findUnique({
          where: { slug },
        });
        if (existingTenant) {
          return res
            .status(400)
            .json({ error: "Esse link do estabelecimento já está em uso." });
        }

        createTenantData = {
          name: String(establishmentName).trim(),
          slug,
          description: description || null,
          address: address || null,
          whatsapp: whatsapp || null,
        };
      }

      const { account, tenant } = await prisma.$transaction(async (tx) => {
        const account = await tx.account.create({
          data: {
            name: ownerName,
            email: normalizedEmail,
            passwordHash,
          },
        });

        const tenant =
          claimTenant ||
          (await tx.tenant.create({
            data: createTenantData!,
          }));

        await tx.tenantMembership.create({
          data: {
            accountId: account.id,
            tenantId: tenant.id,
            role: "OWNER",
          },
        });

        return { account, tenant };
      });

      try {
        await ensureWppSetup(tenant.id, tenant.name);
      } catch (wppError) {
        console.error(
          "Erro ao configurar WhatsApp inicial (não crítico):",
          wppError
        );
      }

      const token = await createAuthSession(account.id);
      const tenants = await listAccountTenants(account.id);

      res.json({
        token,
        account: serializeAccount(account),
        tenants,
      });
    } catch (error) {
      console.error("ERRO NO CADASTRO:", error);
      res.status(500).json({
        error: "Falha ao cadastrar usuário.",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const identifier = String(req.body?.identifier ?? req.body?.email ?? "").trim();
    const password = req.body?.password;
    if (!identifier || !password) {
      return res
        .status(400)
        .json({ error: "Usuário, e-mail e senha são obrigatórios." });
      return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }

    try {
      let account = null;

      if (identifier.includes("@")) {
        account = await prisma.account.findUnique({
          where: { email: normalizeEmail(identifier) },
        });
      }

      if (!account) {
        const username = normalizeUsername(identifier);
        if (username) {
          account = await prisma.account.findUnique({
            where: { username },
          });
        }
      }

      if (!account || !verifyPassword(String(password), account.passwordHash)) {
        return res
          .status(401)
          .json({ error: "Usuário, e-mail ou senha inválidos." });
        return res.status(401).json({ error: "E-mail ou senha inválidos." });
      }

      const token = await createAuthSession(account.id);
      const tenants = await listAccountTenants(account.id);

      res.json({
        token,
        account: serializeAccount(account),
        tenants,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao fazer login." });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const authAccount = currentAccount(req)!;
    const account = await prisma.account.findUnique({
      where: { id: authAccount.id },
    });
    if (!account) {
      return res.status(404).json({ error: "Conta não encontrada." });
    }
    const tenants = await listAccountTenants(account.id);
    res.json({ account: serializeAccount(account), tenants });
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    const token = currentSessionToken(req);
    if (token) {
      await deleteAuthSession(token);
    }

    res.json({ success: true });
  });

  app.get("/api/auth/profile", requireAuth, async (req, res) => {
    const authAccount = currentAccount(req)!;
    const account = await prisma.account.findUnique({
      where: { id: authAccount.id },
    });

    if (!account) {
      return res.status(404).json({ error: "Conta não encontrada." });
    }

    res.json({ account: serializeAccount(account) });
  });

  app.get("/api/auth/check-username/:username", requireAuth, async (req, res) => {
    const authAccount = currentAccount(req)!;
    const username = normalizeUsername(req.params.username || "");

    if (!username) {
      return res.status(400).json({ error: "Informe um usuário válido." });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: "O usuário deve ter ao menos 3 caracteres." });
    }

    const existing = await prisma.account.findUnique({
      where: { username },
    });

    res.json({
      normalized: username,
      available: !existing || existing.id === authAccount.id,
    });
  });

  app.patch("/api/auth/profile", requireAuth, async (req, res) => {
    const authAccount = currentAccount(req)!;
    const current = await prisma.account.findUnique({
      where: { id: authAccount.id },
    });

    if (!current) {
      return res.status(404).json({ error: "Conta não encontrada." });
    }

    const name = String(req.body?.name || "").trim();
    const usernameInput = String(req.body?.username || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const address = String(req.body?.address || "").trim();
    const avatarUrl = String(req.body?.avatarUrl || "").trim();
    const birthDateInput = String(req.body?.birthDate || "").trim();

    if (!name) {
      return res.status(400).json({ error: "Informe seu nome." });
    }

    const data: Record<string, unknown> = {
      name,
      phone: phone || null,
      address: address || null,
      avatarUrl: avatarUrl || null,
      birthDate: null,
    };

    if (birthDateInput) {
      const birthDate = new Date(`${birthDateInput}T00:00:00`);
      if (Number.isNaN(birthDate.getTime())) {
        return res.status(400).json({ error: "Data de nascimento inválida." });
      }
      data.birthDate = birthDate;
    }

    if (current.username) {
      const normalizedCurrent = normalizeUsername(current.username);
      const normalizedIncoming = normalizeUsername(usernameInput || current.username);
      if (normalizedIncoming && normalizedIncoming !== normalizedCurrent) {
        return res.status(400).json({ error: "O usuário de login não pode ser alterado depois de salvo." });
      }
    } else if (usernameInput) {
      const normalizedUsername = normalizeUsername(usernameInput);
      if (normalizedUsername.length < 3) {
        return res.status(400).json({ error: "O usuário deve ter ao menos 3 caracteres." });
      }

      const existing = await prisma.account.findUnique({
        where: { username: normalizedUsername },
      });

      if (existing && existing.id !== current.id) {
        return res.status(400).json({ error: "Este usuário já está em uso." });
      }

      data.username = normalizedUsername;
    }

    const updated = await prisma.account.update({
      where: { id: current.id },
      data,
    });

    res.json({
      account: serializeAccount(updated),
      usernameLocked: !!updated.username,
    });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    const authAccount = currentAccount(req)!;
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    const confirmPassword = String(req.body?.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: "Preencha a senha atual, a nova senha e a confirmação." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "A nova senha deve ter ao menos 6 caracteres." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "A confirmação da nova senha não confere." });
    }

    const account = await prisma.account.findUnique({
      where: { id: authAccount.id },
    });

    if (!account) {
      return res.status(404).json({ error: "Conta não encontrada." });
    }

    if (!verifyPassword(currentPassword, account.passwordHash)) {
      return res.status(400).json({ error: "A senha atual está incorreta." });
    }

    await prisma.account.update({
      where: { id: account.id },
      data: {
        passwordHash: hashPassword(newPassword),
      },
    });

    res.json({ success: true });
  });

  // ── INVITE / REGISTER VIA LINK ──────────────────────────────────────────────

  // Valida token de convite (público — usado na tela de cadastro)
  app.get("/api/auth/invite/:token", async (req, res) => {
    try {
      const invite = await prisma.inviteToken.findUnique({
        where: { token: req.params.token },
        include: { tenant: { select: { name: true } } },
      });
      if (!invite)
        return res.status(404).json({ error: "Convite não encontrado." });
      if (invite.usedAt)
        return res.status(410).json({ error: "Este convite já foi utilizado." });
      if (new Date() > new Date(invite.expiresAt))
        return res.status(410).json({ error: "Este convite expirou." });
      res.json({
        valid: true,
        note: invite.note,
        isTeamInvite: !!(invite as any).tenantId,
        tenantName: (invite as any).tenant?.name ?? null,
        targetEmail: (invite as any).targetEmail ?? null,
      });
    } catch (error) {
      res.status(500).json({ error: "Falha ao validar convite." });
    }
  });

  // Cadastro via convite (único uso, com validade)
  app.post("/api/auth/register-invite", async (req, res) => {
    const { token, name, email, password, establishmentName, establishmentSlug } =
      req.body;
    if (!token || !name || !email || !password) {
      return res.status(400).json({ error: "Dados incompletos." });
    }
    try {
      const invite = await prisma.inviteToken.findUnique({ where: { token } });
      if (!invite)
        return res.status(404).json({ error: "Convite não encontrado." });
      if (invite.usedAt)
        return res.status(410).json({ error: "Este convite já foi utilizado." });
      if (new Date() > new Date(invite.expiresAt))
        return res.status(410).json({ error: "Este convite expirou." });

      const normalizedEmail = normalizeEmail(email);
      const existing = await prisma.account.findUnique({
        where: { email: normalizedEmail },
      });
      if (existing)
        return res.status(400).json({ error: "E-mail já cadastrado." });

      const isTeamInvite = !!(invite as any).tenantId;
      if (
        isTeamInvite &&
        (invite as any).targetEmail &&
        (invite as any).targetEmail !== normalizedEmail
      ) {
        return res
          .status(400)
          .json({ error: "Este convite foi enviado para outro e-mail." });
      }

      let tenantData: { name: string; slug: string } | null = null;
      if (!isTeamInvite && establishmentName) {
        const slug = sanitizeSlug(establishmentSlug || establishmentName);
        if (!slug) return res.status(400).json({ error: "Slug inválido." });
        const existingTenant = await prisma.tenant.findUnique({
          where: { slug },
        });
        if (existingTenant)
          return res.status(400).json({ error: "Esse link já está em uso." });
        tenantData = { name: String(establishmentName).trim(), slug };
      }

      const { account, tenant } = await prisma.$transaction(async (tx: any) => {
        const account = await tx.account.create({
          data: {
            name: String(name).trim(),
            email: normalizedEmail,
            passwordHash: hashPassword(String(password)),
          },
        });
        let tenant = null;
        if (isTeamInvite) {
          await tx.tenantMembership.create({
            data: {
              accountId: account.id,
              tenantId: (invite as any).tenantId,
              role: (invite as any).role || "STAFF",
              name: (invite as any).memberName || null,
              permissions: (invite as any).permissions ?? null,
            },
          });
        } else if (tenantData) {
          tenant = await tx.tenant.create({ data: tenantData });
          await tx.tenantMembership.create({
            data: { accountId: account.id, tenantId: tenant.id, role: "OWNER" },
          });
        }
        await tx.inviteToken.update({
          where: { token },
          data: { usedAt: new Date(), usedByEmail: normalizedEmail },
        });
        return { account, tenant };
      });

      if (tenant) {
        try {
          await ensureWppSetup(tenant.id, tenant.name);
        } catch {}
      }

      const authToken = await createAuthSession(account.id);
      const tenants = await listAccountTenants(account.id);
      res.json({
        token: authToken,
        account: serializeAccount(account),
        tenants,
      });
    } catch (error) {
      console.error("ERRO register-invite:", error);
      res.status(500).json({ error: "Falha ao criar conta." });
    }
  });

  // ── REDEFINIÇÃO DE SENHA ──────────────────────────────────────────────────────

  // Solicitar redefinição — gera token e envia email
  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "E-mail obrigatório." });
    try {
      const account = await prisma.account.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      // Responde sempre 200 para não revelar se email existe
      if (!account) return res.json({ ok: true });

      const token = [...Array(48)]
        .map(() => Math.random().toString(36)[2])
        .join("");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
      await prisma.passwordResetToken.create({
        data: { accountId: account.id, token, expiresAt },
      });
      await sendPasswordResetEmail(account.email, token, account.name).catch(
        (err) => {
          console.error("[mailer] forgot-password:", err);
        }
      );
      res.json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao processar solicitação." });
    }
  });

  // Validar token de reset
  app.get("/api/auth/reset-password/:token", async (req, res) => {
    try {
      const record = await prisma.passwordResetToken.findUnique({
        where: { token: req.params.token },
      });
      if (!record) return res.status(404).json({ error: "Token inválido." });
      if (record.usedAt)
        return res.status(410).json({ error: "Este link já foi utilizado." });
      if (new Date() > new Date(record.expiresAt))
        return res.status(410).json({ error: "Este link expirou." });
      res.json({ valid: true });
    } catch (error) {
      res.status(500).json({ error: "Falha ao validar token." });
    }
  });

  // Redefinir senha
  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password)
      return res.status(400).json({ error: "Dados incompletos." });
    if (String(password).length < 6)
      return res
        .status(400)
        .json({ error: "A senha deve ter ao menos 6 caracteres." });
    try {
      const record = await prisma.passwordResetToken.findUnique({
        where: { token },
      });
      if (!record) return res.status(404).json({ error: "Token inválido." });
      if (record.usedAt)
        return res.status(410).json({ error: "Este link já foi utilizado." });
      if (new Date() > new Date(record.expiresAt))
        return res.status(410).json({ error: "Este link expirou." });

      await prisma.account.update({
        where: { id: record.accountId },
        data: { passwordHash: hashPassword(String(password)) },
      });
      await prisma.passwordResetToken.update({
        where: { token },
        data: { usedAt: new Date() },
      });
      res.json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao redefinir senha." });
    }
  });
}
