-- Migration para adicionar campo counter_ticket_mode na tabela tenants
-- Executar em produção com: mysql -u user -p database < this_file.sql
-- OU via Prisma: npx prisma db push (atualiza o schema direto)

ALTER TABLE `tenants`
  ADD COLUMN `counter_ticket_mode` VARCHAR(191) NULL;
