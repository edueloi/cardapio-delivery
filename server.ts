import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "fs";
import { createServer } from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import { registerSocketEvents } from "./src/backend/realtime/register-socket-events";
import { createUploadMiddleware } from "./src/backend/http/upload";
import { createTenantAccess } from "./src/backend/http/tenant-access";
import { createTenantService } from "./src/backend/services/tenant-service";
import { prisma as _prisma } from "./src/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;
const {
  currentAccount,
  currentSessionToken,
  requireTenantById,
  requireTenantBySlug,
  requireTenantFromProduct,
  requireTenantFromOrder,
  requireTenantFromInventoryItem,
} = createTenantAccess(prisma);
const { ensureWppSetup, awardLoyaltyPoints } = createTenantService(prisma);
import { authMiddleware, requireAuth } from "./src/backend/auth";
import { registerProductionRoutes } from "./src/backend/production-routes";
import { restoreAllSessions } from "./src/backend/wpp/baileys-manager";
import { createOrderHelpers } from "./src/backend/shared/order-helpers";
import { injectSeoMeta, resolveSeoMeta } from "./src/backend/shared/seo";
import { registerAuthRoutes } from "./src/backend/routes/auth-routes";
import { registerSuperAdminRoutes } from "./src/backend/routes/superadmin-routes";
import { registerOwnerRoutes } from "./src/backend/routes/owner-routes";
import { registerTenantPublicRoutes } from "./src/backend/routes/tenant-public-routes";
import { registerOrderRoutes } from "./src/backend/routes/order-routes";
import { registerLoyaltyIfoodRoutes } from "./src/backend/routes/loyalty-ifood-routes";
import { registerTvRoutes } from "./src/backend/routes/tv-routes";
import { registerKitchenRoutes } from "./src/backend/routes/kitchen-routes";
import { registerCategoryProductRoutes } from "./src/backend/routes/category-product-routes";
import { registerCashRoutes } from "./src/backend/routes/cash-routes";
import { registerCustomerRoutes } from "./src/backend/routes/customer-routes";
import { registerInventoryRoutes } from "./src/backend/routes/inventory-routes";
import { registerReportRoutes } from "./src/backend/routes/report-routes";
import { registerPdvRoutes } from "./src/backend/routes/pdv-routes";
import { registerPaymentRoutes } from "./src/backend/routes/payment-routes";
import { registerPromotionBundleRoutes } from "./src/backend/routes/promotion-bundle-routes";
import { registerTableSupplierDriverRoutes } from "./src/backend/routes/table-supplier-driver-routes";
import { registerFiscalRoutes } from "./src/backend/routes/fiscal-routes";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

registerSocketEvents(io);

const { uploadDir, upload } = createUploadMiddleware();

// Efeitos colaterais de pedido/estoque usados por vários domínios de rota
// (pedidos, cozinha, PDV, estoque, caixa) — instanciados uma única vez aqui e
// injetados em quem precisa, pra não duplicar a lógica por módulo.
const {
  updateOrderStatus,
  handleStockBatchSideEffects,
  deductSelectedExtrasStock,
  emitInventoryRestockSideEffects,
  attachOrderDetails,
} = createOrderHelpers({ io, prisma, awardLoyaltyPoints });

app.use(cors() as any);
app.use(express.json());
app.use("/uploads", express.static(uploadDir));
app.use(
  "/downloads",
  express.static(path.join(process.cwd(), "public", "downloads"))
);
// URL curta pra digitar no controle remoto da TV/Fire Stick (app Downloader) —
// bem mais fácil que a URL completa do APK.
app.get("/tv", (req, res) => {
  // Serve o arquivo direto em vez de redirecionar — o cliente HTTP do app Downloader
  // (Fire TV) é simplificado e às vezes não segue redirect (relativo ou absoluto)
  // corretamente, resultando em tela branca sem baixar nada.
  res.download(
    path.join(process.cwd(), "public", "downloads", "BoxSys-PainelTV.apk"),
    "BoxSys-PainelTV.apk"
  );
});
// URL curta pro instalador do agente Windows (PC/notebook ligado na TV via HDMI) —
// mesmo padrão da rota /tv acima, só que pro instalador .exe em vez do APK.
app.get("/tv-windows", (req, res) => {
  res.download(
    path.join(process.cwd(), "public", "downloads", "BoxSys-PainelTV-Windows-Setup.exe"),
    "BoxSys-PainelTV-Windows-Setup.exe"
  );
});
app.use(authMiddleware);
registerProductionRoutes({
  app,
  io,
  prisma,
  requireAuth,
  requireTenantBySlug,
  currentAccount,
});

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

// ─────────────────────────────────────────────────────────────────────────────
// Registro das rotas por domínio. A ORDEM importa: o Express avalia rotas na
// ordem de registro, então grupos com paths que possam colidir (ex: as rotas
// /api/kitchen/global/* antes de /api/kitchen/:slug/*) precisam manter a mesma
// ordem relativa que tinham quando tudo morava neste arquivo. As rotas fiscais
// (NFC-e) em particular precisam vir ANTES do catch-all do SPA lá embaixo.
// ─────────────────────────────────────────────────────────────────────────────

