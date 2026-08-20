-- Migration para adicionar campo consumption_type na tabela orders
-- (comer no local / para viagem — só usado em pedidos de Balcão)
-- Executar em produção com: mysql -u user -p database < this_file.sql
-- OU via Prisma: npx prisma db push (atualiza o schema direto)

ALTER TABLE `orders`
  ADD COLUMN `consumption_type` VARCHAR(191) NULL;
