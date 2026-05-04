import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create a default tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'pastelaria-do-edu' },
    update: {},
    create: {
      name: 'Pastelaria do Edu',
      slug: 'pastelaria-do-edu',
      description: 'A melhor pastelaria da região!',
      whatsapp: '5511999999999',
    },
  });

  // Create categories
  const catPastel = await prisma.category.create({
    data: {
      name: 'Pastéis Salgados',
      tenantId: tenant.id,
    }
  });

  const catBebida = await prisma.category.create({
    data: {
      name: 'Bebidas',
      tenantId: tenant.id,
    }
  });

  // Create products
  await prisma.product.createMany({
    data: [
      {
        name: 'Pastel de Carne',
        description: 'Carne moída temperada, azeitona e ovo.',
        price: 12.00,
        categoryId: catPastel.id,
        tenantId: tenant.id,
        imageUrl: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?q=80&w=800&auto=format&fit=crop',
      },
      {
        name: 'Pastel de Queijo',
        description: 'Muito queijo mussarela.',
        price: 10.00,
        categoryId: catPastel.id,
        tenantId: tenant.id,
        imageUrl: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?q=80&w=800&auto=format&fit=crop',
      },
      {
        name: 'Coca-Cola 350ml',
        description: 'Geladinha.',
        price: 6.00,
        categoryId: catBebida.id,
        tenantId: tenant.id,
        imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=800&auto=format&fit=crop',
      }
    ]
  });

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
