import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  const r = await p.$queryRawUnsafe('SELECT id, name, slug FROM condominiums');
  console.log(JSON.stringify(r));
} catch(e) {
  console.error('ERROR:', e.message);
}
await p.$disconnect();
