/** Regras de negócio do estabelecimento que não pertencem às rotas HTTP. */
export function createTenantService(prisma: any) {
  const ensureWppSetup = async (tenantId: string, tenantName: string) => {
    const [instance, config] = await Promise.all([
      prisma.wppInstance.upsert({
        where: { tenantId },
        create: { tenantId, instanceName: `${tenantName} Bot`, status: "not_configured" },
        update: {},
      }),
      prisma.wppBotConfig.upsert({
        where: { tenantId },
        create: { tenantId, botEnabled: true, autoReplyEnabled: true, sendOrderCreated: true, sendStatusUpdates: true },
        update: {},
      }),
    ]);
    return { instance, config };
  };

  const awardLoyaltyPoints = async (
    tenantLoyaltyConfigRaw: string | null | undefined,
    customerId: string,
    orderTotal: number,
  ): Promise<{ pointsEarned: number; newBalance: number } | null> => {
    if (!tenantLoyaltyConfigRaw || !customerId) return null;
    try {
      const config = JSON.parse(tenantLoyaltyConfigRaw);
      const pointsPerReal = config?.enabled ? Number(config.pointsPerReal) || 0 : 0;
      const pointsEarned = Math.floor(orderTotal * pointsPerReal);
      if (pointsEarned <= 0) return null;
      const updated = await prisma.customer.update({ where: { id: customerId }, data: { loyaltyPoints: { increment: pointsEarned } } });
      return { pointsEarned, newBalance: updated.loyaltyPoints };
    } catch (error) {
      console.error("[Loyalty] Falha ao somar pontos:", error);
      return null;
    }
  };

  return { ensureWppSetup, awardLoyaltyPoints };
}
