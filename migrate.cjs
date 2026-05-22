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
    name: 'add_tenants_schedule_type',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'schedule_type'",
    run: "ALTER TABLE tenants ADD COLUMN schedule_type VARCHAR(191) NOT NULL DEFAULT 'CLIENT_CHOOSES'",
  },
  {
    name: 'add_tenants_schedule_days',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'schedule_days'",
    run: "ALTER TABLE tenants ADD COLUMN schedule_days TEXT NULL",
  },
  {
    name: 'add_tenants_schedule_notes',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'schedule_notes'",
    run: "ALTER TABLE tenants ADD COLUMN schedule_notes TEXT NULL",
  },
  {
    name: 'add_orders_scheduled_time',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'scheduled_time'",
    run: "ALTER TABLE orders ADD COLUMN scheduled_time VARCHAR(10) NULL",
  },
  {
    name: 'create_subscription_plans_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscription_plans'",
    run: `CREATE TABLE subscription_plans (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      name VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      description TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      price DOUBLE NOT NULL DEFAULT 0,
      duration_days INT NOT NULL DEFAULT 30,
      features TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      color VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '#C9A227',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  {
    name: 'create_subscriptions_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions'",
    run: `CREATE TABLE subscriptions (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      account_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      plan_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      status VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
      starts_at DATETIME(3) NOT NULL,
      expires_at DATETIME(3) NOT NULL,
      price_paid DOUBLE NOT NULL DEFAULT 0,
      notes TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      created_by_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX subscriptions_account_id_idx (account_id),
      INDEX subscriptions_plan_id_idx (plan_id),
      CONSTRAINT subscriptions_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
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
  {
    name: 'add_tenants_stone_config',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'stone_config'",
    run: "ALTER TABLE tenants ADD COLUMN stone_config TEXT NULL",
  },
  {
    name: 'add_orders_stone_charge_id',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'stone_charge_id'",
    run: "ALTER TABLE orders ADD COLUMN stone_charge_id VARCHAR(191) NULL",
  },
  {
    name: 'add_memberships_permissions',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenant_memberships' AND COLUMN_NAME = 'permissions'",
    run: "ALTER TABLE tenant_memberships ADD COLUMN permissions TEXT NULL",
  },
  {
    name: 'add_memberships_name',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenant_memberships' AND COLUMN_NAME = 'name'",
    run: "ALTER TABLE tenant_memberships ADD COLUMN name VARCHAR(191) NULL",
  },
  {
    name: 'add_subscription_plans_default_permissions',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'default_staff_permissions'",
    run: "ALTER TABLE subscription_plans ADD COLUMN default_staff_permissions TEXT NULL",
  },
  {
    name: 'create_production_recipes_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'production_recipes'",
    run: `CREATE TABLE production_recipes (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      tenant_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      product_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      name VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      description TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      output_quantity DOUBLE NOT NULL DEFAULT 1,
      output_unit VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'un',
      instructions TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      ingredients LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      overheads LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX production_recipes_tenant_id_idx (tenant_id),
      INDEX production_recipes_product_id_idx (product_id),
      CONSTRAINT production_recipes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT production_recipes_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  {
    name: 'create_production_runs_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'production_runs'",
    run: `CREATE TABLE production_runs (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      tenant_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      recipe_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      recipe_name VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      batch_code VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      quantity_produced DOUBLE NOT NULL DEFAULT 1,
      unit VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'un',
      notes TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      created_by_name VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      total_ingredient_cost DOUBLE NOT NULL DEFAULT 0,
      total_overhead_cost DOUBLE NOT NULL DEFAULT 0,
      total_cost DOUBLE NOT NULL DEFAULT 0,
      cost_per_output DOUBLE NOT NULL DEFAULT 0,
      ingredients_snapshot LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      overheads_snapshot LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      output_snapshot LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX production_runs_tenant_id_idx (tenant_id),
      INDEX production_runs_recipe_id_idx (recipe_id),
      CONSTRAINT production_runs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT production_runs_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES production_recipes(id) ON DELETE SET NULL ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  {
    name: 'add_tenants_order_mode',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'order_mode'",
    run: "ALTER TABLE tenants ADD COLUMN order_mode VARCHAR(50) NOT NULL DEFAULT 'DELIVERY_ONLY'",
  },
  {
    name: 'add_products_schedule_rule',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'schedule_rule'",
    run: "ALTER TABLE products ADD COLUMN schedule_rule TEXT NULL",
  },
  {
    name: 'add_wpp_bot_configs_preorder_message',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wpp_bot_configs' AND COLUMN_NAME = 'preorder_message'",
    run: "ALTER TABLE wpp_bot_configs ADD COLUMN preorder_message TEXT NULL",
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
