import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, slug: true } });
  console.log(JSON.stringify(tenants, null, 2));
}
main().finally(() => prisma.$disconnect());
