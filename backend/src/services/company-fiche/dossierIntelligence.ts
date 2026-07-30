import type { FicheTransition } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { parseFicheData } from './ficheService.js';
import type { FicheEntrepriseData } from './types.js';

export type DossierMissingItem = {
  id: string;
  label: string;
  categorie: 'decideur' | 'coordonnees' | 'presence' | 'offre' | 'preuve';
};

export type DossierUpdateItem = {
  id: string;
  at: string;
  agent: string | null;
  label: string;
  kind: 'change' | 'noop';
};

export type DossierIntelligence = {
  scores: {
    completude: number;
    fiabilite: number;
    fraicheur: number;
    sources: number;
    confianceIa: number;
  };
  derniereAnalyse: string | null;
  infosManquantes: DossierMissingItem[];
  updatesToday: DossierUpdateItem[];
  todaySummary: {
    date: string;
    hasChanges: boolean;
    message: string;
  };
};

const MISSING_CHECKS: Array<{
  id: string;
  label: string;
  categorie: DossierMissingItem['categorie'];
  ok: (data: FicheEntrepriseData, ctx: PresenceCtx) => boolean;
}> = [
  {
    id: 'dg',
    label: 'Directeur général / dirigeant inconnu',
    categorie: 'decideur',
    ok: (d) => Boolean(d.decideur?.nom?.trim()),
  },
  {
    id: 'fonction',
    label: 'Fonction du décideur introuvable',
    categorie: 'decideur',
    ok: (d) => Boolean(d.decideur?.fonction?.trim()),
  },
  {
    id: 'email',
    label: 'Email public introuvable',
    categorie: 'coordonnees',
    ok: (_d, ctx) => Boolean(ctx.email),
  },
  {
    id: 'telephone',
    label: 'Téléphone introuvable',
    categorie: 'coordonnees',
    ok: (_d, ctx) => Boolean(ctx.phone),
  },
  {
    id: 'site',
    label: 'Site web absent',
    categorie: 'presence',
    ok: (_d, ctx) => Boolean(ctx.siteWeb),
  },
  {
    id: 'linkedin',
    label: 'LinkedIn absent',
    categorie: 'presence',
    ok: (d) => d.decideur?.canal_prefere === 'linkedin' || /linkedin/i.test(d.decideur?.source || ''),
  },
  {
    id: 'secteur',
    label: 'Secteur d’activité inconnu',
    categorie: 'offre',
    ok: (d, ctx) => Boolean(d.secteur_declare?.trim() || ctx.secteur),
  },
  {
    id: 'besoin',
    label: 'Besoin potentiel non détecté',
    categorie: 'offre',
    ok: (d) => Boolean(d.besoin_detecte?.trim()),
  },
  {
    id: 'catalogue',
    label: 'Catalogue / offre non trouvé',
    categorie: 'offre',
    ok: (d) =>
      Boolean(
        d.signaux_externes?.some((s) => /catalogue|produit|offre|service/i.test(s.titre || ''))
      ),
  },
  {
    id: 'certifications',
    label: 'Certifications inconnues',
    categorie: 'preuve',
    ok: (d) =>
      Boolean(d.signaux_externes?.some((s) => /certif|iso|label|agrément/i.test(s.titre || ''))),
  },
];

type PresenceCtx = {
  email?: string | null;
  phone?: string | null;
  siteWeb?: string | null;
  secteur?: string | null;
  sourcesCount: number;
  scoreFraicheur: number | null;
  scoreConfiance: number | null;
  dateDerniereVerification: Date | string | null;
};

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function humanizeTransition(row: FicheTransition): DossierUpdateItem {
  const champs = Array.isArray(row.champsEcrits) ? row.champsEcrits : [];
  const raison = (row.raison || '').trim();
  const agent = row.agentEmetteur || null;

  if (!champs.length && /aucune|noop|sans.?modif|inchangé/i.test(raison)) {
    return {
      id: row.id,
      at: row.createdAt.toISOString(),
      agent,
      label: raison || 'Analyse terminée — aucune modification détectée',
      kind: 'noop',
    };
  }

  const fieldLabels: Record<string, string> = {
    decideur: 'Décideur mis à jour',
    besoin_detecte: 'Besoin potentiel affiné',
    score_fit: 'Score commercial recalculé',
    signaux_externes: 'Nouveau signal externe',
    historique_interactions: 'Interaction historisée',
    message_brouillon: 'Message proposé',
    prochaine_action: 'Prochaine action mise à jour',
    identite_entreprise: 'Identité enrichie',
    secteur_declare: 'Secteur mis à jour',
    zone_geographique: 'Zone géographique mise à jour',
  };

  const parts = champs
    .map((c) => fieldLabels[String(c)] || `Champ « ${c} » enrichi`)
    .slice(0, 3);

  return {
    id: row.id,
    at: row.createdAt.toISOString(),
    agent,
    label: raison || parts.join(' · ') || 'Dossier enrichi',
    kind: 'change',
  };
}

