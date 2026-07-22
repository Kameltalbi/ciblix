import { listRecentEventsForOrganization } from '../agent-memory/agentEventService.js';

export async function buildCopilotBriefing(organizationId: string) {
  const since = new Date(Date.now() - 48 * 3_600_000);
  const events = await listRecentEventsForOrganization(organizationId, since, { take: 150 });

  const doneEvents = events.filter((e) => e.processingStatus === 'DONE' || e.processingStatus == null);
  const scores = doneEvents.map((e) => e.score ?? 0).filter((s) => s > 0);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const highScoreCount = doneEvents.filter((e) => (e.score ?? 0) >= 70).length;
  const pendingContacts = doneEvents.filter((e) => !e.contactId).length;

  const recommendations = doneEvents
    .flatMap((e) =>
      (e.actionsSuggerees || []).slice(0, 2).map((action) => ({
        agentEventId: e.id,
        contactName: e.contact?.name ?? undefined,
        action,
        score: e.score ?? 0,
      }))
    )
    .slice(0, 12);

  const alerts = doneEvents
    .filter((e) => (e.score ?? 0) < 40 || !e.contactId)
    .slice(0, 8)
    .map((e) => ({
      type: !e.contactId ? 'unresolved_contact' : 'low_score',
      agentEventId: e.id,
      contactName: e.contact?.name ?? undefined,
      message: !e.contactId
        ? 'Contact non identifié — vérifiez les indices fournis'
        : `Score faible (${e.score ?? 0}/100) — relance recommandée`,
    }));

  const topOpportunities = doneEvents
    .filter((e) => (e.score ?? 0) >= 50)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      contactName: e.contact?.name ?? undefined,
      resume: e.resume ?? '',
      score: e.score ?? 0,
      createdAt: e.createdAt.toISOString(),
    }));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      recentConversations: doneEvents.length,
      highScoreCount,
      pendingContacts,
      avgScore,
    },
    recommendations,
    alerts,
    topOpportunities,
  };
}
