-- Migration para criar a tabela delivery_drivers e os campos driver_id/driver_name em orders
-- Executar em produção com: mysql -u user -p database < this_file.sql
-- OU via Prisma: npx prisma db push (atualiza o schema direto)

CREATE TABLE `delivery_drivers` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NULL,
  `vehicle` VARCHAR(191) NULL,
  `plate` VARCHAR(191) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
);

ALTER TABLE `orders`
  ADD COLUMN `driver_id` VARCHAR(191) NULL,
  ADD COLUMN `driver_name` VARCHAR(191) NULL;
