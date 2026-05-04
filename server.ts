import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { PrismaClient } from "@prisma/client";
import multer from "multer";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
// Serve static files from uploads
app.use("/uploads", express.static(uploadDir));

// Socket.io for Real-time Notifications
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join-tenant", (tenantId: string) => {
    socket.join(`tenant-${tenantId}`);
    console.log(`User joined tenant room: tenant-${tenantId}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// API Routes
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// 1. Get Tenant Info
app.get("/api/tenants/:slug", async (req, res) => {
  const { slug } = req.params;
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      include: {
        categories: {
          include: {
            products: {
              where: { available: true },
              include: {
                variants: true
              }
            }
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// 2. Place Order
app.post("/api/orders", async (req, res) => {
  const { customerName, customerPhone, address, items, tenantId, orderType, paymentMethod, paymentDetail } = req.body;

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    let total = 0;
    const orderItemsData = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({ 
        where: { id: item.productId },
        include: { variants: true }
      });
      
      if (product) {
        let itemPrice = product.price;
        if (item.productVariantId) {
          const variant = product.variants.find(v => v.id === item.productVariantId);
          if (variant) {
            itemPrice = variant.price;
          }
        }

        total += itemPrice * item.quantity;
        orderItemsData.push({
          productId: item.productId,
          productVariantId: item.productVariantId || null,
          quantity: item.quantity,
          price: itemPrice,
          notes: item.notes || null,
        });
      }
    }

    const order = await prisma.order.create({
      data: {
        customerName,
        customerPhone,
        address,
        orderType: orderType || 'DELIVERY',
        paymentMethod: paymentMethod || 'CASH',
        paymentDetail,
        total,
        tenantId,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    // Notify Kitchen/Admin via Socket
    io.to(`tenant-${tenantId}`).emit("new-order", order);

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to place order" });
  }
});

// 3. Update Order Status
app.patch("/api/orders/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: { 
        tenant: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    // Stock Deduction Logic: Deduct when order moves to PREPARING
    if (status === "PREPARING") {
      for (const item of order.items) {
        let invId = item.productVariantId 
          ? (await prisma.productVariant.findUnique({ where: { id: item.productVariantId } }))?.inventoryItemId
          : item.product.inventoryItemId;

        if (invId) {
          await prisma.inventoryItem.update({
            where: { id: invId },
            data: { 
              quantity: { decrement: item.quantity },
              movements: {
                create: {
                  type: "OUT",
                  quantity: item.quantity,
                  reason: "SALE",
                  orderId: order.id
                }
              }
            }
          });
        }
      }
    }

    // Notify Customer (Simulated Bot Notification or UI Update)
    io.to(`tenant-${order.tenantId}`).emit("order-status-updated", order);

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// 4. Admin: Get Orders
app.get("/api/admin/:tenantId/orders", async (req, res) => {
  const { tenantId } = req.params;
  try {
    const orders = await prisma.order.findMany({
      where: { tenantId },
      include: {
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// 5. Admin: Update Tenant Profile
app.patch("/api/tenants/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description, address, logoUrl, whatsapp } = req.body;
  try {
    const updated = await prisma.tenant.update({
      where: { id },
      data: { name, description, address, logoUrl, whatsapp }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update tenant" });
  }
});

// 6. Admin: Categories & Products
app.post("/api/categories", async (req, res) => {
  const { name, tenantId } = req.body;
  try {
    const category = await prisma.category.create({
      data: { name, tenantId }
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: "Failed to create category" });
  }
});

app.post("/api/products", async (req, res) => {
  const { name, description, price, imageUrl, categoryId, tenantId, variants } = req.body;
  try {
    const product = await prisma.product.create({
      data: { 
        name, 
        description, 
        price: parseFloat(price), 
        imageUrl, 
        categoryId, 
        tenantId,
        available: true,
        variants: variants ? {
          create: variants.map((v: any) => ({
            name: v.name,
            price: parseFloat(v.price),
            description: v.description
          }))
        } : undefined
      },
      include: { variants: true }
    });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: "Failed to create product" });
  }
});

app.patch("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description, price, imageUrl, variants } = req.body;
  try {
    // We update the product and replace all variants for simplicity
    const product = await prisma.$transaction(async (tx) => {
      // Delete existing variants
      await tx.productVariant.deleteMany({ where: { productId: id } });

      // Update product
      return await tx.product.update({
        where: { id },
        data: {
          name,
          description,
          price: parseFloat(price),
          imageUrl,
          variants: variants ? {
            create: variants.map((v: any) => ({
              name: v.name,
              price: parseFloat(v.price),
              description: v.description
            }))
          } : undefined
        },
        include: { variants: true }
      });
    });
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.sendStatus(200);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// 7. Bot Simulation Endpoint
app.post("/api/bot/webhook", async (req, res) => {
  // This would be triggered by WhatsApp Webhook (Meta API)
  const { from, body, tenantSlug } = req.body;
  
  // Basic Logic: If user says "cardapio", return link
  if (body.toLowerCase().includes("cardapio")) {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (tenant) {
      return res.json({
        reply: `Olá! Veja nosso cardápio online aqui: ${process.env.APP_URL}/${tenantSlug}`,
      });
    }
  }
  
  res.json({ reply: "Não entendi. Digite 'cardapio' para ver as opções." });
});

// 8. Finance & Cash Register
app.get("/api/tenants/:slug/finance-summary", async (req, res) => {
  const { slug } = req.params;
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const now = new Date();
    // Use ISO strings or proper date objects for SQLite/Prisma comparison
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [daily, weekly, monthly] = await Promise.all([
      prisma.order.aggregate({
        where: { tenantId: tenant.id, status: { notIn: ['CANCELLED', 'PENDING'] }, createdAt: { gte: startOfDay } },
        _sum: { total: true },
        _count: true
      }),
      prisma.order.aggregate({
        where: { tenantId: tenant.id, status: { notIn: ['CANCELLED', 'PENDING'] }, createdAt: { gte: startOfWeek } },
        _sum: { total: true }
      }),
      prisma.order.aggregate({
        where: { tenantId: tenant.id, status: { notIn: ['CANCELLED', 'PENDING'] }, createdAt: { gte: startOfMonth } },
        _sum: { total: true }
      })
    ]);

    res.json({
      daily: daily._sum.total || 0,
      dailyCount: daily._count || 0,
      weekly: weekly._sum.total || 0,
      monthly: monthly._sum.total || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch finance summary" });
  }
});

app.get("/api/tenants/:slug/cash/current", async (req, res) => {
  const { slug } = req.params;
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const currentCash = await prisma.cashRegister.findFirst({
      where: { tenantId: tenant.id, status: 'OPEN' },
      orderBy: { openedAt: 'desc' }
    });

    if (currentCash) {
       const ordersSinceOpen = await prisma.order.aggregate({
         where: { 
           tenantId: tenant.id, 
           status: { notIn: ['CANCELLED', 'PENDING'] }, 
           createdAt: { gte: currentCash.openedAt },
           paymentMethod: 'CASH'
         },
         _sum: { total: true }
       });
       
       const totalCashSales = ordersSinceOpen._sum.total || 0;
       return res.json({
         ...currentCash,
         expectedBalance: currentCash.openingBalance + totalCashSales
       });
    }

    res.json(null);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch current cash" });
  }
});

app.post("/api/tenants/:slug/cash/open", async (req, res) => {
  const { slug } = req.params;
  const { openingBalance } = req.body;
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const openCash = await prisma.cashRegister.create({
      data: {
        tenantId: tenant.id,
        openingBalance: parseFloat(openingBalance),
        status: 'OPEN'
      }
    });
    res.json(openCash);
  } catch (error) {
    res.status(500).json({ error: "Failed to open cash" });
  }
});

app.post("/api/tenants/:slug/cash/close", async (req, res) => {
  const { slug } = req.params;
  const { closingBalance, notes } = req.body;
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const currentCash = await prisma.cashRegister.findFirst({
      where: { tenantId: tenant.id, status: 'OPEN' },
      orderBy: { openedAt: 'desc' }
    });

    if (!currentCash) return res.status(400).json({ error: "No open cash register found" });

    const ordersSinceOpen = await prisma.order.aggregate({
      where: { 
        tenantId: tenant.id, 
        status: { notIn: ['CANCELLED', 'PENDING'] }, 
        createdAt: { gte: currentCash.openedAt },
        paymentMethod: 'CASH'
      },
      _sum: { total: true }
    });

    const expectedBalance = currentCash.openingBalance + (ordersSinceOpen._sum.total || 0);

    const closedCash = await prisma.cashRegister.update({
      where: { id: currentCash.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closingBalance: parseFloat(closingBalance),
        expectedBalance,
        notes
      }
    });

    res.json(closedCash);
  } catch (error) {
    res.status(500).json({ error: "Failed to close cash" });
  }
});

app.get("/api/tenants/:slug/cash/history", async (req, res) => {
  const { slug } = req.params;
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const history = await prisma.cashRegister.findMany({
      where: { tenantId: tenant.id, status: 'CLOSED' },
      orderBy: { openedAt: 'desc' },
      take: 20
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch cash history" });
  }
});

app.get("/api/tenants/:slug/customer-orders/:phone", async (req, res) => {
  const { slug, phone } = req.params;
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const orders = await prisma.order.findMany({
      where: { 
        tenantId: tenant.id,
        customerPhone: phone
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch customer orders" });
  }
});

// --- Inventory API ---
app.get("/api/tenants/:slug/inventory", async (req, res) => {
  const { slug } = req.params;
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const items = await prisma.inventoryItem.findMany({
      where: { tenantId: tenant.id },
      include: { category: true },
      orderBy: { name: 'asc' }
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

app.post("/api/inventory/categories", async (req, res) => {
  const { name, tenantId } = req.body;
  try {
    const category = await prisma.inventoryCategory.create({
      data: { name, tenantId }
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: "Failed to create inventory category" });
  }
});

app.get("/api/tenants/:slug/inventory/categories", async (req, res) => {
  const { slug } = req.params;
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    const categories = await prisma.inventoryCategory.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch inventory categories" });
  }
});

app.post("/api/inventory/items", async (req, res) => {
  const { tenantId, name, code, brand, purchasePrice, sellingPrice, quantity, minStock, unit, weight, usage, expirationDate, purchaseDate, categoryId } = req.body;
  try {
    const item = await prisma.inventoryItem.create({
      data: {
        tenantId,
        name,
        code,
        brand,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
        sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null,
        quantity: parseFloat(quantity || 0),
        minStock: minStock ? parseFloat(minStock) : null,
        unit,
        weight,
        usage: usage || "SALE",
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        categoryId,
        movements: quantity && parseFloat(quantity) > 0 ? {
          create: {
            type: "IN",
            quantity: parseFloat(quantity),
            reason: "MANUAL"
          }
        } : undefined
      }
    });
    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create inventory item" });
  }
});

app.patch("/api/inventory/items/:id", async (req, res) => {
  const { id } = req.params;
  const { name, code, brand, purchasePrice, sellingPrice, quantity, minStock, unit, weight, usage, expirationDate, purchaseDate, categoryId } = req.body;
  try {
    const existing = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Item not found" });

    const newQty = parseFloat(quantity || 0);
    const diff = newQty - existing.quantity;

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        name,
        code,
        brand,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
        sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null,
        quantity: newQty,
        minStock: minStock ? parseFloat(minStock) : null,
        unit,
        weight,
        usage,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        categoryId,
        movements: diff !== 0 ? {
          create: {
            type: diff > 0 ? "IN" : "OUT",
            quantity: Math.abs(diff),
            reason: "MANUAL"
          }
        } : undefined
      }
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: "Failed to update inventory item" });
  }
});

app.delete("/api/inventory/items/:id", async (req, res) => {
  try {
    await prisma.inventoryItem.delete({ where: { id: req.params.id } });
    res.sendStatus(200);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// Vite Setup
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

const PORT = 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
