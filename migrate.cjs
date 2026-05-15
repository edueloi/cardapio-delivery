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
  {
    name: 'add_orders_discount',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'discount'",
    run: "ALTER TABLE orders ADD COLUMN discount DOUBLE NULL DEFAULT 0",
  },
  {
    name: 'add_orders_discount_type',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'discount_type'",
    run: "ALTER TABLE orders ADD COLUMN discount_type VARCHAR(191) NULL",
  },
  {
    name: 'add_orders_notes',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'notes'",
    run: "ALTER TABLE orders ADD COLUMN notes TEXT NULL",
  },
  {
    name: 'add_orders_operator_name',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'operator_name'",
    run: "ALTER TABLE orders ADD COLUMN operator_name VARCHAR(191) NULL",
  },
  {
    name: 'add_cash_registers_operator_name',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cash_registers' AND COLUMN_NAME = 'operator_name'",
    run: "ALTER TABLE cash_registers ADD COLUMN operator_name VARCHAR(191) NULL",
  },
  {
    name: 'add_orders_customer_id',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'customer_id'",
    run: "ALTER TABLE orders ADD COLUMN customer_id VARCHAR(191) NULL",
  },
  {
    name: 'add_orders_payment_detail',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'payment_detail'",
    run: "ALTER TABLE orders ADD COLUMN payment_detail TEXT NULL",
  },
  {
    name: 'create_promotions_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotions'",
    run: `CREATE TABLE promotions (
      id VARCHAR(191) NOT NULL,
      tenant_id VARCHAR(191) NOT NULL,
      title VARCHAR(191) NOT NULL,
      description TEXT NULL,
      image_url VARCHAR(191) NULL,
      link_product_id VARCHAR(191) NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      starts_at DATETIME(3) NULL,
      ends_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX promotions_tenant_id_idx (tenant_id),
      CONSTRAINT promotions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE
    )`,
  },
  {
    name: 'add_accounts_is_super_admin',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'is_super_admin'",
    run: "ALTER TABLE accounts ADD COLUMN is_super_admin TINYINT(1) NOT NULL DEFAULT 0",
  },
  {
    name: 'add_orders_scheduled_date',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'scheduled_date'",
    run: "ALTER TABLE orders ADD COLUMN scheduled_date DATE NULL",
  },
  {
    name: 'add_tenants_schedule_mode',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'schedule_mode'",
    run: "ALTER TABLE tenants ADD COLUMN schedule_mode TINYINT(1) NOT NULL DEFAULT 0",
  },
  {
    name: 'create_invite_tokens_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invite_tokens'",
    run: `CREATE TABLE invite_tokens (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      token VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
      created_by_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      used_at DATETIME(3) NULL,
      used_by_email VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      expires_at DATETIME(3) NOT NULL,
      note TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX invite_tokens_token_idx (token),
      INDEX invite_tokens_created_by_id_idx (created_by_id),
      CONSTRAINT invite_tokens_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES accounts(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
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
