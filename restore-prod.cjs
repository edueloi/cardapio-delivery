const { PrismaClient } = require('@prisma/client');
const { randomBytes, scryptSync } = require('crypto');
const p = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function run() {
  try {
    // 1. Upsert account
    let account = await p.account.findUnique({ where: { email: 'edueloi.ee@gmail.com' } });
    if (!account) {
      account = await p.account.create({
        data: { name: 'Eduardo', email: 'edueloi.ee@gmail.com', passwordHash: hashPassword('Edu@06051992') }
      });
      console.log('Account created:', account.id);
    } else {
      // Update password hash in case it changed
      account = await p.account.update({
        where: { id: account.id },
        data: { passwordHash: hashPassword('Edu@06051992') }
      });
      console.log('Account already exists, password reset:', account.id);
    }

    // 2. Upsert tenant
    let tenant = await p.tenant.findUnique({ where: { slug: 'pastel-do-edu' } });
    if (!tenant) {
      tenant = await p.tenant.create({
        data: { name: 'Pastel do Edu', slug: 'pastel-do-edu', isOpen: true }
      });
      console.log('Tenant created:', tenant.id);
    } else {
      console.log('Tenant already exists:', tenant.id);
    }

    // 3. Upsert membership
    const existing = await p.tenantMembership.findUnique({
      where: { accountId_tenantId: { accountId: account.id, tenantId: tenant.id } }
    });
    if (!existing) {
      await p.tenantMembership.create({
        data: { accountId: account.id, tenantId: tenant.id, role: 'OWNER' }
      });
      console.log('Membership created');
    } else {
      console.log('Membership already exists');
    }

    console.log('\nDone! Login: edueloi.ee@gmail.com / Edu@06051992');
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await p.$disconnect();
  }
}

run();
