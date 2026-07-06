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
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      tenant_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      title VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      description TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      image_url VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      link_product_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      starts_at DATETIME(3) NULL,
      ends_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX promotions_tenant_id_idx (tenant_id),
      INDEX promotions_link_product_id_idx (link_product_id),
      CONSTRAINT promotions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT promotions_link_product_id_fkey FOREIGN KEY (link_product_id) REFERENCES products(id) ON DELETE SET NULL ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
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
  // ── Conversão inteligente de unidades no estoque ──────────────────────────
  // purchase_unit: unidade de compra (ex: "un" para uma garrafa de 1L)
  // purchase_qty:  quanto conteúdo tem cada unidade de compra (ex: 1000 ml por garrafa)
  // stock_unit:    unidade granular do estoque (ex: "ml") — usada na produção
  {
    name: 'add_inventory_items_purchase_unit',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'purchase_unit'",
    run: "ALTER TABLE inventory_items ADD COLUMN purchase_unit VARCHAR(50) NULL",
  },
  {
    name: 'add_inventory_items_purchase_qty',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'purchase_qty'",
    run: "ALTER TABLE inventory_items ADD COLUMN purchase_qty DOUBLE NULL",
  },
  {
    name: 'add_inventory_items_stock_unit',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'stock_unit'",
    run: "ALTER TABLE inventory_items ADD COLUMN stock_unit VARCHAR(50) NULL",
  },
  // ── Combos / Product Bundles ──────────────────────────────────────────────
  {
    name: 'create_product_bundles_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_bundles'",
    run: `CREATE TABLE product_bundles (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      tenant_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      name VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      description TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      image_url VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      price DOUBLE NOT NULL DEFAULT 0,
      available TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      steps LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX product_bundles_tenant_id_idx (tenant_id),
      CONSTRAINT product_bundles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  {
    name: 'add_products_recipe_id',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'recipe_id'",
    run: "ALTER TABLE products ADD COLUMN recipe_id VARCHAR(191) NULL",
  },
  {
    name: 'add_products_recipe_id_fkey',
    check: "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND CONSTRAINT_NAME = 'products_recipe_id_fkey'",
    run: "ALTER TABLE products ADD CONSTRAINT products_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES production_recipes(id) ON DELETE SET NULL ON UPDATE CASCADE",
  },

  // ── Módulo Fiscal NFC-e ───────────────────────────────────────────────────
  // fiscal_config: JSON com CNPJ, IE, CSC, certificado A1, série, ambiente, etc.
  {
    name: 'add_tenants_fiscal_config',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'fiscal_config'",
    run: "ALTER TABLE tenants ADD COLUMN fiscal_config LONGTEXT NULL",
  },
  // NCM — Nomenclatura Comum do Mercosul (8 dígitos)
  {
    name: 'add_products_ncm',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'ncm'",
    run: "ALTER TABLE products ADD COLUMN ncm VARCHAR(20) NULL",
  },
  // CFOP — Código Fiscal de Operações e Prestações
  {
    name: 'add_products_cfop',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'cfop'",
    run: "ALTER TABLE products ADD COLUMN cfop VARCHAR(10) NULL",
  },
  // CSOSN — Código de Situação de Operação no Simples Nacional
  {
    name: 'add_products_csosn',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'csosn'",
    run: "ALTER TABLE products ADD COLUMN csosn VARCHAR(10) NULL",
  },
  // unidade comercial: UN, KG, L, CX, etc.
  {
    name: 'add_products_unit_com',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'unit_com'",
    run: "ALTER TABLE products ADD COLUMN unit_com VARCHAR(20) NULL DEFAULT 'UN'",
  },
  // origem: 0=Nacional, 1=Estrangeira importação direta, etc.
  {
    name: 'add_products_origem',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'origem'",
    run: "ALTER TABLE products ADD COLUMN origem TINYINT NOT NULL DEFAULT 0",
  },
  // alíquota ICMS (percentual, ex: 12.00)
  {
    name: 'add_products_aliq_icms',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'aliq_icms'",
    run: "ALTER TABLE products ADD COLUMN aliq_icms DOUBLE NULL DEFAULT 0",
  },
  // chave de acesso da NFC-e autorizada (44 dígitos)
  {
    name: 'add_orders_nfce_key',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'nfce_key'",
    run: "ALTER TABLE orders ADD COLUMN nfce_key VARCHAR(50) NULL",
  },
  // status da NFC-e: null=não emitida, PENDING, AUTHORIZED, REJECTED, CANCELLED
  {
    name: 'add_orders_nfce_status',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'nfce_status'",
    run: "ALTER TABLE orders ADD COLUMN nfce_status VARCHAR(20) NULL",
  },
  // protocolo de autorização retornado pela SEFAZ
  {
    name: 'add_orders_nfce_protocol',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'nfce_protocol'",
    run: "ALTER TABLE orders ADD COLUMN nfce_protocol VARCHAR(50) NULL",
  },
  // XML autorizado e DANFE (base64 ou URL) armazenados como JSON
  {
    name: 'add_orders_nfce_xml',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'nfce_xml'",
    run: "ALTER TABLE orders ADD COLUMN nfce_xml LONGTEXT NULL",
  },
  // número da NFC-e emitida (controle sequencial por série)
  {
    name: 'add_orders_nfce_number',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'nfce_number'",
    run: "ALTER TABLE orders ADD COLUMN nfce_number INT NULL",
  },
  // tabela de fornecedores
  {
    name: 'create_suppliers_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'suppliers'",
    run: `CREATE TABLE suppliers (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      tenant_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      name VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      cpf_cnpj VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      type VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OUTROS',
      phone VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      email VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      cep VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      street VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      number VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      complement VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      neighborhood VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      city VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      state VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      country VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'Brasil',
      notes TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      is_favorite TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX suppliers_tenant_id_idx (tenant_id),
      CONSTRAINT suppliers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  // ── WhatsApp: qr_code muito curto para o dado real ───────────────────────────
  {
    name: 'alter_wpp_instances_qr_code_to_longtext',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wpp_instances' AND COLUMN_NAME = 'qr_code' AND DATA_TYPE = 'longtext'",
    run: "ALTER TABLE wpp_instances MODIFY COLUMN qr_code LONGTEXT NULL",
  },
  // ── Caixa: movimentos financeiros ────────────────────────────────────────────
  {
    name: 'create_cash_movements_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cash_movements'",
    run: `CREATE TABLE cash_movements (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      cash_register_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      tenant_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      type VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      amount DOUBLE NOT NULL,
      description TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      order_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      operator_name VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX cash_movements_cash_register_id_idx (cash_register_id),
      INDEX cash_movements_tenant_id_idx (tenant_id),
      CONSTRAINT cash_movements_cash_register_id_fkey FOREIGN KEY (cash_register_id) REFERENCES cash_registers(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  // ── CRM: clientes ─────────────────────────────────────────────────────────
  {
    name: 'create_customers_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers'",
    run: `CREATE TABLE customers (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      tenant_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      name VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      phone VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      email VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      address TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      notes TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      loyalty_points INT NOT NULL DEFAULT 0,
      total_spent DOUBLE NOT NULL DEFAULT 0,
      orders_count INT NOT NULL DEFAULT 0,
      last_order_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE INDEX customers_tenant_id_phone_unique (tenant_id, phone),
      INDEX customers_tenant_id_idx (tenant_id),
      CONSTRAINT customers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  // tabela de tokens de redefinição de senha
  {
    name: 'create_password_reset_tokens_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'password_reset_tokens'",
    run: `CREATE TABLE password_reset_tokens (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      account_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      token VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
      expires_at DATETIME(3) NOT NULL,
      used_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX password_reset_tokens_account_id_idx (account_id),
      CONSTRAINT password_reset_tokens_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  // tabela de catálogo de produtos do fornecedor
  {
    name: 'create_supplier_catalog_items_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplier_catalog_items'",
    run: `CREATE TABLE supplier_catalog_items (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      supplier_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      name VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      unit VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      price DOUBLE NULL,
      notes TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX supplier_catalog_items_supplier_id_idx (supplier_id),
      CONSTRAINT supplier_catalog_items_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  // tabela de vínculo fornecedor <-> insumo de estoque
  {
    name: 'create_supplier_inventory_items_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplier_inventory_items'",
    run: `CREATE TABLE supplier_inventory_items (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      supplier_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      inventory_item_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      PRIMARY KEY (id),
      UNIQUE INDEX supplier_inventory_items_unique (supplier_id, inventory_item_id),
      INDEX supplier_inventory_items_supplier_id_idx (supplier_id),
      INDEX supplier_inventory_items_inventory_item_id_idx (inventory_item_id),
      CONSTRAINT supplier_inventory_items_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT supplier_inventory_items_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  // ── Módulo Condomínios ────────────────────────────────────────────────────────
  {
    name: 'create_condominiums_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'condominiums'",
    run: `CREATE TABLE condominiums (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      name VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      slug VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      description TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      logo_url VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      banner_url VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      primary_color VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '#C9A227',
      address TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE INDEX condominiums_slug_unique (slug)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  {
    name: 'add_condominiums_logo_banner_cols',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'condominiums' AND COLUMN_NAME = 'logo_url'",
    run: `ALTER TABLE condominiums ADD COLUMN logo_url VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL, ADD COLUMN banner_url VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL`,
  },
  {
    name: 'add_condominium_tenants_local_cols',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'condominium_tenants' AND COLUMN_NAME = 'local_address'",
    run: `ALTER TABLE condominium_tenants ADD COLUMN local_address TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL, ADD COLUMN local_hours TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL`,
  },
  // CPF do consumidor na nota — usado para Nota Fiscal Paulista (crédito ao cliente)
  {
    name: 'add_orders_customer_cpf',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'customer_cpf'",
    run: "ALTER TABLE orders ADD COLUMN customer_cpf VARCHAR(20) NULL",
  },
  // Taxa de maquininha — custo da adquirente e se foi repassado ao cliente
  {
    name: 'add_orders_fee_amount',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'fee_amount'",
    run: "ALTER TABLE orders ADD COLUMN fee_amount DOUBLE NULL",
  },
  {
    name: 'add_orders_fee_percent',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'fee_percent'",
    run: "ALTER TABLE orders ADD COLUMN fee_percent DOUBLE NULL",
  },
  {
    name: 'add_orders_fee_passed_to_customer',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'fee_passed_to_customer'",
    run: "ALTER TABLE orders ADD COLUMN fee_passed_to_customer TINYINT(1) NOT NULL DEFAULT 0",
  },
  {
    name: 'create_condominium_tenants_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'condominium_tenants'",
    run: `CREATE TABLE condominium_tenants (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      condominium_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      tenant_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE INDEX condominium_tenants_unique (condominium_id, tenant_id),
      INDEX condominium_tenants_cond_idx (condominium_id),
      INDEX condominium_tenants_tenant_idx (tenant_id),
      CONSTRAINT condominium_tenants_cond_fkey FOREIGN KEY (condominium_id) REFERENCES condominiums(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT condominium_tenants_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  // Mesas cadastradas pelo estabelecimento — usadas pelo PDV/garçom para abrir mesa nova
  {
    name: 'create_restaurant_tables_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'restaurant_tables'",
    run: `CREATE TABLE restaurant_tables (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      tenant_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      label VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE INDEX restaurant_tables_unique (tenant_id, label),
      INDEX restaurant_tables_tenant_id_idx (tenant_id),
      CONSTRAINT restaurant_tables_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  // Marca se o produto deve aparecer no painel de cozinha (false = bebida/embalagem, não precisa preparo)
  {
    name: 'add_products_kitchen_print',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'kitchen_print'",
    run: "ALTER TABLE products ADD COLUMN kitchen_print TINYINT(1) NOT NULL DEFAULT 1",
  },
  // Produtos novos passam a não ir para a cozinha por padrão — o dono ativa manualmente
  // só o que precisa de preparo. Não afeta produtos já cadastrados (mantém o valor atual).
  {
    name: 'change_products_kitchen_print_default_to_false',
    check: "SELECT COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'kitchen_print' AND COLUMN_DEFAULT = '0'",
    run: "ALTER TABLE products MODIFY COLUMN kitchen_print TINYINT(1) NOT NULL DEFAULT 0",
  },
  // Ordenação manual (drag-and-drop) de categorias e produtos no cardápio
  {
    name: 'add_categories_sort_order',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'sort_order'",
    run: "ALTER TABLE categories ADD COLUMN sort_order INT NOT NULL DEFAULT 0",
  },
  {
    name: 'add_products_sort_order',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'sort_order'",
    run: "ALTER TABLE products ADD COLUMN sort_order INT NOT NULL DEFAULT 0",
  },
  // Configuração do módulo de Fidelidade (pontos por real, mínimo pra resgate, etc)
  {
    name: 'add_tenants_loyalty_config',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'loyalty_config'",
    run: "ALTER TABLE tenants ADD COLUMN loyalty_config TEXT NULL",
  },
  // Múltiplos endereços por cliente — usado no cardápio digital (busca por telefone)
  {
    name: 'create_customer_addresses_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_addresses'",
    run: `CREATE TABLE customer_addresses (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      customer_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      label VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      cep VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      street VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      number VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      complement VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      neighborhood VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      city VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      state VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX customer_addresses_customer_id_idx (customer_id),
      CONSTRAINT customer_addresses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  // Integração iFood — configuração da loja (client_id/secret, merchant_id, status) fica em tenants.ifood_config
  {
    name: 'add_tenants_ifood_config',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'ifood_config'",
    run: "ALTER TABLE tenants ADD COLUMN ifood_config TEXT NULL",
  },
  // Origem do pedido (DIRECT, IFOOD, ...) e id do pedido no sistema de origem
  {
    name: 'add_orders_source',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'source'",
    run: "ALTER TABLE orders ADD COLUMN source VARCHAR(191) NOT NULL DEFAULT 'DIRECT'",
  },
  {
    name: 'add_orders_external_order_id',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'external_order_id'",
    run: "ALTER TABLE orders ADD COLUMN external_order_id VARCHAR(191) NULL",
  },
  {
    name: 'add_orders_source_external_idx',
    check: "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'orders_tenantId_source_externalOrderId_idx'",
    run: "ALTER TABLE orders ADD INDEX orders_tenantId_source_externalOrderId_idx (tenant_id, source, external_order_id)",
  },
  // Vínculo de categoria/produto com o catálogo do iFood (sincronização)
  {
    name: 'add_categories_ifood_category_id',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'ifood_category_id'",
    run: "ALTER TABLE categories ADD COLUMN ifood_category_id VARCHAR(191) NULL",
  },
  {
    name: 'add_products_ifood_item_id',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'ifood_item_id'",
    run: "ALTER TABLE products ADD COLUMN ifood_item_id VARCHAR(191) NULL",
  },
  {
    name: 'add_products_ifood_synced_at',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'ifood_synced_at'",
    run: "ALTER TABLE products ADD COLUMN ifood_synced_at DATETIME(3) NULL",
  },
  // Financeiro — Entradas e Saídas (módulo já existente no frontend, sem backend até agora)
  {
    name: 'create_financial_entries_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'financial_entries'",
    run: `CREATE TABLE financial_entries (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      tenant_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      type VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      category VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      description VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      amount DOUBLE NOT NULL,
      date DATE NOT NULL,
      notes TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      source VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MANUAL',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX financial_entries_tenant_id_date_idx (tenant_id, date),
      CONSTRAINT financial_entries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  // Taxa de serviço opcional (ex: 10% em mesas) — configurável em Configurações, sempre desmarcável no PDV
  {
    name: 'add_orders_service_fee_amount',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'service_fee_amount'",
    run: "ALTER TABLE orders ADD COLUMN service_fee_amount DOUBLE NULL",
  },
  {
    name: 'add_orders_service_fee_percent',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'service_fee_percent'",
    run: "ALTER TABLE orders ADD COLUMN service_fee_percent DOUBLE NULL",
  },
  // Controla quais tipos de pedido (delivery/retirada/mesa) aparecem no Painel TV público
  {
    name: 'add_tenants_display_panel_config',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'display_panel_config'",
    run: "ALTER TABLE tenants ADD COLUMN display_panel_config TEXT NULL",
  },
  // Login próprio do Painel de Cozinha — senha simples por loja, sem conta de usuário
  {
    name: 'add_tenants_kitchen_password_hash',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'kitchen_password_hash'",
    run: "ALTER TABLE tenants ADD COLUMN kitchen_password_hash VARCHAR(255) NULL",
  },
  {
    name: 'create_kitchen_sessions_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kitchen_sessions'",
    run: `CREATE TABLE kitchen_sessions (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      tenant_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      token VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      expires_at DATETIME(3) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE INDEX kitchen_sessions_token_key (token),
      INDEX kitchen_sessions_tenant_id_idx (tenant_id),
      CONSTRAINT kitchen_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  // Configuração global do sistema (chave/valor) — usada pelas credenciais de desenvolvedor
  // da integração iFood (client_id/secret da aplicação BoxSys), editável só por Super Admin.
  {
    name: 'create_system_config_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_config'",
    run: `CREATE TABLE system_config (
      \`key\` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      value TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`key\`)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  // ── Convite de equipe por e-mail (dono convida garçom/staff sem exigir cadastro prévio) ──
  {
    name: 'add_invite_tokens_tenant_id',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invite_tokens' AND COLUMN_NAME = 'tenant_id'",
    run: "ALTER TABLE invite_tokens ADD COLUMN tenant_id VARCHAR(191) NULL",
  },
  {
    name: 'add_invite_tokens_tenant_id_fkey',
    check: "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invite_tokens' AND CONSTRAINT_NAME = 'invite_tokens_tenant_id_fkey'",
    run: "ALTER TABLE invite_tokens ADD CONSTRAINT invite_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE",
  },
  {
    name: 'add_invite_tokens_role',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invite_tokens' AND COLUMN_NAME = 'role'",
    run: "ALTER TABLE invite_tokens ADD COLUMN role VARCHAR(191) NULL",
  },
  {
    name: 'add_invite_tokens_permissions',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invite_tokens' AND COLUMN_NAME = 'permissions'",
    run: "ALTER TABLE invite_tokens ADD COLUMN permissions TEXT NULL",
  },
  {
    name: 'add_invite_tokens_member_name',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invite_tokens' AND COLUMN_NAME = 'member_name'",
    run: "ALTER TABLE invite_tokens ADD COLUMN member_name VARCHAR(191) NULL",
  },
  {
    name: 'add_invite_tokens_target_email',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invite_tokens' AND COLUMN_NAME = 'target_email'",
    run: "ALTER TABLE invite_tokens ADD COLUMN target_email VARCHAR(191) NULL",
  },
  // Imagem por variação de produto (ex: foto específica do tamanho "Grande")
  {
    name: 'add_product_variants_image_url',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_variants' AND COLUMN_NAME = 'image_url'",
    run: "ALTER TABLE product_variants ADD COLUMN image_url VARCHAR(191) NULL",
  },
  // Suporte a variante de produto no PDV/Garçom (product_variant_id no item do pedido)
  {
    name: 'add_order_items_product_variant_id',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items' AND COLUMN_NAME = 'product_variant_id'",
    run: "ALTER TABLE order_items ADD COLUMN product_variant_id VARCHAR(191) NULL",
  },
  // Aviso ao garçom quando a cozinha marca a comanda como pronta pra servir
  {
    name: 'add_tenants_waiter_notify_on_ready',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'waiter_notify_on_ready'",
    run: "ALTER TABLE tenants ADD COLUMN waiter_notify_on_ready TINYINT(1) NOT NULL DEFAULT 1",
  },
  // Data de aniversário do cliente — opcional, usada em promoções e cadastro rápido no balcão
  {
    name: 'add_customers_birthday',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'birthday'",
    run: "ALTER TABLE customers ADD COLUMN birthday DATE NULL",
  },
  // Senha sequencial diária para pedidos de balcão (sem mesa)
  {
    name: 'add_orders_counter_ticket_number',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'counter_ticket_number'",
    run: "ALTER TABLE orders ADD COLUMN counter_ticket_number INT NULL",
  },
  // ── Recorrências financeiras (água/luz, aluguel, sistema...) com parcelas e juros por atraso ──
  {
    name: 'create_recurring_entries_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recurring_entries'",
    run: `CREATE TABLE recurring_entries (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      tenant_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      type VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      category VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      description VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      frequency VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'FIXED',
      amount DOUBLE NULL,
      due_day INT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NULL,
      installments_total INT NULL,
      late_fee_enabled TINYINT(1) NOT NULL DEFAULT 0,
      late_fee_rate DOUBLE NULL,
      late_fee_interval VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      notes TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      last_generated_for VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX recurring_entries_tenant_id_active_idx (tenant_id, active),
      CONSTRAINT recurring_entries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  {
    name: 'add_financial_entries_recurring_entry_id',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'financial_entries' AND COLUMN_NAME = 'recurring_entry_id'",
    run: "ALTER TABLE financial_entries ADD COLUMN recurring_entry_id VARCHAR(191) NULL",
  },
  {
    name: 'add_financial_entries_recurring_entry_id_fkey',
    check: "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'financial_entries' AND CONSTRAINT_NAME = 'financial_entries_recurring_entry_id_fkey'",
    run: "ALTER TABLE financial_entries ADD CONSTRAINT financial_entries_recurring_entry_id_fkey FOREIGN KEY (recurring_entry_id) REFERENCES recurring_entries(id) ON DELETE SET NULL ON UPDATE CASCADE",
  },
  {
    name: 'add_financial_entries_recurring_entry_id_idx',
    check: "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'financial_entries' AND INDEX_NAME = 'financial_entries_recurring_entry_id_idx'",
    run: "ALTER TABLE financial_entries ADD INDEX financial_entries_recurring_entry_id_idx (recurring_entry_id)",
  },
  {
    name: 'add_financial_entries_due_date',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'financial_entries' AND COLUMN_NAME = 'due_date'",
    run: "ALTER TABLE financial_entries ADD COLUMN due_date DATE NULL",
  },
  {
    name: 'add_financial_entries_paid_at',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'financial_entries' AND COLUMN_NAME = 'paid_at'",
    run: "ALTER TABLE financial_entries ADD COLUMN paid_at DATETIME(3) NULL",
  },
  {
    name: 'add_financial_entries_status',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'financial_entries' AND COLUMN_NAME = 'status'",
    run: "ALTER TABLE financial_entries ADD COLUMN status VARCHAR(191) NOT NULL DEFAULT 'PAID'",
  },
  {
    name: 'add_financial_entries_installment_number',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'financial_entries' AND COLUMN_NAME = 'installment_number'",
    run: "ALTER TABLE financial_entries ADD COLUMN installment_number INT NULL",
  },
  {
    name: 'add_financial_entries_installments_total',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'financial_entries' AND COLUMN_NAME = 'installments_total'",
    run: "ALTER TABLE financial_entries ADD COLUMN installments_total INT NULL",
  },
  {
    name: 'add_financial_entries_base_amount',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'financial_entries' AND COLUMN_NAME = 'base_amount'",
    run: "ALTER TABLE financial_entries ADD COLUMN base_amount DOUBLE NULL",
  },
  {
    name: 'add_financial_entries_late_fee_applied',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'financial_entries' AND COLUMN_NAME = 'late_fee_applied'",
    run: "ALTER TABLE financial_entries ADD COLUMN late_fee_applied DOUBLE NULL",
  },
  // ── Central do bot WhatsApp: toggles dedicados (fidelidade, estoque baixo) + histórico ──
  {
    name: 'add_wpp_bot_configs_send_loyalty_points',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wpp_bot_configs' AND COLUMN_NAME = 'send_loyalty_points'",
    run: "ALTER TABLE wpp_bot_configs ADD COLUMN send_loyalty_points TINYINT(1) NOT NULL DEFAULT 1",
  },
  {
    name: 'add_wpp_bot_configs_send_low_stock_alert',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wpp_bot_configs' AND COLUMN_NAME = 'send_low_stock_alert'",
    run: "ALTER TABLE wpp_bot_configs ADD COLUMN send_low_stock_alert TINYINT(1) NOT NULL DEFAULT 0",
  },
  {
    name: 'create_wpp_message_logs_table',
    check: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wpp_message_logs'",
    run: `CREATE TABLE wpp_message_logs (
      id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      tenant_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      to_phone VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      kind VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      preview TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      sent_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX wpp_message_logs_tenant_id_sent_at_idx (tenant_id, sent_at),
      CONSTRAINT wpp_message_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  // Número dedicado para alertas internos do bot (novo pedido, estoque baixo) — separado
  // do WhatsApp público exibido no cardápio. Se vazio, cai no tenant.whatsapp (fallback).
  {
    name: 'add_wpp_bot_configs_owner_alert_phone',
    check: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wpp_bot_configs' AND COLUMN_NAME = 'owner_alert_phone'",
    run: "ALTER TABLE wpp_bot_configs ADD COLUMN owner_alert_phone VARCHAR(191) NULL",
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
