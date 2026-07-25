import { prisma } from '../../db/prisma.js';
import { enqueueAgentTask } from './agentTaskService.js';

/**
 * Après un scan Veilleur (manuel ou auto) : crée des tâches Prospecteur.
 * Utilisé aussi bien par le scheduler Scout que par WATCH_SIGNALS.
 */
export async function handoffScoutSignalsToHunt(
  organizationId: string,
  opportunities: Array<{
    id: string;
    title: string;
    url: string;
    relevanceScore: number;
    category: string;
    aiSummary: string | null;
  }>
): Promise<number> {
  if (!opportunities.length) return 0;

  const targeting = await prisma.orgTargetingProfile.findUnique({
    where: { organizationId },
  });
  const minScore = targeting?.minScoutScoreToHandoff ?? 55;
  const exclude = (targeting?.excludeCompanies ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);

  let count = 0;
  for (const opp of opportunities) {
    if (opp.relevanceScore < minScore) continue;
    const full = await prisma.scoutOpportunity.findUnique({ where: { id: opp.id } });
    const raw = (full?.rawData || {}) as { companyName?: string };
    const companyGuess =
      raw.companyName?.trim() ||
      opp.title.split(/[|\-–—:]/)[0]?.trim() ||
      opp.title;
    const n = companyGuess.toLowerCase();
    if (exclude.some((e) => n.includes(e) || e.includes(n))) continue;

    await enqueueAgentTask({
      organizationId,
      assignee: 'HUNT',
      kind: 'ENRICH_COMPANY',
      priority: Math.min(100, opp.relevanceScore),
      dedupeKey: `enrich:scout:${opp.id}`,
      payload: {
        scoutOpportunityId: opp.id,
        companyName: companyGuess,
        signalTitle: opp.title,
        signalUrl: opp.url,
        signalCategory: opp.category,
        relevanceScore: opp.relevanceScore,
        aiSummary: opp.aiSummary,
      },
    });
    count += 1;
  }
  return count;
}
