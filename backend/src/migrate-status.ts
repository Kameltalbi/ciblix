import { PrismaClient } from './lib/prismaInterop.js';

const prisma = new PrismaClient();

async function migrateStatus() {
  console.log('Starting status migration...');

  // PROSPECTION → PROSPECT
  const prospection = await prisma.affaire.updateMany({
    where: { statut: 'PROSPECTION' as any },
    data: { statut: 'PROSPECT' as any },
  });
  console.log(`Migrated ${prospection.count} affaires from PROSPECTION to PROSPECT`);

  // PIPELINE → QUALIFIE (default middle stage)
  const pipeline = await prisma.affaire.updateMany({
    where: { statut: 'PIPELINE' as any },
    data: { statut: 'QUALIFIE' as any },
  });
  console.log(`Migrated ${pipeline.count} affaires from PIPELINE to QUALIFIE`);

  // REALISE → GAGNE
  const realise = await prisma.affaire.updateMany({
    where: { statut: 'REALISE' as any },
    data: { statut: 'GAGNE' as any },
  });
  console.log(`Migrated ${realise.count} affaires from REALISE to GAGNE`);

  // PERDU → PERDU (no change)
  console.log('Migration completed!');
}

migrateStatus()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
