import { prisma } from '../../db/prisma.js';

export type ScoringCriterion = { key: string; label: string; weight: number };

export const DEFAULT_SCORING_GRID: ScoringCriterion[] = [
  { key: 'budget', label: 'Budget ou enveloppe évoquée', weight: 25 },
  { key: 'deadline', label: 'Échéance ou urgence', weight: 20 },
  { key: 'decisionMaker', label: 'Décideur identifié', weight: 20 },
  { key: 'needClarity', label: 'Besoin clairement exprimé', weight: 20 },
  { key: 'engagement', label: 'Engagement / prochaine étape', weight: 15 },
];

export type CopilotOrgConfigInput = {
  sector?: string | null;
  businessLexicon?: string | null;
  scoringGrid?: ScoringCriterion[] | null;
};

export async function getCopilotOrgConfig(organizationId: string) {
  const [org, config] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
    prisma.copilotOrgConfig.findUnique({ where: { organizationId } }),
  ]);

  const scoringGrid =
    (config?.scoringGrid as ScoringCriterion[] | null) ?? DEFAULT_SCORING_GRID;

  return {
    orgName: org?.name ?? 'Organisation',
    sector: config?.sector ?? 'B2B généraliste',
    businessLexicon:
      config?.businessLexicon ??
      'Prospection, devis, relance, négociation, signature, livraison.',
    scoringGrid,
    isDefault: !config,
  };
}

export async function getCopilotOrgConfigForEdit(organizationId: string) {
  const config = await prisma.copilotOrgConfig.findUnique({ where: { organizationId } });
  return {
    sector: config?.sector ?? '',
    businessLexicon: config?.businessLexicon ?? '',
    scoringGrid: (config?.scoringGrid as ScoringCriterion[] | null) ?? DEFAULT_SCORING_GRID,
    usesDefaults: !config,
  };
}

export async function upsertCopilotOrgConfig(organizationId: string, input: CopilotOrgConfigInput) {
  const scoringGrid = input.scoringGrid?.length ? input.scoringGrid : DEFAULT_SCORING_GRID;

  return prisma.copilotOrgConfig.upsert({
    where: { organizationId },
    create: {
      organizationId,
      sector: input.sector?.trim() || null,
      businessLexicon: input.businessLexicon?.trim() || null,
      scoringGrid,
    },
    update: {
      sector: input.sector?.trim() || null,
      businessLexicon: input.businessLexicon?.trim() || null,
      scoringGrid,
    },
  });
}
