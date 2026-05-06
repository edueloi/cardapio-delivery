import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Iniciando migrações de segurança...');

  try {
    // 1. Verificar e adicionar coluna payment_methods na tabela tenants
    console.log('--- Verificando tabela tenants ---');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE tenants 
      ADD COLUMN IF NOT EXISTS payment_methods TEXT
    `).catch(err => {
      // Alguns bancos MySQL antigos não suportam ADD COLUMN IF NOT EXISTS
      if (err.message.includes('Duplicate column name')) {
        console.log('✅ Coluna payment_methods já existe.');
      } else {
        throw err;
      }
    });

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
    await prisma.$executeRawUnsafe(`
      ALTER TABLE features 
      ADD COLUMN IF NOT EXISTS isValidated INT DEFAULT 0
    `).catch(err => {
      if (err.message.includes('Duplicate column name')) {
        console.log('✅ Coluna isValidated já existe.');
      } else {
        console.log('⚠️ Aviso ao adicionar isValidated:', err.message);
      }
    });

    console.log('\n✅ Migrações concluídas com sucesso!');
  } catch (error) {
    console.error('\n❌ Erro durante a migração:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
