/**
 * Este script ajuda na migração do SQLite para MySQL.
 * 
 * Instruções:
 * 1. Altere o 'provider' no prisma/schema.prisma de 'sqlite' para 'mysql'.
 * 2. Atualize a URL do banco no .env (DATABASE_URL="mysql://user:pass@host:port/db").
 * 3. Rode este script para gerar as migrações iniciais.
 */

import { execSync } from 'child_process';

console.log('🔄 Iniciando preparação para migração MySQL...');

try {
  console.log('1. Gerando novo Client...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  console.log('2. Tentando rodar migração inicial (ignore se o banco estiver vazio)...');
  // execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });

  console.log('\n✅ Pronto! Para finalizar a troca:');
  console.log('Edite prisma/schema.prisma:');
  console.log('datasource db {');
  console.log('  provider = "mysql"');
  console.log('  url      = env("DATABASE_URL")');
  console.log('}');
  
} catch (error) {
  console.error('❌ Erro durante a preparação:', error.message);
}
