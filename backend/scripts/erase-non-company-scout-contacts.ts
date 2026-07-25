/**
 * Soft-delete les Contacts créés via SCOUT dont le nom ressemble à un article / sujet
 * (pas une entreprise). Les opportunités Veilleur restent intactes.
 *
 * Usage (backend/) :
 *   npx tsx scripts/erase-non-company-scout-contacts.ts
 *   npx tsx scripts/erase-non-company-scout-contacts.ts --dry-run
 */
import { prisma } from '../src/db/prisma.js';
import { looksLikeCompanyName } from '../src/services/scout/companyNameGuard.js';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const rows = await prisma.contact.findMany({
    where: { createdVia: 'SCOUT', erasedAt: null },
    select: { id: true, organizationId: true, companyName: true, name: true },
  });

  const bad = rows.filter((r) => {
    const label = (r.companyName || r.name || '').trim();
    return !looksLikeCompanyName(label);
  });

  console.log(`SCOUT contacts actifs: ${rows.length}`);
  console.log(`À archiver (non-entreprise): ${bad.length}`);
  for (const r of bad) {
    console.log(`  - [${r.id}] ${r.companyName || r.name || '(sans nom)'}`);
  }

  if (dryRun || bad.length === 0) {
    if (dryRun) console.log('Dry-run — aucune écriture.');
    return;
  }

  const now = new Date();
  const ids = bad.map((r) => r.id);
  const result = await prisma.contact.updateMany({
    where: { id: { in: ids }, erasedAt: null },
    data: { erasedAt: now, pipelineStatus: 'ARCHIVE' },
  });
  console.log(`Archivés: ${result.count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
