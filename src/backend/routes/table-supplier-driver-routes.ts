import type { Express, Request, RequestHandler, Response } from "express";
import type { Server } from "socket.io";

export interface RegisterTableSupplierDriverRoutesOptions {
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

export function registerTableSupplierDriverRoutes({
  app,
  io,
  prisma,
  requireAuth,
  requireTenantBySlug,
}: RegisterTableSupplierDriverRoutesOptions) {
  // ─── Suppliers ────────────────────────────────────────────────────────────────

  // ── Mesas do estabelecimento (persistidas — usadas pelo PDV/garçom em qualquer dispositivo) ──
  app.get("/api/tenants/:slug/tables", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "tables");
    if (!tenant) return;
    try {
      const tables = await (prisma as any).restaurantTable.findMany({
        where: { tenantId: tenant.id },
        orderBy: { sortOrder: "asc" },
      });
      res.json(tables);
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  app.post("/api/tenants/:slug/tables", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "tables");
    if (!tenant) return;
    try {
      const label = String(req.body?.label ?? "").trim();
      if (!label)
        return res
          .status(400)
          .json({ error: "Identificação da mesa é obrigatória." });
      const count = await (prisma as any).restaurantTable.count({
        where: { tenantId: tenant.id },
      });
      const table = await (prisma as any).restaurantTable.create({
        data: { tenantId: tenant.id, label, sortOrder: count },
      });
      res.json(table);
    } catch (err: any) {
      if (err?.code === "P2002")
        return res
          .status(409)
          .json({ error: "Já existe uma mesa com essa identificação." });
      res.status(500).json({ error: err?.message });
    }
  });

