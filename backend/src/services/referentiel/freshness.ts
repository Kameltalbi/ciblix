import { prisma } from '../../db/prisma.js';

const DAY = 24 * 3600_000;

/**
 * score_fraicheur = f(âge vérification, volatilité champ critique).
 * 100 = frais ; 0 = périmé.
 */
export function computeFreshnessScore(opts: {
  dateDerniereVerification: Date | null;
  statutActivite: string;
}): number {
  const verifiedAt = opts.dateDerniereVerification?.getTime() ?? 0;
  if (!verifiedAt) return 15;
  const ageDays = (Date.now() - verifiedAt) / DAY;

  // statut_activite : cible 90j ; adresse/web 180j
  const halfLife =
    opts.statutActivite === 'ACTIVE' || opts.statutActivite === 'INCONNUE' ? 90 : 60;
  const score = Math.round(100 * Math.exp(-ageDays / (halfLife * 1.5)));
  return Math.max(0, Math.min(100, score));
}

export async function refreshReferentielFreshnessScores(take = 500): Promise<number> {
  const rows = await prisma.entrepriseReferentiel.findMany({
    take,
    orderBy: { dateDerniereVerification: 'asc' },
    select: { id: true, dateDerniereVerification: true, statutActivite: true, scoreFraicheur: true },
  });
  let updated = 0;
  for (const r of rows) {
    const next = computeFreshnessScore({
      dateDerniereVerification: r.dateDerniereVerification,
      statutActivite: r.statutActivite,
    });
    if (Math.abs(next - (r.scoreFraicheur || 0)) >= 2) {
      await prisma.entrepriseReferentiel.update({
        where: { id: r.id },
        data: { scoreFraicheur: next },
      });
      updated++;
    }
  }
  return updated;
}

/** Affichage UI : ne pas présenter comme certain si fraîcheur basse. */
export function freshnessWarning(scoreFraicheur: number, dateDerniereVerification: Date | null): string | null {
  if (scoreFraicheur >= 55) return null;
  const months = dateDerniereVerification
    ? Math.round((Date.now() - dateDerniereVerification.getTime()) / (30 * DAY))
    : null;
  if (months != null && months > 0) {
    return `Information non vérifiée depuis ${months} mois`;
  }
  return 'Information à vérifier';
}
