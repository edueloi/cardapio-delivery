import { randomBytes } from "crypto";
import express from "express";
import type { Express, Request, RequestHandler, Response } from "express";
import type { Server } from "socket.io";
import { hashPassword, verifyPassword } from "../auth";
import { hydrateOrderItemNames } from "../shared/order-helpers";

export interface RegisterKitchenRoutesOptions {
  app: Express;
  io: Server;
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
  updateOrderStatus: (
    orderId: string,
    previousStatus: string,
    status: string,
    kitchenReady?: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any>;
}

export function registerKitchenRoutes({
  app,
  io,
  prisma,
  requireAuth,
  requireTenantById,
  updateOrderStatus,
}: RegisterKitchenRoutesOptions) {
  // ── Painel de Cozinha (login próprio, sem conta de usuário) ──────────────────
  // Pensado para um tablet/TV fixo na cozinha: o dono define uma senha em
  // Configurações, e quem abrir /cozinha/:slug digita essa senha uma vez —
  // sem precisar de conta de staff. A sessão dura 1 ano (fica "sempre conectado").
  const KITCHEN_SESSION_TTL_DAYS = 365;

  // Resolve a sessão só pelo token, sem exigir slug — usado tanto pelas rotas
  // /api/kitchen/:slug/* (que ainda conferem o slug bate) quanto pelas rotas
  // /api/kitchen/global/* (cozinha.boxsys.com.br, sem slug na URL).
  async function requireKitchenAuthByToken(
    req: express.Request,
    res: express.Response
  ) {
    const token = (req.headers["x-kitchen-token"] as string) || "";
    if (!token) {
      res.status(401).json({ error: "Sessão da cozinha expirada." });
      return null;
    }

    const session = await prisma.kitchenSession.findUnique({
      where: { token },
      include: { tenant: true, kitchenStaff: true },
    });
    if (!session) {
      res.status(401).json({ error: "Sessão da cozinha expirada." });
      return null;
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      await prisma.kitchenSession
        .delete({ where: { id: session.id } })
        .catch(() => {});
      res.status(401).json({ error: "Sessão da cozinha expirada." });
      return null;
    }

    return {
      tenant: session.tenant,
      staffName: session.kitchenStaff?.name ?? null,
    };
  }

  async function requireKitchenAuth(
    req: express.Request,
    res: express.Response,
    slug: string
  ) {
    const auth = await requireKitchenAuthByToken(req, res);
    if (!auth) return null;
    if (auth.tenant.slug !== slug) {
      res.status(401).json({ error: "Sessão da cozinha expirada." });
      return null;
    }
    return auth;
  }

  // ── Rotas globais (sem slug na URL) — usadas em cozinha.boxsys.com.br ────────
  // IMPORTANTE: precisam vir ANTES das rotas /api/kitchen/:slug/* abaixo, senão o
  // Express casa "global" como se fosse um :slug (mesmo número de segmentos de URL)
  // e essas rotas nunca são alcançadas.

  // Login por username, único no sistema inteiro — resolve a loja automaticamente
  // a partir do funcionário logado. Quem ainda não tem usuário cadastrado precisa
  // passar por /api/kitchen/global/request-access.
  app.post("/api/kitchen/global/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(401).json({ error: "Usuário ou senha incorretos." });

    const staff = await prisma.kitchenStaff.findFirst({
      where: { username: String(username).trim(), active: true },
      include: { tenant: true },
    });
    if (!staff || !verifyPassword(String(password), staff.passwordHash)) {
      return res.status(401).json({ error: "Usuário ou senha incorretos." });
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + KITCHEN_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
    );
    await prisma.kitchenSession.create({
      data: {
        tenantId: staff.tenantId,
        kitchenStaffId: staff.id,
        token,
        expiresAt,
      },
    });

    res.json({ token, staffName: staff.name, storeSlug: staff.tenant.slug });
  });