  app.delete("/api/tenants/:slug/tables/:id", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "tables");
    if (!tenant) return;
    try {
      const existing = await (prisma as any).restaurantTable.findFirst({
        where: { id: req.params.id, tenantId: tenant.id },
      });
      if (!existing)
        return res.status(404).json({ error: "Mesa não encontrada." });
      await (prisma as any).restaurantTable.delete({
        where: { id: req.params.id },
      });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  app.get("/api/tenants/:slug/suppliers", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "suppliers"
    );
    if (!tenant) return;
    try {
      const suppliers = await (prisma as any).supplier.findMany({
        where: { tenantId: tenant.id },
        include: {
          inventoryItems: { include: { inventoryItem: true } },
          _count: { select: { catalogItems: true } },
        },
        orderBy: [{ isFavorite: "desc" }, { name: "asc" }],
      });
      res.json(suppliers);
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  app.post("/api/tenants/:slug/suppliers", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "suppliers"
    );
    if (!tenant) return;
    try {
      const { inventoryItemIds = [], ...data } = req.body;
      if (!data.name?.trim())
        return res.status(400).json({ error: "Nome é obrigatório." });
      const supplier = await (prisma as any).supplier.create({
        data: {
          ...data,
          tenantId: tenant.id,
          inventoryItems: inventoryItemIds.length
            ? {
                create: inventoryItemIds.map((id: string) => ({
                  inventoryItemId: id,
                })),
              }
            : undefined,
        },
        include: { inventoryItems: { include: { inventoryItem: true } } },
      });
      res.json(supplier);
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  app.put("/api/tenants/:slug/suppliers/:id", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(
      req,
      res,
      req.params.slug,
      "suppliers"
    );
    if (!tenant) return;
    try {
      const existing = await (prisma as any).supplier.findFirst({
        where: { id: req.params.id, tenantId: tenant.id },
      });
      if (!existing)
        return res.status(404).json({ error: "Fornecedor não encontrado." });
      const {
        inventoryItemIds = [],
        id: _id,
        tenantId: _tid,
        createdAt: _c,
        updatedAt: _u,
        inventoryItems: _inv,
        ...data
      } = req.body;
      // Replace inventory item links
      await (prisma as any).supplierInventoryItem.deleteMany({
        where: { supplierId: req.params.id },
      });
      const supplier = await (prisma as any).supplier.update({
        where: { id: req.params.id },
        data: {
          ...data,
          inventoryItems: inventoryItemIds.length
            ? {
                create: inventoryItemIds.map((iid: string) => ({
                  inventoryItemId: iid,
                })),
              }
            : undefined,
        },
        include: { inventoryItems: { include: { inventoryItem: true } } },
      });
      res.json(supplier);
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  app.delete(
    "/api/tenants/:slug/suppliers/:id",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(
        req,
        res,
        req.params.slug,
        "suppliers"
      );
      if (!tenant) return;
      try {
        const existing = await (prisma as any).supplier.findFirst({
          where: { id: req.params.id, tenantId: tenant.id },
        });
        if (!existing)
          return res.status(404).json({ error: "Fornecedor não encontrado." });
        await (prisma as any).supplier.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
      } catch (err: any) {
        res.status(500).json({ error: err?.message });
      }
    }
  );

  // ─── Entregadores (motoboys) ──────────────────────────────────────────────────

  app.get("/api/tenants/:slug/delivery-drivers", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "drivers");
    if (!tenant) return;
    try {
      const drivers = await (prisma as any).deliveryDriver.findMany({
        where: { tenantId: tenant.id },
        orderBy: [{ active: "desc" }, { name: "asc" }],
      });
      res.json(drivers);
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  app.post("/api/tenants/:slug/delivery-drivers", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "drivers");
    if (!tenant) return;
    try {
      const { name, phone, vehicle, plate, active } = req.body;
      if (!name?.trim())
        return res.status(400).json({ error: "Nome é obrigatório." });
      const driver = await (prisma as any).deliveryDriver.create({
        data: {
          tenantId: tenant.id,
          name: name.trim(),
          phone: phone || null,
          vehicle: vehicle || null,
          plate: plate || null,
          active: active !== undefined ? Boolean(active) : true,
        },
      });
      res.json(driver);
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  app.put("/api/tenants/:slug/delivery-drivers/:id", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "drivers");
    if (!tenant) return;
    try {
      const existing = await (prisma as any).deliveryDriver.findFirst({
        where: { id: req.params.id, tenantId: tenant.id },
      });
      if (!existing)
        return res.status(404).json({ error: "Entregador não encontrado." });
      const { name, phone, vehicle, plate, active } = req.body;
      const driver = await (prisma as any).deliveryDriver.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined && { name: String(name).trim() }),
          ...(phone !== undefined && { phone: phone || null }),
          ...(vehicle !== undefined && { vehicle: vehicle || null }),
          ...(plate !== undefined && { plate: plate || null }),
          ...(active !== undefined && { active: Boolean(active) }),
        },
      });
      res.json(driver);
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  app.delete("/api/tenants/:slug/delivery-drivers/:id", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "drivers");
    if (!tenant) return;
    try {
      const existing = await (prisma as any).deliveryDriver.findFirst({
        where: { id: req.params.id, tenantId: tenant.id },
      });
      if (!existing)
        return res.status(404).json({ error: "Entregador não encontrado." });
      // Não apaga o histórico: pedidos antigos já têm driverName snapshotado, então só
      // desvincula o FK (SetNull) e remove o cadastro.
      await (prisma as any).deliveryDriver.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  // Relatório de entregas por entregador num período — quantidade e valor total das
  // entregas concluídas (Delivery, status DELIVERED) atribuídas a cada um.
  app.get("/api/tenants/:slug/delivery-drivers/report", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "drivers");
    if (!tenant) return;
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      const dateFrom = from ? new Date(from + "T00:00:00") : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const dateTo = to ? new Date(to + "T23:59:59") : new Date();

      const [drivers, orders] = await Promise.all([
        (prisma as any).deliveryDriver.findMany({ where: { tenantId: tenant.id } }),
        prisma.order.findMany({
          where: {
            tenantId: tenant.id,
            orderType: "DELIVERY",
            status: "DELIVERED",
            driverId: { not: null },
            createdAt: { gte: dateFrom, lte: dateTo },
          },
          select: { driverId: true, driverName: true, total: true },
        }),
      ]);

      const byDriver: Record<string, { driverId: string; name: string; active: boolean; deliveries: number; total: number }> = {};
      for (const d of drivers) {
        byDriver[d.id] = { driverId: d.id, name: d.name, active: d.active, deliveries: 0, total: 0 };
      }
      for (const o of orders as any[]) {
        const key = o.driverId as string;
        if (!byDriver[key]) {
          // Entregador removido do cadastro depois — mantém no relatório com o nome salvo no pedido.
          byDriver[key] = { driverId: key, name: o.driverName || "Entregador removido", active: false, deliveries: 0, total: 0 };
        }
        byDriver[key].deliveries += 1;
        byDriver[key].total += o.total;
      }

      res.json(Object.values(byDriver).sort((a, b) => b.deliveries - a.deliveries));
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  // Atribui (ou remove, driverId=null) o entregador responsável por um pedido de Delivery.
  app.patch("/api/tenants/:slug/orders/:orderId/driver", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug, "drivers");
    if (!tenant) return;
    try {
      const order = await prisma.order.findFirst({
        where: { id: req.params.orderId, tenantId: tenant.id },
      });
      if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
      if (order.orderType !== "DELIVERY")
        return res.status(400).json({ error: "Só pedidos de Delivery podem ter entregador." });

      const { driverId } = req.body;
      let driverName: string | null = null;
      if (driverId) {
        const driver = await (prisma as any).deliveryDriver.findFirst({
          where: { id: driverId, tenantId: tenant.id },
        });
        if (!driver) return res.status(404).json({ error: "Entregador não encontrado." });
        driverName = driver.name;
      }

      const updated = await prisma.order.update({
        where: { id: order.id },
        data: { driverId: driverId || null, driverName },
      });
      io.to(`tenant-${tenant.id}`).emit("order-status-updated", updated);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  // ─── Supplier Catalog Items ───────────────────────────────────────────────────

  app.get(
    "/api/tenants/:slug/suppliers/:supplierId/catalog",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(
        req,
        res,
        req.params.slug,
        "suppliers"
      );
      if (!tenant) return;
      try {
        const supplier = await (prisma as any).supplier.findFirst({
          where: { id: req.params.supplierId, tenantId: tenant.id },
        });
        if (!supplier)
          return res.status(404).json({ error: "Fornecedor não encontrado." });
        const items = await (prisma as any).supplierCatalogItem.findMany({
          where: { supplierId: req.params.supplierId },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        });
        res.json(items);
      } catch (err: any) {
        res.status(500).json({ error: err?.message });
      }
    }
  );

  app.post(
    "/api/tenants/:slug/suppliers/:supplierId/catalog",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(
        req,
        res,
        req.params.slug,
        "suppliers"
      );
      if (!tenant) return;
      try {
        const supplier = await (prisma as any).supplier.findFirst({
          where: { id: req.params.supplierId, tenantId: tenant.id },
        });
        if (!supplier)
          return res.status(404).json({ error: "Fornecedor não encontrado." });
        const { name, unit, price, notes, sortOrder } = req.body;
        if (!name?.trim())
          return res.status(400).json({ error: "Nome é obrigatório." });
        const item = await (prisma as any).supplierCatalogItem.create({
          data: {
            supplierId: req.params.supplierId,
            name: name.trim(),
            unit: unit ?? null,
            price: price != null ? Number(price) : null,
            notes: notes ?? null,
            sortOrder: sortOrder ?? 0,
          },
        });
        res.json(item);
      } catch (err: any) {
        res.status(500).json({ error: err?.message });
      }
    }
  );

  app.put(
    "/api/tenants/:slug/suppliers/:supplierId/catalog/:itemId",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(
        req,
        res,
        req.params.slug,
        "suppliers"
      );
      if (!tenant) return;
      try {
        const supplier = await (prisma as any).supplier.findFirst({
          where: { id: req.params.supplierId, tenantId: tenant.id },
        });
        if (!supplier)
          return res.status(404).json({ error: "Fornecedor não encontrado." });
        const { name, unit, price, notes, sortOrder } = req.body;
        const item = await (prisma as any).supplierCatalogItem.update({
          where: { id: req.params.itemId },
          data: {
            name: name?.trim(),
            unit: unit ?? null,
            price: price != null ? Number(price) : null,
            notes: notes ?? null,
            sortOrder: sortOrder ?? 0,
          },
        });
        res.json(item);
      } catch (err: any) {
        res.status(500).json({ error: err?.message });
      }
    }
  );

  app.delete(
    "/api/tenants/:slug/suppliers/:supplierId/catalog/:itemId",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantBySlug(
        req,
        res,
        req.params.slug,
        "suppliers"
      );
      if (!tenant) return;
      try {
        await (prisma as any).supplierCatalogItem.delete({
          where: { id: req.params.itemId },
        });
        res.json({ ok: true });
      } catch (err: any) {
        res.status(500).json({ error: err?.message });
      }
    }
  );
}
