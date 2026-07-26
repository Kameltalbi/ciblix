import { prisma } from '../../db/prisma.js';
import { enqueueAgentTask } from './agentTaskService.js';
import { isPastScoutOpportunity } from '../scout/scoutFreshness.js';
import { resolveCompanyNameForContact } from '../scout/companyNameGuard.js';
import { wakeDormantFicheFromScout } from './wakeFromScout.js';

/**
 * Après un scan Veilleur (manuel ou auto) :
 * 1) si une fiche existe déjà → réveil (signal + suggestion), pas de doublon Hunt
 * 2) sinon → tâche Prospecteur ENRICH uniquement si entreprise identifiable
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
    if (
      full &&
      isPastScoutOpportunity({
        category: full.category || opp.category,
        title: full.title,
        snippet: full.snippet,
        aiSummary: full.aiSummary,
        deadline: full.deadline,
      })
    ) {
      if (full.status === 'NEW') {
        await prisma.scoutOpportunity.update({
          where: { id: full.id },
          data: { status: 'DISMISSED' },
        });
      }
      continue;
    }
    const raw = (full?.rawData || {}) as { companyName?: string | null };
    const companyGuess = resolveCompanyNameForContact({
      extractedCompanyName: raw.companyName,
      signalTitle: opp.title,
    });
    // Pas d’entreprise identifiable → le signal reste côté Veilleur, pas de fiche Contact.
    if (!companyGuess) continue;

    const n = companyGuess.toLowerCase();
    if (exclude.some((e) => n.includes(e) || e.includes(n))) continue;

    // Réveil d’une fiche dormante existante (priorité produit)
    try {
      const wake = await wakeDormantFicheFromScout({
        organizationId,
        companyName: companyGuess,
        scoutOpportunityId: opp.id,
        title: opp.title,
        url: opp.url,
        category: opp.category,
      });
      if (wake.woken) {
        count += 1;
        continue;
      }
    } catch (err) {
      console.warn('[scout-handoff] wake failed', opp.id, err);
    }

    await enqueueAgentTask({
      organizationId,
      assignee: 'HUNT',
      kind: 'ENRICH_COMPANY',
      priority: 35,
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