  // Pedido de acesso feito pelo próprio funcionário, sem estar logado — fica pendente
  // até o dono da loja (encontrada por nome/slug digitado) aprovar ou rejeitar.
  app.post("/api/kitchen/global/request-access", async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const username = String(req.body?.username || "").trim();
    const storeQuery = String(req.body?.storeQuery || "").trim();
    const contact = req.body?.contact ? String(req.body.contact).trim() : null;

    if (!name || !username || !storeQuery) {
      return res
        .status(400)
        .json({ error: "Preencha nome, usuário e o nome da loja." });
    }

    const existingUsername = await prisma.kitchenStaff.findUnique({
      where: { username },
    });
    if (existingUsername) {
      return res
        .status(409)
        .json({ error: "Esse usuário já está em uso. Escolha outro." });
    }

    const normalizedQuery = storeQuery.toLowerCase().replace(/\s+/g, "-");
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ slug: normalizedQuery }, { name: { contains: storeQuery } }],
      },
    });

    const request = await prisma.kitchenAccessRequest.create({
      data: { name, username, storeQuery, contact, tenantId: tenant?.id ?? null },
    });

    res.json({ id: request.id, matchedStore: tenant?.name ?? null });
  });

  app.post("/api/kitchen/global/logout", async (req, res) => {
    const token = (req.headers["x-kitchen-token"] as string) || "";
    if (token)
      await prisma.kitchenSession
        .deleteMany({ where: { token } })
        .catch(() => {});
    res.json({ ok: true });
  });

  app.get("/api/kitchen/global/data", async (req, res) => {
    const auth = await requireKitchenAuthByToken(req, res);
    if (!auth) return;
    const { tenant, staffName } = auth;

    try {
      const orders = await prisma.order.findMany({
        where: { tenantId: tenant.id },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      hydrateOrderItemNames(orders);
      res.json({ tenant, orders, staffName });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao buscar dados da cozinha." });
    }
  });

  app.patch("/api/kitchen/global/orders/:id/status", async (req, res) => {
    const auth = await requireKitchenAuthByToken(req, res);
    if (!auth) return;
    const { tenant } = auth;

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
    });
    if (!order) return res.status(404).json({ error: "Pedido não encontrado." });

    try {
      const updatedOrder = await updateOrderStatus(
        order.id,
        order.status,
        req.body.status,
        req.body.kitchenReady
      );
      res.json(updatedOrder);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  // ── Rotas por slug (/cozinha/:slug) ──────────────────────────────────────────

  // Login por funcionário cadastrado (nome + senha própria) — identifica quem está no tablet.
  app.post("/api/kitchen/:slug/login", async (req, res) => {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug },
    });
    if (!tenant) return res.status(404).json({ error: "Loja não encontrada." });

    const { name, password } = req.body;

    if (name) {
      const staff = await prisma.kitchenStaff.findFirst({
        where: { tenantId: tenant.id, username: String(name), active: true },
      });
      if (
        !staff ||
        !password ||
        !verifyPassword(String(password), staff.passwordHash)
      ) {
        return res.status(401).json({ error: "Nome ou senha incorretos." });
      }
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(
        Date.now() + KITCHEN_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
      );
      await prisma.kitchenSession.create({
        data: { tenantId: tenant.id, kitchenStaffId: staff.id, token, expiresAt },
      });
      return res.json({ token, staffName: staff.name });
    }

    // Compatibilidade: senha única da loja, sem identificar quem está logado.
    if (!tenant.kitchenPasswordHash) {
      return res
        .status(400)
        .json({
          error: "Senha da cozinha ainda não foi configurada pelo dono da loja.",
        });
    }
    if (
      !password ||
      !verifyPassword(String(password), tenant.kitchenPasswordHash)
    ) {
      return res.status(401).json({ error: "Senha incorreta." });
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + KITCHEN_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
    );
    await prisma.kitchenSession.create({
      data: { tenantId: tenant.id, token, expiresAt },
    });

    res.json({ token, staffName: null });
  });

  app.post("/api/kitchen/:slug/logout", async (req, res) => {
    const token = (req.headers["x-kitchen-token"] as string) || "";
    if (token)
      await prisma.kitchenSession
        .deleteMany({ where: { token } })
        .catch(() => {});
    res.json({ ok: true });
  });

  app.get("/api/kitchen/:slug/data", async (req, res) => {
    const auth = await requireKitchenAuth(req, res, req.params.slug);
    if (!auth) return;
    const { tenant, staffName } = auth;

    try {
      const orders = await prisma.order.findMany({
        where: { tenantId: tenant.id },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      hydrateOrderItemNames(orders);
      res.json({ tenant, orders, staffName });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao buscar dados da cozinha." });
    }
  });

  app.patch("/api/kitchen/:slug/orders/:id/status", async (req, res) => {
    const auth = await requireKitchenAuth(req, res, req.params.slug);
    if (!auth) return;
    const { tenant } = auth;

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
    });
    if (!order) return res.status(404).json({ error: "Pedido não encontrado." });

    try {
      const updatedOrder = await updateOrderStatus(
        order.id,
        order.status,
        req.body.status,
        req.body.kitchenReady
      );
      res.json(updatedOrder);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  // Configuração da senha do painel de cozinha (feita pelo dono, autenticado normalmente)
  app.post(
    "/api/admin/:tenantId/kitchen/config",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "kds"
      );
      if (!tenant) return;

      try {
        const { password } = req.body;
        if (password !== undefined && password !== null && password !== "") {
          if (String(password).length < 4) {
            return res
              .status(400)
              .json({ error: "A senha deve ter pelo menos 4 caracteres." });
          }
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: { kitchenPasswordHash: hashPassword(String(password)) },
          });
        } else if (password === null || password === "") {
          // Remove a senha — desativa o painel de cozinha até configurar de novo
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: { kitchenPasswordHash: null },
          });
          await prisma.kitchenSession.deleteMany({
            where: { tenantId: tenant.id },
          });
        }
        res.json({ hasPassword: password !== null && password !== "" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Falha ao salvar senha da cozinha." });
      }
    }
  );

  app.get(
    "/api/admin/:tenantId/kitchen/config",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "kds"
      );
      if (!tenant) return;
      res.json({ hasPassword: !!tenant.kitchenPasswordHash });
    }
  );

  // ── Equipe da cozinha (login individual: nome + senha própria por funcionário) ──
  app.get("/api/admin/:tenantId/kitchen/staff", requireAuth, async (req, res) => {
    const tenant = await requireTenantById(req, res, req.params.tenantId, "kds");
    if (!tenant) return;

    const staff = await prisma.kitchenStaff.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        name: true,
        username: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(staff);
  });

  // ── Solicitações de acesso feitas em cozinha.boxsys.com.br, pendentes de aprovação ──
  app.get(
    "/api/admin/:tenantId/kitchen/access-requests",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "kds"
      );
      if (!tenant) return;

      const requests = await prisma.kitchenAccessRequest.findMany({
        where: { tenantId: tenant.id, status: "PENDING" },
        orderBy: { createdAt: "asc" },
      });
      res.json(requests);
    }
  );

  app.post(
    "/api/admin/:tenantId/kitchen/access-requests/:id/approve",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "kds"
      );
      if (!tenant) return;

      const password = String(req.body?.password || "");
      if (password.length < 4)
        return res
          .status(400)
          .json({ error: "A senha deve ter pelo menos 4 caracteres." });

      const request = await prisma.kitchenAccessRequest.findFirst({
        where: { id: req.params.id, tenantId: tenant.id, status: "PENDING" },
      });
      if (!request)
        return res.status(404).json({ error: "Solicitação não encontrada." });

      try {
        const staff = await prisma.kitchenStaff.create({
          data: {
            tenantId: tenant.id,
            name: request.name,
            username: request.username,
            passwordHash: hashPassword(password),
          },
          select: {
            id: true,
            name: true,
            username: true,
            active: true,
            createdAt: true,
          },
        });
        await prisma.kitchenAccessRequest.update({
          where: { id: request.id },
          data: { status: "APPROVED", resolvedAt: new Date() },
        });
        res.json(staff);
      } catch (error: any) {
        if (error.code === "P2002")
          return res
            .status(409)
            .json({ error: "Esse usuário já está em uso por outra pessoa." });
        console.error(error);
        res.status(500).json({ error: "Falha ao aprovar solicitação." });
      }
    }
  );

  app.post(
    "/api/admin/:tenantId/kitchen/access-requests/:id/reject",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "kds"
      );
      if (!tenant) return;

      const request = await prisma.kitchenAccessRequest.findFirst({
        where: { id: req.params.id, tenantId: tenant.id, status: "PENDING" },
      });
      if (!request)
        return res.status(404).json({ error: "Solicitação não encontrada." });

      await prisma.kitchenAccessRequest.update({
        where: { id: request.id },
        data: { status: "REJECTED", resolvedAt: new Date() },
      });
      res.json({ success: true });
    }
  );

  app.post(
    "/api/admin/:tenantId/kitchen/staff",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "kds"
      );
      if (!tenant) return;

      const name = String(req.body?.name || "").trim();
      const username = String(req.body?.username || "").trim();
      const password = String(req.body?.password || "");
      if (!name)
        return res.status(400).json({ error: "Informe o nome do funcionário." });
      if (!username)
        return res
          .status(400)
          .json({
            error:
              "Informe um usuário para o funcionário logar em cozinha.boxsys.com.br.",
          });
      if (password.length < 4)
        return res
          .status(400)
          .json({ error: "A senha deve ter pelo menos 4 caracteres." });

      try {
        const staff = await prisma.kitchenStaff.create({
          data: {
            tenantId: tenant.id,
            name,
            username,
            passwordHash: hashPassword(password),
          },
          select: {
            id: true,
            name: true,
            username: true,
            active: true,
            createdAt: true,
          },
        });
        res.json(staff);
      } catch (error: any) {
        if (error.code === "P2002") {
          const target = Array.isArray(error.meta?.target)
            ? error.meta.target.join(",")
            : "";
          if (target.includes("username"))
            return res
              .status(409)
              .json({ error: "Esse usuário já está em uso por outra pessoa." });
          return res
            .status(409)
            .json({ error: "Já existe um funcionário com esse nome." });
        }
        console.error(error);
        res.status(500).json({ error: "Falha ao cadastrar funcionário." });
      }
    }
  );

  app.patch(
    "/api/admin/:tenantId/kitchen/staff/:id",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "kds"
      );
      if (!tenant) return;

      const existing = await prisma.kitchenStaff.findFirst({
        where: { id: req.params.id, tenantId: tenant.id },
      });
      if (!existing)
        return res.status(404).json({ error: "Funcionário não encontrado." });

      const data: { name?: string; passwordHash?: string; active?: boolean } = {};
      if (req.body?.name !== undefined) {
        const name = String(req.body.name).trim();
        if (!name)
          return res
            .status(400)
            .json({ error: "Informe o nome do funcionário." });
        data.name = name;
      }
      if (req.body?.password) {
        if (String(req.body.password).length < 4)
          return res
            .status(400)
            .json({ error: "A senha deve ter pelo menos 4 caracteres." });
        data.passwordHash = hashPassword(String(req.body.password));
      }
      if (req.body?.active !== undefined) data.active = !!req.body.active;

      try {
        const staff = await prisma.kitchenStaff.update({
          where: { id: existing.id },
          data,
          select: { id: true, name: true, active: true, createdAt: true },
        });
        // Se desativou, derruba as sessões abertas desse funcionário
        if (data.active === false) {
          await prisma.kitchenSession.deleteMany({
            where: { kitchenStaffId: existing.id },
          });
        }
        res.json(staff);
      } catch (error: any) {
        if (error.code === "P2002")
          return res
            .status(409)
            .json({ error: "Já existe um funcionário com esse nome." });
        console.error(error);
        res.status(500).json({ error: "Falha ao atualizar funcionário." });
      }
    }
  );

  app.delete(
    "/api/admin/:tenantId/kitchen/staff/:id",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "kds"
      );
      if (!tenant) return;

      const existing = await prisma.kitchenStaff.findFirst({
        where: { id: req.params.id, tenantId: tenant.id },
      });
      if (!existing)
        return res.status(404).json({ error: "Funcionário não encontrado." });

      await prisma.kitchenStaff.delete({ where: { id: existing.id } });
      res.json({ success: true });
    }
  );

  app.post(
    "/api/admin/:tenantId/table/:tableId/clear",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "tables"
      );
      if (!tenant) return;

      const { tableId } = req.params;

      try {
        // MERGED, não DELIVERED: esses pedidos originais da mesa nunca foram cobrados —
        // quem fatura a venda de verdade é o pedido novo criado pelo PDV no checkout
        // (pdv/order), lançado logo antes desta chamada. Se marcássemos DELIVERED aqui,
        // esses pedidos contariam como vendas duplicadas nos relatórios (cada um com seu
        // próprio paymentMethod), ao lado da venda real. MERGED os tira das listas de
        // "mesa ocupada" sem nunca contar como receita.
        const ordersToClear = await prisma.order.findMany({
          where: {
            tenantId: tenant.id,
            tableId: tableId,
            status: { notIn: ["DELIVERED", "CANCELLED", "MERGED"] },
          },
          select: { id: true },
        });

        const clearedOrders = await Promise.all(
          ordersToClear.map((o) =>
            prisma.order.update({ where: { id: o.id }, data: { status: "MERGED" } })
          )
        );

        io.to(`${tenant.id}-mesa-${tableId}`).emit("table-update");
        // Também avisa qualquer painel/dashboard aberto (outra aba, outro dispositivo)
        // de que esses pedidos saíram de AWAITING_PAYMENT — sem isso o alerta de
        // "aguardando caixa há 5 minutos" continuava aparecendo lá mesmo já finalizado.
        for (const o of clearedOrders) {
          io.to(`tenant-${tenant.id}`).emit("order-status-updated", o);
        }
        res.json({ ok: true });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to clear table" });
      }
    }
  );

  // Fecha uma comanda (balcão/garçom sem mesa) depois que o PDV já lançou a venda de
  // verdade nesse checkout — mesma lógica do clear de mesa: vira MERGED (não conta como
  // receita), nunca DELIVERED, pra não duplicar ao lado do pedido novo faturado. Sem isso
  // a comanda ficava presa em AWAITING_PAYMENT pra sempre e podia ser cobrada de novo.
  app.post(
    "/api/admin/:tenantId/comanda/:orderId/clear",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "tables"
      );
      if (!tenant) return;

      try {
        const orderToClear = await prisma.order.findFirst({
          where: {
            id: req.params.orderId,
            tenantId: tenant.id,
            status: { notIn: ["DELIVERED", "CANCELLED", "MERGED"] },
          },
        });

        if (orderToClear) {
          const clearedOrder = await prisma.order.update({
            where: { id: orderToClear.id },
            data: { status: "MERGED" },
          });

          // Avisa qualquer painel/dashboard aberto que esta comanda saiu de
          // AWAITING_PAYMENT, senão o alerta de "aguardando caixa há 5 minutos"
          // continua aparecendo lá mesmo já finalizada.
          io.to(`tenant-${tenant.id}`).emit("order-status-updated", clearedOrder);
        }

        io.to(`tenant-${tenant.id}`).emit("menu-updated", {
          tenantId: tenant.id,
        });
        res.json({ ok: true });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to clear comanda" });
      }
    }
  );

}