registerAuthRoutes({
  app,
  prisma,
  requireAuth,
  currentAccount,
  currentSessionToken,
  ensureWppSetup,
});

registerSuperAdminRoutes({
  app,
  prisma,
  requireAuth,
  upload,
  currentAccount,
});

registerOwnerRoutes({
  app,
  prisma,
  requireAuth,
  upload,
  currentAccount,
  requireTenantById,
  requireTenantBySlug,
  ensureWppSetup,
});

registerTenantPublicRoutes({
  app,
  prisma,
  requireAuth,
  requireTenantBySlug,
});

registerOrderRoutes({
  app,
  io,
  prisma,
  requireAuth,
  currentAccount,
  requireTenantById,
  requireTenantBySlug,
  requireTenantFromOrder,
  updateOrderStatus,
  emitInventoryRestockSideEffects,
  deductSelectedExtrasStock,
});

registerLoyaltyIfoodRoutes({
  app,
  prisma,
  requireAuth,
  requireTenantById,
});

registerTvRoutes({
  app,
  prisma,
  requireAuth,
  requireTenantBySlug,
});

registerKitchenRoutes({
  app,
  io,
  prisma,
  requireAuth,
  requireTenantById,
  updateOrderStatus,
});

registerCategoryProductRoutes({
  app,
  io,
  prisma,
  requireAuth,
  requireTenantById,
  requireTenantFromProduct,
  ensureWppSetup,
});

registerCashRoutes({
  app,
  io,
  prisma,
  requireAuth,
  currentAccount,
  requireTenantBySlug,
  attachOrderDetails,
});

registerCustomerRoutes({
  app,
  prisma,
  requireAuth,
  requireTenantBySlug,
});

registerInventoryRoutes({
  app,
  prisma,
  requireAuth,
  requireTenantById,
  requireTenantBySlug,
  requireTenantFromInventoryItem,
  handleStockBatchSideEffects,
  emitInventoryRestockSideEffects,
});

registerReportRoutes({
  app,
  prisma,
  requireAuth,
  requireTenantBySlug,
});

registerPdvRoutes({
  app,
  io,
  prisma,
  requireAuth,
  currentAccount,
  requireTenantBySlug,
  awardLoyaltyPoints,
  handleStockBatchSideEffects,
  deductSelectedExtrasStock,
});

registerPaymentRoutes({
  app,
  io,
  prisma,
  requireAuth,
  requireTenantBySlug,
  updateOrderStatus,
});

registerPromotionBundleRoutes({
  app,
  prisma,
  requireAuth,
  requireTenantById,
  requireTenantBySlug,
});

registerTableSupplierDriverRoutes({
  app,
  io,
  prisma,
  requireAuth,
  requireTenantBySlug,
});

// Precisa ficar registrado ANTES do catch-all app.get("*", ...) do SPA (mais abaixo)
// — Express avalia rotas na ordem de registro, e um catch-all sem guarda de path
// intercepta qualquer GET seguinte, mesmo de rotas de API distintas, devolvendo o
// index.html do frontend em vez de JSON (bug real: nfce/list, nfce/status e nfce/danfe
// nunca eram alcançados, só as rotas POST — emit/cancel — funcionavam).
registerFiscalRoutes({
  app,
  prisma,
  requireAuth,
  requireTenantById,
});

if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });

  app.use(async (req, res, next) => {
    // Só intercepta navegação de página real — deixa passar direto pro Vite qualquer
    // asset/módulo interno (paths virtuais como /@vite/client e /@react-refresh, ou
    // qualquer arquivo com extensão), senão o Vite nunca consegue servir JS/CSS com o
    // Content-Type correto e a página inteira quebra (erro de MIME type no browser).
    if (
      req.method !== "GET" ||
      req.path.startsWith("/api") ||
      req.path.startsWith("/@") ||
      req.path.includes(".")
    )
      return next();
    try {
      const rootIndexPath = path.join(process.cwd(), "index.html");
      const rawHtml = fs.readFileSync(rootIndexPath, "utf-8");
      const seo = await resolveSeoMeta(req.path, req.hostname);
      const html = await vite.transformIndexHtml(
        req.originalUrl,
        injectSeoMeta(rawHtml, seo)
      );
      res.status(200).set({ "Content-Type": "text/html" }).send(html);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), "dist");
  // index: false — sem isso, o express.static serve dist/index.html direto pra qualquer
  // requisição de diretório (inclusive "/"), pulando o app.get("*") abaixo e servindo o
  // HTML com os placeholders {{TITLE}}/{{DESCRIPTION}}/{{IMAGE}} nunca substituídos.
  app.use(express.static(distPath, { index: false }));

  app.get("*", async (req, res) => {
    const seo = await resolveSeoMeta(req.path, req.hostname);
    try {
      const indexHtml = fs.readFileSync(
        path.join(distPath, "index.html"),
        "utf-8"
      );
      res.send(injectSeoMeta(indexHtml, seo));
    } catch (e) {
      res.sendFile(path.join(distPath, "index.html"));
    }
  });
}


await restoreAllSessions().catch((error) => {
  console.warn("[Baileys] Falha ao restaurar sessões:", error);
});

const PORT = Number(process.env.PORT) || 3012;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
