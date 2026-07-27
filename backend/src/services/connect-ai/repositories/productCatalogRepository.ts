import { prisma } from '../../../db/prisma.js';
import type { CommercialProduct } from '../core/types.js';

const DEFAULT_PRODUCTS: CommercialProduct[] = [
  {
    slug: 'carboscan',
    name: 'CarboScan',
    description: 'Bilan carbone et conformité ESG',
    icp: 'Industrie, export, >50 salariés',
    arguments: ['Conformité CSRD', 'Réduction coûts énergétiques', 'Avantage export'],
    objections: ['Trop technique', 'ISO en place'],
    cta: 'Diagnostic gratuit 30 min',
  },
  {
    slug: 'softfacture',
    name: 'SoftFacture',
    description: 'Facturation et gestion PME',
    icp: 'PME, TPE, cabinets comptables',
    arguments: ['Gain de temps', 'Conformité fiscale', 'Interface simple'],
    objections: ['ERP existant', 'Faible volume'],
    cta: 'Démo 15 minutes',
  },
];

export async function ensureDefaultProducts(organizationId: string): Promise<void> {
  const globals = await prisma.connectCommercialProduct.findMany({
    where: { organizationId: null, active: true },
  });
  for (const g of globals) {
    await prisma.connectCommercialProduct.upsert({
      where: { organizationId_slug: { organizationId, slug: g.slug } },
      create: {
        organizationId,
        slug: g.slug,
        name: g.name,
        description: g.description,
        icp: g.icp,
        arguments: g.arguments,
        objections: g.objections,
        cta: g.cta,
        sortOrder: g.sortOrder,
      },
      update: {},
    });
  }
}

export async function listCommercialProducts(organizationId: string): Promise<CommercialProduct[]> {
  await ensureDefaultProducts(organizationId);
  const rows = await prisma.connectCommercialProduct.findMany({
    where: {
      active: true,
      OR: [{ organizationId }, { organizationId: null }],
    },
    orderBy: [{ organizationId: 'desc' }, { sortOrder: 'asc' }],
  });

  const seen = new Set<string>();
  const products: CommercialProduct[] = [];
  for (const r of rows) {
    if (seen.has(r.slug)) continue;
    seen.add(r.slug);
    products.push({
      slug: r.slug,
      name: r.name,
      description: r.description,
      icp: r.icp,
      arguments: r.arguments,
      objections: r.objections,
      cta: r.cta,
    });
  }
  return products.length ? products : DEFAULT_PRODUCTS;
}

export function formatProductsForPrompt(products: CommercialProduct[]): string {
  return products
    .map(
      (p) =>
        `- ${p.slug} (${p.name}): ${p.description}\n  ICP: ${p.icp}\n  Arguments: ${p.arguments.join('; ')}\n  Objections: ${p.objections.join('; ')}\n  CTA: ${p.cta}`
    )
    .join('\n');
}

export async function getProductBySlug(organizationId: string, slug: string): Promise<CommercialProduct | null> {
  const products = await listCommercialProducts(organizationId);
  return products.find((p) => p.slug === slug) ?? null;
}
