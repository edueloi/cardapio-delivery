-- Migration para adicionar campo is_delivery_open na tabela tenants
-- Executar em produção com: mysql -u user -p database < this_file.sql
-- OU via Prisma: npx prisma db push (atualiza o schema direto)

ALTER TABLE `tenants`
  ADD COLUMN `is_delivery_open` BOOLEAN NOT NULL DEFAULT TRUE;
