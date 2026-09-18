import type { Express, Request, RequestHandler, Response } from "express";
import { hydrateOrderItemNames } from "../shared/order-helpers";

export interface RegisterCustomerRoutesOptions {
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

export function registerCustomerRoutes({
  app,
  prisma,
  requireAuth,
  requireTenantBySlug,
}: RegisterCustomerRoutesOptions) {
  app.get("/api/tenants/:slug/customer-orders/:phone", async (req, res) => {
    const { slug, phone } = req.params;

    try {
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });

      const orders = await prisma.order.findMany({
        where: {
          tenantId: tenant.id,
          customerPhone: phone,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      res.json(orders);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch customer orders" });
    }
  });

  // ── Cardápio digital: busca cliente + endereços salvos por telefone (sem login) ──
  // Usado no checkout público para pré-preencher nome e mostrar endereços já cadastrados.
  app.get("/api/tenants/:slug/public-customer/:phone", async (req, res) => {
    const { slug, phone } = req.params;
    const digits = phone.replace(/\D/g, "");

    try {
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });

      const customer = await prisma.customer.findUnique({
        where: { tenantId_phone: { tenantId: tenant.id, phone: digits } },
        include: {
          addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
        },
      });

      if (!customer) return res.json(null);

      res.json({
        name: customer.name,
        loyaltyPoints: customer.loyaltyPoints,
        addresses: customer.addresses,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao buscar cliente." });
    }
  });

  // Cria/atualiza cliente e adiciona um novo endereço (chamado quando o cliente confirma
  // os dados no checkout público — sem login, protegido só pelo tenant slug).
  app.post(
    "/api/tenants/:slug/public-customer/:phone/address",
    async (req, res) => {
      const { slug, phone } = req.params;
      const digits = phone.replace(/\D/g, "");
      const {
        name,
        label,
        cep,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
      } = req.body;

      if (!name || !street)
        return res
          .status(400)
          .json({ error: "Nome e endereço são obrigatórios." });

      try {
        const tenant = await prisma.tenant.findUnique({ where: { slug } });
        if (!tenant) return res.status(404).json({ error: "Tenant not found" });

        const customer = await prisma.customer.upsert({
          where: { tenantId_phone: { tenantId: tenant.id, phone: digits } },
          create: { tenantId: tenant.id, name, phone: digits },
          update: { name },
        });

        const existingCount = await prisma.customerAddress.count({
          where: { customerId: customer.id },
        });
        const address = await prisma.customerAddress.create({
          data: {
            customerId: customer.id,
            label: label || null,
            cep: cep || null,
            street,
            number: number || null,
            complement: complement || null,
            neighborhood: neighborhood || null,
            city: city || null,
            state: state || null,
            isDefault: existingCount === 0, // primeiro endereço cadastrado vira o padrão
          },
        });

        res.json(address);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Falha ao salvar endereço." });
      }
    }
  );


  // ─────────────────────────────────────────────────────────────
  // CUSTOMERS (CRM)
  // ─────────────────────────────────────────────────────────────

  app.get("/api/tenants/:slug/customers", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "customers"
    );
    if (!tenant) return;

    try {
      const {
        search,
        page = "1",
        limit = "50",
      } = req.query as Record<string, string>;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where: any = { tenantId: tenant.id };
      if (search) {
        const digits = search.replace(/\D/g, "");
        where.OR = [
          { name: { contains: search } },
          { phone: { contains: search } },
          { email: { contains: search } },
          // CPF é salvo só com dígitos — busca com ou sem pontuação encontra do mesmo jeito.
          ...(digits ? [{ cpf: { contains: digits } }] : []),
        ];
      }

      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          orderBy: { totalSpent: "desc" },
          skip,
          take: parseInt(limit),
        }),
        prisma.customer.count({ where }),
      ]);

      res.json({
        customers,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao buscar clientes." });
    }
  });

  app.get(
    "/api/tenants/:slug/customers/by-phone/:phone",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(
        req,
        res,
        req.params.slug,
        "customers"
      );
      if (!tenant) return;

      try {
        const customer = await prisma.customer.findUnique({
          where: {
            tenantId_phone: { tenantId: tenant.id, phone: req.params.phone },
          },
        });
        res.json(customer || null);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Falha ao buscar cliente." });
      }
    }
  );

  app.post("/api/tenants/:slug/customers", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "customers"
    );
    if (!tenant) return;

    try {
      const { name, phone, email, cpf, address, notes } = req.body;
      if (!name || !phone)
        return res
          .status(400)
          .json({ error: "Nome e telefone são obrigatórios." });
      const cpfDigits = cpf ? String(cpf).replace(/\D/g, "") : undefined;

      const customer = await prisma.customer.upsert({
        where: { tenantId_phone: { tenantId: tenant.id, phone } },
        create: {
          tenantId: tenant.id,
          name,
          phone,
          email,
          cpf: cpfDigits,
          address,
          notes,
        },
        update: { name, email, cpf: cpfDigits, address, notes },
      });
      res.json(customer);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao salvar cliente." });
    }
  });

  app.patch("/api/tenants/:slug/customers/:id", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "customers"
    );
    if (!tenant) return;

    try {
      const existing = await prisma.customer.findFirst({
        where: { id: req.params.id, tenantId: tenant.id },
      });
      if (!existing)
        return res.status(404).json({ error: "Cliente não encontrado." });

      const { name, phone, email, cpf, address, notes } = req.body;
      const cpfDigits =
        cpf !== undefined
          ? cpf
            ? String(cpf).replace(/\D/g, "")
            : null
          : undefined;
      const customer = await prisma.customer.update({
        where: { id: req.params.id },
        data: { name, phone, email, cpf: cpfDigits, address, notes },
      });
      res.json(customer);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Falha ao atualizar cliente." });
    }
  });

  app.get(
    "/api/tenants/:slug/customers/:id/orders",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(
        req,
        res,
        req.params.slug,
        "customers"
      );
      if (!tenant) return;

      try {
        const customer = await prisma.customer.findFirst({
          where: { id: req.params.id, tenantId: tenant.id },
        });
        if (!customer)
          return res.status(404).json({ error: "Cliente não encontrado." });

        const orders = await prisma.order.findMany({
          where: { tenantId: tenant.id, customerPhone: customer.phone },
          include: { items: { include: { product: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        });
        hydrateOrderItemNames(orders);
        res.json(orders);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Falha ao buscar pedidos do cliente." });
      }
    }
  );
}
