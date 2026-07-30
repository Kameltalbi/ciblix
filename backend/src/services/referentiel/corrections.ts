import type { Prisma, ReferentielCorrectionType } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

const MAX_REPORTS_PER_DAY = 20;

const CORRECTABLE_FIELDS = new Set([
  'adresseSiege',
  'secteur',
  'siteWeb',
  'zoneGeographique',
]);

/**
 * Signalement remontant — faits publics uniquement.
 * Appliqué seulement si 2 tenants concordent OU validation manuelle.
 */
export async function reportReferentielCorrection(opts: {
  organizationId: string;
  userId: string;
  entrepriseId: string;
  type: ReferentielCorrectionType;
  champ?: string | null;
  valeurApres?: string | null;
  motif?: string | null;
}) {
  const since = new Date(Date.now() - 24 * 3600_000);
  const countToday = await prisma.referentielCorrection.count({
    where: { organizationId: opts.organizationId, createdAt: { gte: since } },
  });
  if (countToday >= MAX_REPORTS_PER_DAY) {
    throw new Error('CORRECTION_RATE_LIMIT');
  }

  const ent = await prisma.entrepriseReferentiel.findUniqueOrThrow({
    where: { id: opts.entrepriseId },
  });

  const valeurAvant =
    opts.champ && opts.champ in ent
      ? String((ent as Record<string, unknown>)[opts.champ] ?? '')
      : null;

  const created = await prisma.referentielCorrection.create({
    data: {
      organizationId: opts.organizationId,
      entrepriseId: opts.entrepriseId,
      type: opts.type,
      champ: opts.champ || null,
      valeurAvant,
      valeurApres: opts.valeurApres || null,
      motif: opts.motif || null,
      reportedByUserId: opts.userId,
      statut: 'PENDING',
    },
  });

  // Double signalement (2 orgs différentes, même type+entreprise)
  const peers = await prisma.referentielCorrection.findMany({
    where: {
      entrepriseId: opts.entrepriseId,
      type: opts.type,
      statut: 'PENDING',
      id: { not: created.id },
    },
    select: { organizationId: true, id: true },
  });
  const otherOrg = peers.find((p) => p.organizationId !== opts.organizationId);
  if (otherOrg) {
    await applyCorrection(created.id, 'double_signalement');
  }

  return created;
}

export async function applyCorrection(correctionId: string, mode: string) {
  const c = await prisma.referentielCorrection.findUniqueOrThrow({ where: { id: correctionId } });
  if (c.statut !== 'PENDING') return c;

  const data: Prisma.EntrepriseReferentielUpdateInput = {
    dateDerniereVerification: new Date(),
  };
  if (c.type === 'ENTREPRISE_FERMEE') data.statutActivite = 'CESSEE';
  if (c.type === 'SITE_INVALIDE') {
    data.siteWeb = null;
    data.siteWebDomain = null;
  }
  if (c.champ && c.valeurApres != null && CORRECTABLE_FIELDS.has(c.champ)) {
    (data as Record<string, unknown>)[c.champ] = c.valeurApres;
  }

  await prisma.$transaction([
    prisma.entrepriseReferentiel.update({
      where: { id: c.entrepriseId },
      data,
    }),
    prisma.referentielCorrection.update({
      where: { id: c.id },
      data: {
        statut: 'CONFIRMED',
        validationMode: mode,
        confirmedAt: new Date(),
        confirmedBy: mode,
      },
    }),
    prisma.referentielCorrection.updateMany({
      where: {
        entrepriseId: c.entrepriseId,
        type: c.type,
        statut: 'PENDING',
        id: { not: c.id },
      },
      data: {
        statut: 'CONFIRMED',
        validationMode: mode,
        confirmedAt: new Date(),
      },
    }),
  ]);

  return prisma.referentielCorrection.findUnique({ where: { id: correctionId } });
}

/** Revert d’une correction confirmée (valeurAvant si connue). */
export async function revertCorrection(correctionId: string, by: string) {
  const c = await prisma.referentielCorrection.findUniqueOrThrow({ where: { id: correctionId } });
  if (c.statut !== 'CONFIRMED') return c;

  const data: Prisma.EntrepriseReferentielUpdateInput = {
    dateDerniereVerification: new Date(),
  };
  if (c.type === 'ENTREPRISE_FERMEE') data.statutActivite = 'ACTIVE';
  if (c.champ && c.valeurAvant != null && CORRECTABLE_FIELDS.has(c.champ)) {
    (data as Record<string, unknown>)[c.champ] = c.valeurAvant;
  }

  await prisma.$transaction([
    prisma.entrepriseReferentiel.update({ where: { id: c.entrepriseId }, data }),
    prisma.referentielCorrection.update({
      where: { id: c.id },
      data: { statut: 'REVERTED', confirmedBy: by },
    }),
  ]);

  return prisma.referentielCorrection.findUnique({ where: { id: correctionId } });
}
