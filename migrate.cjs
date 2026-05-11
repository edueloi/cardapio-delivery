/**
 * Safe migration script — only ADDs columns, never drops tables or data.
 * Run with: node migrate.cjs
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const migrations = [
  {
    name: 'add_products_extras',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'extras'",
    run: "ALTER TABLE products ADD COLUMN extras TEXT NULL",
  },
  {
    name: 'add_products_pdv_only',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'pdv_only'",
    run: "ALTER TABLE products ADD COLUMN pdv_only TINYINT(1) NOT NULL DEFAULT 0",
  },
  {
    name: 'add_products_auto_disable',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'auto_disable_when_out_of_stock'",
    run: "ALTER TABLE products ADD COLUMN auto_disable_when_out_of_stock TINYINT(1) NOT NULL DEFAULT 0",
  },
];

async function run() {
  console.log('=== Safe Migration Runner ===\n');

  for (const migration of migrations) {
    try {
      const exists = await p.$queryRawUnsafe(migration.check);
      if (exists.length > 0) {
        console.log(`[SKIP]  ${migration.name} — already applied`);
      } else {
        await p.$executeRawUnsafe(migration.run);
        console.log(`[OK]    ${migration.name} — applied`);
      }
    } catch (e) {
      console.error(`[ERROR] ${migration.name}: ${e.message}`);
    }
  }

  console.log('\nDone. No data was dropped.');
  await p.$disconnect();
}

run();
