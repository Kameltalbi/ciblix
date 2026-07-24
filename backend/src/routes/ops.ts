import { Router, type NextFunction, type Response } from 'express';
import auth, { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { listRecentEventsForOrganization } from '../services/agent-memory/agentEventService.js';

export const opsRoutes = Router();

opsRoutes.use(auth);

const SOURCE_LABELS: Record<string, string> = {
  HUNT: 'Prospecteur',
  COPILOT: 'Assistant',
  GMAIL: 'Gmail',
  SCOUT: 'Veilleur',
  OFFREBOT: 'Propositions',
  ANALYSTE: 'Analyste',
  FACTCHECK: 'Vérificateur',
};

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Synthèse opérationnelle du Centre de Commandement IA.
 */
opsRoutes.get('/overview', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.organizationId!;
    const since24h = new Date(Date.now() - 24 * 3_600_000);
    const since48h = new Date(Date.now() - 48 * 3_600_000);

    const [
      agents,
      huntFound24h,
      huntMessages24h,
      scoutNew24h,
      gmailDraftsPending,
      gmailUrgent,
      contactsCreated24h,
      suggestionsPending,
      recentEvents,
      usageRows,
      hotProspects,
    ] = await Promise.all([
      prisma.organizationAgent.findMany({
        where: { organizationId },
        select: { agentSlug: true, active: true },
      }),
      prisma.aiProspect.count({
        where: { organizationId, deletedAt: null, createdAt: { gte: since24h } },
      }),
      prisma.agentEvent.count({
        where: {
          organizationId,
          source: 'HUNT',
          type: { in: ['EMAIL', 'WHATSAPP'] },
          createdAt: { gte: since24h },
        },
      }),
      prisma.scoutOpportunity.count({
        where: { organizationId, createdAt: { gte: since24h } },
      }),
      prisma.gmailAiProcessedMessage.count({
        where: {
          organizationId,
          status: 'PROCESSED',
          draftId: { not: null },
        },
      }),
      prisma.gmailAiProcessedMessage.count({
        where: {
          organizationId,
          status: 'PROCESSED',
          priority: 'HIGH',
          draftId: { not: null },
        },
      }),
      prisma.contact.count({
        where: { organizationId, erasedAt: null, createdAt: { gte: since24h } },
      }),
      prisma.suggestion.count({
        where: { organizationId, status: 'PENDING' },
      }),
      listRecentEventsForOrganization(organizationId, since48h, { take: 40 }),
      prisma.agentUsageMonthly.findMany({
        where: { organizationId, monthKey: currentMonthKey() },
        select: { agentSlug: true, usageCount: true },
      }),
      prisma.aiProspect.count({
        where: {
          organizationId,
          deletedAt: null,
          score: { gte: 70 },
          status: { not: 'IGNORED' },
        },
      }),
    ]);

    const activeSlugs = new Set(agents.filter((a) => a.active).map((a) => a.agentSlug));
    const usageBySlug = Object.fromEntries(usageRows.map((u) => [u.agentSlug, u.usageCount]));

    const absence = [
      {
        key: 'hunt_found',
        label: `${huntFound24h} entreprise${huntFound24h === 1 ? '' : 's'} trouvée${huntFound24h === 1 ? '' : 's'}`,
        count: huntFound24h,
      },
      {
        key: 'emails',
        label: `${gmailDraftsPending} email${gmailDraftsPending === 1 ? '' : 's'} préparé${gmailDraftsPending === 1 ? '' : 's'}`,
        count: gmailDraftsPending,
      },
      {
        key: 'scout',
        label: `${scoutNew24h} appel${scoutNew24h === 1 ? '' : 's'} d'offres détecté${scoutNew24h === 1 ? '' : 's'}`,
        count: scoutNew24h,
      },
      {
        key: 'contacts',
        label: `${contactsCreated24h} nouvelle${contactsCreated24h === 1 ? '' : 's'} opportunité${contactsCreated24h === 1 ? '' : 's'}`,
        count: contactsCreated24h,
      },
      {
        key: 'urgent',
        label: `${gmailUrgent} réponse${gmailUrgent === 1 ? '' : 's'} urgente${gmailUrgent === 1 ? '' : 's'} à valider`,
        count: gmailUrgent,
        attention: true,
      },
    ];

    const attention: Array<{
      id: string;
      priority: 'high' | 'medium' | 'low';
      title: string;
      subtitle: string;
      href: string;
    }> = [];

    if (gmailUrgent > 0 || gmailDraftsPending > 0) {
      attention.push({
        id: 'gmail',
        priority: gmailUrgent > 0 ? 'high' : 'medium',
        title: gmailUrgent > 0 ? 'Répondre à un email urgent' : 'Valider des brouillons Gmail',
        subtitle: `${gmailDraftsPending} brouillon${gmailDraftsPending > 1 ? 's' : ''} en attente`,
        href: '/agents/gmail-ai',
      });
    }

    if (suggestionsPending > 0) {
      const pending = await prisma.suggestion.findMany({
        where: { organizationId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { contact: { select: { id: true, name: true, companyName: true } } },
      });
      for (const s of pending) {
        attention.push({
          id: `sug-${s.id}`,
          priority:
            s.type === 'GENERER_OFFRE' || s.type === 'ENVOYER_MESSAGE' ? 'medium' : 'low',
          title:
            s.type === 'GENERER_OFFRE'
              ? 'Valider une offre'
              : s.type === 'ENVOYER_MESSAGE'
                ? 'Examiner une entreprise détectée'
                : s.message.slice(0, 80),
          subtitle: s.contact.name || s.contact.companyName || 'Contact',
          href: `/contacts/${s.contactId}`,
        });
      }
    }

    if (hotProspects > 0 && attention.length < 6) {
      attention.push({
        id: 'hunt-hot',
        priority: 'low',
        title: 'Examiner une entreprise détectée',
        subtitle: `${hotProspects} prospect${hotProspects > 1 ? 's' : ''} à fort score`,
        href: '/prospection-ia',
      });
    }

    const timeline = recentEvents.slice(0, 20).map((e) => ({
      id: e.id,
      at: e.createdAt.toISOString(),
      source: e.source,
      agentLabel: SOURCE_LABELS[e.source] || e.source,
      type: e.type,
      resume: e.resume,
      score: e.score,
      contactId: e.contactId,
      contactName: e.contact?.name ?? null,
    }));

    const agentsToday = [
      {
        slug: 'hunt-ai',
        name: 'Prospecteur',
        active: activeSlugs.has('hunt-ai'),
        metric: `${huntFound24h} entreprises`,
        detail: huntMessages24h > 0 ? `${huntMessages24h} messages` : 'Temps réel',
        href: '/prospection-ia',
      },
      {
        slug: 'scout-ai',
        name: 'Veilleur',
        active: activeSlugs.has('scout-ai'),
        metric: `${scoutNew24h} alertes`,
        detail: 'Veille 24h',
        href: '/agents/scout-ai',
      },
      {
        slug: 'analyste-ai',
        name: 'Analyste',
        active: activeSlugs.has('analyste-ai'),
        metric: `${usageBySlug['analyste-ai'] != null ? `${usageBySlug['analyste-ai']} briefs` : 'Briefs'}`,
        detail: 'Analyse cibles',
        href: '/agents/analyste-ai',
      },
      {
        slug: 'copilot-ia',
        name: 'Assistant',
        active: activeSlugs.has('copilot-ia'),
        metric: `${recentEvents.filter((e) => e.source === 'COPILOT').length} analyses`,
        detail: usageBySlug['copilot-ia'] != null ? `${usageBySlug['copilot-ia']} ce mois` : 'Orchestration',
        href: '/ai-assistant',
      },
    ];

    res.json({
      generatedAt: new Date().toISOString(),
      absence,
      attention: attention.slice(0, 8),
      timeline,
      agentsToday,
      stats: {
        huntFound24h,
        gmailDraftsPending,
        gmailUrgent,
        scoutNew24h,
        contactsCreated24h,
        suggestionsPending,
      },
    });
  } catch (err) {
    next(err);
  }
});
