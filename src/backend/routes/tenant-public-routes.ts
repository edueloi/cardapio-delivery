import type { Express, Request, RequestHandler, Response } from "express";
import {
  fmtBRL,
  geocodeCep,
  haversineKm,
  isProductActiveNow,
  isWithinBusinessHours,
} from "../shared/utils";

export interface RegisterTenantPublicRoutesOptions {
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

export function registerTenantPublicRoutes({
  app,
  prisma,
  requireAuth,
  requireTenantBySlug,
}: RegisterTenantPublicRoutesOptions) {
  app.get("/api/tenants/check-slug/:slug", async (req, res) => {
    const { slug } = req.params;
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    res.json({ taken: !!existing });
  });

  app.get("/api/tenants/:slug", async (req, res) => {
    const { slug } = req.params;

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { slug },
        include: {
          categories: {
            orderBy: { sortOrder: "asc" },
            include: {
              products: {
                where: { available: true, pdvOnly: false },
                orderBy: { sortOrder: "asc" },
                include: {
                  variants: { include: { inventoryItem: true } },
                  inventoryItem: true,
                },
              },
            },
          },
        },
      });

      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Filter out products with zero stock or inactive schedule rule
      const filteredCategories = tenant.categories
        .map((cat) => ({
          ...cat,
          products: cat.products.filter((p) => {
            if (p.inventoryItem && p.inventoryItem.quantity <= 0) return false;
            if (
              (p as any).scheduleRule &&
              !isProductActiveNow((p as any).scheduleRule)
            )
              return false;
            return true;
          }),
        }))
        .filter((cat) => cat.products.length > 0);

      // Fechamento manual ("Status do Estabelecimento") sempre tem prioridade — permite
      // fechar antes da hora (ex: acabou insumo). Fora isso, fecha automaticamente fora do
      // horário de funcionamento configurado, mesmo com o toggle manual em "Aberta".
      const effectiveIsOpen =
        tenant.isOpen === false
          ? false
          : isWithinBusinessHours(tenant.businessHours);

      // Os itens usados dentro de um combo podem estar marcados como "somente PDV"
      // para não poluir a vitrine. Ainda assim, eles precisam chegar ao seletor de
      // escolhas do produto-pai no balcão, mesa e delivery.
      const selectionCategoryIds = new Set<string>();
      const selectionProductIds = new Set<string>();
      for (const category of filteredCategories) {
        for (const product of category.products) {
          if (!product.selectionGroup) continue;
          try {
            const rawGroups = JSON.parse(product.selectionGroup);
            const groups = Array.isArray(rawGroups) ? rawGroups : [rawGroups];
            for (const group of groups) {
              if (group?.sourceType === "category" && group.categoryId) selectionCategoryIds.add(group.categoryId);
              if (group?.sourceType === "products" && Array.isArray(group.productIds)) group.productIds.forEach((id: string) => selectionProductIds.add(id));
            }
          } catch {
            // Configuração antiga ou inválida: o produto continua disponível, só não
            // há opções adicionais para resolver neste retorno público.
          }
        }
      }
      // Sem filtro de `available` aqui: essas opções costumam ser desativadas como
      // produto avulso (o cliente nunca compra "Água" ou "Yakult" soltos), existindo
      // só como sabor/topping dentro do grupo de seleção do produto-pai — filtrar por
      // available fazia a opção sumir do seletor mesmo com o produto-pai disponível
      // (bug relatado: Bubble Tea aparecia sem nenhuma opção de "Base" no cardápio
      // público, só funcionava no PDV, que não aplica esse filtro).
      const selectionGroupProducts = (selectionCategoryIds.size || selectionProductIds.size)
        ? await prisma.product.findMany({
            where: {
              tenantId: tenant.id,
              OR: [
                ...(selectionCategoryIds.size ? [{ categoryId: { in: [...selectionCategoryIds] } }] : []),
                ...(selectionProductIds.size ? [{ id: { in: [...selectionProductIds] } }] : []),
              ],
            },
            orderBy: { sortOrder: "asc" },
            include: { variants: { include: { inventoryItem: true } }, inventoryItem: true },
          })
        : [];
      const visibleSelectionGroupProducts = selectionGroupProducts.filter((product) => {
        if (product.inventoryItem && product.inventoryItem.quantity <= 0) return false;
        if (product.scheduleRule && !isProductActiveNow(product.scheduleRule)) return false;
        return true;
      });

      res.json({
        ...tenant,
        categories: filteredCategories,
        selectionGroupProducts: visibleSelectionGroupProducts,
        effectiveIsOpen,
        isDeliveryOpen: tenant.isDeliveryOpen ?? true,
      });
    } catch (error) {
      console.error("Error fetching tenant:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Calculate delivery fee for a given CEP
  app.get("/api/tenants/:slug/delivery-fee", async (req, res) => {
    const { slug } = req.params;
    const { cep } = req.query as { cep?: string };

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { slug },
        select: { deliveryConfig: true },
      });
      if (!tenant) return res.status(404).json({ error: "Not found" });

      if (!tenant.deliveryConfig) return res.json({ fee: 0, label: "Grátis" });

      const config = JSON.parse(tenant.deliveryConfig) as {
        mode: string;
        fixedFee?: number;
        defaultFee?: number;
        allowUnlisted?: boolean;
        zones?: Array<{ id: string; label: string; ceps: string[]; fee: number }>;
        originCep?: string;
        kmRanges?: Array<{ id: string; upToKm: number; fee: number }>;
        kmDefaultFee?: number;
        kmAllowBeyond?: boolean;
      };

      if (config.mode === "free") return res.json({ fee: 0, label: "Grátis" });
      if (config.mode === "fixed")
        return res.json({
          fee: config.fixedFee ?? 0,
          label: fmtBRL(config.fixedFee ?? 0),
        });

      if (config.mode === "zones" && cep) {
        const cleanCep = cep.replace(/\D/g, "");
        const zone = config.zones?.find((z) =>
          z.ceps.some((prefix) => cleanCep.startsWith(prefix.replace(/\D/g, "")))
        );
        if (zone)
          return res.json({
            fee: zone.fee,
            label: zone.fee === 0 ? "Grátis" : fmtBRL(zone.fee),
            zone: zone.label,
          });
        if (config.allowUnlisted === false)
          return res.json({
            fee: null,
            label: "Fora da área de entrega",
            blocked: true,
          });
        const fallback = config.defaultFee ?? 0;
        return res.json({
          fee: fallback,
          label: fallback === 0 ? "Grátis" : fmtBRL(fallback),
          zone: "Outros",
        });
      }

      if (config.mode === "km" && cep) {
        if (!config.originCep || !config.kmRanges?.length) {
          return res.json({ fee: 0, label: "Grátis" });
        }
        const [origin, destination] = await Promise.all([
          geocodeCep(config.originCep),
          geocodeCep(cep),
        ]);
        if (!origin || !destination) {
          return res.json({
            fee: config.kmDefaultFee ?? 0,
            label: "Distância não calculável",
            distanceKm: null,
          });
        }
        const distanceKm = haversineKm(
          origin.lat,
          origin.lng,
          destination.lat,
          destination.lng
        );
        const sorted = [...config.kmRanges].sort((a, b) => a.upToKm - b.upToKm);
        const matched = sorted.find((r) => distanceKm <= r.upToKm);
        if (matched) {
          return res.json({
            fee: matched.fee,
            label: matched.fee === 0 ? "Grátis" : fmtBRL(matched.fee),
            distanceKm: Math.round(distanceKm * 10) / 10,
            range: `até ${matched.upToKm} km`,
          });
        }
        // beyond last range
        if (config.kmAllowBeyond === false) {
          return res.json({
            fee: null,
            label: "Fora da área de entrega",
            blocked: true,
            distanceKm: Math.round(distanceKm * 10) / 10,
          });
        }
        const beyond = config.kmDefaultFee ?? 0;
        return res.json({
          fee: beyond,
          label: beyond === 0 ? "Grátis" : fmtBRL(beyond),
          distanceKm: Math.round(distanceKm * 10) / 10,
          range: `além de ${sorted[sorted.length - 1].upToKm} km`,
        });
      }

      return res.json({ fee: 0, label: "Grátis" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/admin/tenant/:slug", requireAuth, async (req, res) => {
    const tenant = await requireTenantBySlug(req, res, req.params.slug);
    if (!tenant) return;

    const completeTenant = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      include: {
        categories: {
          orderBy: { sortOrder: "asc" },
          include: {
            products: {
              orderBy: { sortOrder: "asc" },
              include: {
                variants: { include: { inventoryItem: true } },
                inventoryItem: true,
              },
            },
          },
        },
        wppInstance: true,
        wppBotConfig: true,
      },
    });

    // Enriquece produtos com recipeId (campo novo não está no Prisma client gerado)
    if (completeTenant) {
      const productIds = completeTenant.categories.flatMap((c: any) =>
        (c.products || []).map((p: any) => p.id)
      );
      if (productIds.length > 0) {
        const placeholders = productIds.map(() => "?").join(", ");
        const rows = (await prisma.$queryRawUnsafe(
          `SELECT id, recipe_id FROM products WHERE id IN (${placeholders})`,
          ...productIds
        )) as Array<{ id: string; recipe_id: string | null }>;
        const recipeMap = new Map(rows.map((r) => [r.id, r.recipe_id]));
        (completeTenant as any).categories = completeTenant.categories.map(
          (cat: any) => ({
            ...cat,
            products: (cat.products || []).map((p: any) => ({
              ...p,
              recipeId: recipeMap.get(p.id) ?? null,
            })),
          })
        );
      }
    }

    // loyaltyConfig é guardado como JSON string no banco, mas o frontend espera o objeto já parseado
    if (completeTenant) {
      (completeTenant as any).loyaltyConfig = completeTenant.loyaltyConfig
        ? (() => {
            try {
              return JSON.parse(completeTenant.loyaltyConfig as string);
            } catch {
              return null;
            }
          })()
        : null;
    }

    if (completeTenant) {
      (completeTenant as any).effectiveIsOpen =
        completeTenant.isOpen === false
          ? false
          : isWithinBusinessHours(completeTenant.businessHours);
    }

    res.json(completeTenant);
  });
}
