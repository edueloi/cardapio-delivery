import type { Request, Response } from "express";
import {
  getAuthorizedTenantById,
  getAuthorizedTenantBySlug,
  membershipCanAccess,
  type AuthenticatedRequest,
} from "../auth";

/** Regras únicas de conta, tenant e permissões usadas por todas as rotas privadas. */
export function createTenantAccess(prisma: any) {
  const currentAccount = (req: Request) => (req as AuthenticatedRequest).account ?? null;
  const currentSessionToken = (req: Request) => (req as AuthenticatedRequest).sessionToken ?? null;

  const authorize = async (req: Request, res: Response, result: any, tabId?: string | string[]) => {
    if (!currentAccount(req)) { res.status(401).json({ error: "Login obrigatório." }); return null; }
    if (!result) { res.status(403).json({ error: "Você não tem acesso a este estabelecimento." }); return null; }
    const tabs = tabId ? (Array.isArray(tabId) ? tabId : [tabId]) : [];
    if (tabs.length > 0 && !tabs.some((tab) => membershipCanAccess(result.membership, tab))) {
      res.status(403).json({ error: "Você não tem permissão para acessar esta área." }); return null;
    }
    (req as AuthenticatedRequest).membership = result.membership;
    return result.tenant;
  };

  const requireTenantById = async (req: Request, res: Response, tenantId: string, tabId?: string | string[]) =>
    authorize(req, res, await getAuthorizedTenantById(currentAccount(req)?.id || "", tenantId), tabId);

  const requireTenantBySlug = async (req: Request, res: Response, slug: string, tabId?: string | string[]) =>
    authorize(req, res, await getAuthorizedTenantBySlug(currentAccount(req)?.id || "", slug), tabId);

  const requireTenantFromProduct = async (req: Request, res: Response, productId: string) => {
    const product = await prisma.product.findUnique({ where: { id: productId }, include: { tenant: true } });
    if (!product) { res.status(404).json({ error: "Produto não encontrado." }); return null; }
    const tenant = await requireTenantById(req, res, product.tenantId, "menu");
    return tenant ? { product, tenant } : null;
  };

  const requireTenantFromOrder = async (req: Request, res: Response, orderId: string) => {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { tenant: true, items: { include: { product: true, productVariant: true } } } });
    if (!order) { res.status(404).json({ error: "Pedido não encontrado." }); return null; }
    const tenant = await requireTenantById(req, res, order.tenantId, ["live-orders", "waiter", "kds", "pos"]);
    return tenant ? { order, tenant } : null;
  };

  const requireTenantFromInventoryItem = async (req: Request, res: Response, itemId: string) => {
    const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item) { res.status(404).json({ error: "Item não encontrado." }); return null; }
    const tenant = await requireTenantById(req, res, item.tenantId, "inventory");
    return tenant ? { item, tenant } : null;
  };

  return { currentAccount, currentSessionToken, requireTenantById, requireTenantBySlug, requireTenantFromProduct, requireTenantFromOrder, requireTenantFromInventoryItem };
}
