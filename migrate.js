import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function columnExists(table, column) {
  const result = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as count 
    FROM information_schema.columns 
    WHERE table_name = '${table}' AND column_name = '${column}'
  `);
  // Em algumas versões do MySQL o count vem como BigInt ou Number
  return Number(result[0].count) > 0;
}

async function main() {
  console.log('🔄 Iniciando migrações de segurança (Compatibilidade Máxima)...');

  try {
    // 1. Verificar e adicionar coluna payment_methods na tabela tenants
    console.log('--- Verificando tabela tenants ---');
    if (!(await columnExists('tenants', 'payment_methods'))) {
      console.log('➕ Adicionando coluna payment_methods...');
      await prisma.$executeRawUnsafe('ALTER TABLE tenants ADD COLUMN payment_methods TEXT');
    } else {
      console.log('✅ Coluna payment_methods já existe.');
    }

    // 2. Garantir que a tabela features exista
    console.log('--- Verificando tabela features ---');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS features (
        id VARCHAR(191) PRIMARY KEY,
        \`key\` VARCHAR(191),
        title VARCHAR(191) NOT NULL,
        description TEXT NOT NULL,
        priority VARCHAR(191),
        category VARCHAR(191),
        assignedTo VARCHAR(191),
        type VARCHAR(191) NOT NULL,
        tags JSON,
        points INT DEFAULT 0,
        deadline DATETIME(3),
        activities TEXT,
        isValidated INT DEFAULT 0,
        validatedBy VARCHAR(191),
        created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)
      )
    `);

    // 3. Verificar coluna isValidated na tabela features
    if (!(await columnExists('features', 'isValidated'))) {
      console.log('➕ Adicionando coluna isValidated...');
      await prisma.$executeRawUnsafe('ALTER TABLE features ADD COLUMN isValidated INT DEFAULT 0');
    } else {
      console.log('✅ Coluna isValidated já existe.');
    }

    // 4. Tabela cash_movements
    console.log('--- Verificando tabela cash_movements ---');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS cash_movements (
        id VARCHAR(191) PRIMARY KEY,
        cash_register_id VARCHAR(191) NOT NULL,
        tenant_id VARCHAR(191) NOT NULL,
        type VARCHAR(50) NOT NULL,
        amount DOUBLE NOT NULL,
        description TEXT,
        order_id VARCHAR(191),
        operator_name VARCHAR(191),
        created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
        CONSTRAINT fk_cm_cash FOREIGN KEY (cash_register_id) REFERENCES cash_registers(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Tabela cash_movements OK.');

    // 5. Coluna operator_name em cash_registers
    if (!(await columnExists('cash_registers', 'operator_name'))) {
      console.log('➕ Adicionando operator_name em cash_registers...');
      await prisma.$executeRawUnsafe('ALTER TABLE cash_registers ADD COLUMN operator_name VARCHAR(191)');
    } else {
      console.log('✅ Coluna operator_name em cash_registers já existe.');
    }

    // 6. Tabela customers (CRM)
    console.log('--- Verificando tabela customers ---');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(191) PRIMARY KEY,
        tenant_id VARCHAR(191) NOT NULL,
        name VARCHAR(191) NOT NULL,
        phone VARCHAR(191) NOT NULL,
        email VARCHAR(191),
        address TEXT,
        notes TEXT,
        loyalty_points INT DEFAULT 0,
        total_spent DOUBLE DEFAULT 0,
        orders_count INT DEFAULT 0,
        last_order_at DATETIME(3),
        created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_customer_tenant_phone (tenant_id, phone)
      )
    `);
    console.log('✅ Tabela customers OK.');

    // 7. Novas colunas na tabela orders
    console.log('--- Verificando novas colunas em orders ---');
    const orderCols = [
      ['discount',      'ALTER TABLE orders ADD COLUMN discount DOUBLE DEFAULT 0'],
      ['discount_type', 'ALTER TABLE orders ADD COLUMN discount_type VARCHAR(20)'],
      ['notes',         'ALTER TABLE orders ADD COLUMN notes TEXT'],
      ['operator_name', 'ALTER TABLE orders ADD COLUMN operator_name VARCHAR(191)'],
      ['customer_id',   'ALTER TABLE orders ADD COLUMN customer_id VARCHAR(191)'],
    ];
    for (const [col, sql] of orderCols) {
      if (!(await columnExists('orders', col))) {
        console.log(`➕ Adicionando coluna ${col} em orders...`);
        await prisma.$executeRawUnsafe(sql);
      } else {
        console.log(`✅ Coluna ${col} em orders já existe.`);
      }
    }

    // 8. Coluna pdv_only em products
    console.log('--- Verificando coluna pdv_only em products ---');
    if (!(await columnExists('products', 'pdv_only'))) {
      console.log('➕ Adicionando coluna pdv_only em products...');
      await prisma.$executeRawUnsafe('ALTER TABLE products ADD COLUMN pdv_only TINYINT(1) DEFAULT 0');
    } else {
      console.log('✅ Coluna pdv_only em products já existe.');
    }

    console.log('\n✅ Migrações concluídas com sucesso!');
  } catch (error) {
    console.error('\n❌ Erro durante a migração:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