function computeCompletude(data: FicheEntrepriseData, ctx: PresenceCtx): number {
  const checks = [
    Boolean(data.identite_entreprise?.nom_legal?.trim()),
    Boolean(data.secteur_declare?.trim() || ctx.secteur),
    Boolean(data.zone_geographique?.trim()),
    Boolean(data.decideur?.nom?.trim()),
    Boolean(data.decideur?.fonction?.trim()),
    Boolean(ctx.email),
    Boolean(ctx.phone),
    Boolean(ctx.siteWeb),
    Boolean(data.besoin_detecte?.trim()),
    Boolean(typeof data.score_fit === 'number'),
    Boolean((data.signaux_externes || []).length > 0),
    Boolean(data.taille_estimee?.trim() || ctx.sourcesCount > 0),
  ];
  const ok = checks.filter(Boolean).length;
  return clampScore((ok / checks.length) * 100);
}

function computeFiabilite(data: FicheEntrepriseData, ctx: PresenceCtx): number {
  let score = 35;
  if (ctx.scoreConfiance != null) score = ctx.scoreConfiance;
  if (data.decideur?.source?.trim()) score += 12;
  if (data.decideur?.nom?.trim() && data.decideur?.fonction?.trim()) score += 8;
  if (ctx.siteWeb) score += 8;
  if (ctx.email) score += 6;
  if (ctx.phone) score += 6;
  if ((data.signaux_externes || []).length >= 2) score += 8;
  if (ctx.sourcesCount >= 2) score += 10;
  if (ctx.sourcesCount >= 4) score += 5;
  return clampScore(score);
}

function computeFraicheur(ctx: PresenceCtx, derniereAnalyse: Date | null): number {
  if (ctx.scoreFraicheur != null) return clampScore(ctx.scoreFraicheur);
  const ref = derniereAnalyse || (ctx.dateDerniereVerification ? new Date(ctx.dateDerniereVerification) : null);
  if (!ref || Number.isNaN(ref.getTime())) return 40;
  const days = Math.max(0, (Date.now() - ref.getTime()) / 86_400_000);
  if (days <= 1) return 95;
  if (days <= 7) return 80;
  if (days <= 30) return 60;
  if (days <= 90) return 40;
  return 20;
}

/**
 * Qualité du dossier vivant + infos manquantes + fil du jour (Scribe / agents).
 */
export async function buildDossierIntelligence(input: {
  organizationId: string;
  contactId: string;
  ficheData: unknown;
  email?: string | null;
  phone?: string | null;
  referentiel?: {
    siteWeb?: string | null;
    secteur?: string | null;
    sources?: unknown;
    scoreFraicheur?: number | null;
    scoreConfianceGlobal?: number | null;
    dateDerniereVerification?: Date | null;
  } | null;
}): Promise<DossierIntelligence> {
  const data = parseFicheData(input.ficheData);
  const sourcesRaw = input.referentiel?.sources;
  const sourcesCount = Array.isArray(sourcesRaw)
    ? sourcesRaw.length
    : sourcesRaw && typeof sourcesRaw === 'object'
      ? Object.keys(sourcesRaw as object).length
      : data.source_decouverte
        ? 1
        : 0;

  const ctx: PresenceCtx = {
    email: input.email,
    phone: input.phone,
    siteWeb: input.referentiel?.siteWeb,
    secteur: input.referentiel?.secteur,
    sourcesCount,
    scoreFraicheur: input.referentiel?.scoreFraicheur ?? null,
    scoreConfiance: input.referentiel?.scoreConfianceGlobal ?? null,
    dateDerniereVerification: input.referentiel?.dateDerniereVerification ?? null,
  };

  const since = startOfToday();
  const journal = await prisma.ficheTransition.findMany({
    where: {
      organizationId: input.organizationId,
      contactId: input.contactId,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });

  const lastAny = await prisma.ficheTransition.findFirst({
    where: { organizationId: input.organizationId, contactId: input.contactId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  const updatesToday = journal.map(humanizeTransition);
  const hasChanges = updatesToday.some((u) => u.kind === 'change');
  const dateLabel = since.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const infosManquantes = MISSING_CHECKS.filter((c) => !c.ok(data, ctx)).map((c) => ({
    id: c.id,
    label: c.label,
    categorie: c.categorie,
  }));

  const completude = computeCompletude(data, ctx);
  const fiabilite = computeFiabilite(data, ctx);
  const fraicheur = computeFraicheur(ctx, lastAny?.createdAt ?? null);
  const confianceIa = clampScore(
    completude * 0.35 + fiabilite * 0.4 + fraicheur * 0.25
  );

  return {
    scores: {
      completude,
      fiabilite,
      fraicheur,
      sources: sourcesCount,
      confianceIa,
    },
    derniereAnalyse: lastAny?.createdAt?.toISOString() ?? null,
    infosManquantes,
    updatesToday,
    todaySummary: {
      date: dateLabel,
      hasChanges,
      message: hasChanges
        ? `${updatesToday.filter((u) => u.kind === 'change').length} évolution(s) détectée(s) aujourd’hui`
        : journal.length > 0
          ? 'Analyse terminée. Aucune modification détectée.'
          : 'Pas encore d’analyse Scribe aujourd’hui.',
    },
  };
}
