import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const tenants = await prisma.tenant.findMany({ select: { slug: true, name: true }, take: 5 });
console.log(JSON.stringify(tenants, null, 2));
await prisma.$disconnect();
