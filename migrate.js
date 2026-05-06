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

    console.log('\n✅ Migrações concluídas com sucesso!');
  } catch (error) {
    console.error('\n❌ Erro durante a migração:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
