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

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfPrevMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
}

function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Dashboard Performance commerciale — KPIs, évolution, funnel, activité agents.
 */
opsRoutes.get('/performance', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.organizationId!;
    const now = new Date();
    const monthStart = startOfMonth(now);
    const prevMonthStart = startOfPrevMonth(now);
    const since30d = new Date(now.getTime() - 30 * 86_400_000);
    const monthKey = currentMonthKey();

    const [
      prospectsThisMonth,
      prospectsPrevMonth,
      opportunitiesThisMonth,
      opportunitiesPrevMonth,
      proposalsThisMonth,
      proposalsPrevMonth,
      wonThisMonth,
      wonPrevMonth,
      companiesDetected,
      qualifiedProspects,
      opportunitiesTotal,
      proposalsOpen,
      salesWon,
      scoutByCategory,
      contactsByVia,
      usageRows,
      agents,
      recentEvents,
      suggestionsPending,
      hotProspects,
      followUpsDue,
      prospects30d,
      opportunities30d,
      proposals30d,
    ] = await Promise.all([
      prisma.aiProspect.count({
        where: { organizationId, deletedAt: null, createdAt: { gte: monthStart } },
      }),
      prisma.aiProspect.count({
        where: {
          organizationId,
          deletedAt: null,
          createdAt: { gte: prevMonthStart, lt: monthStart },
        },
      }),
      prisma.scoutOpportunity.count({
        where: { organizationId, createdAt: { gte: monthStart } },
      }),
      prisma.scoutOpportunity.count({
        where: {
          organizationId,
          createdAt: { gte: prevMonthStart, lt: monthStart },
        },
      }),
      prisma.affaire.count({
        where: {
          organizationId,
          deletedAt: null,
          statut: { in: ['PROPOSITION', 'NEGOCIATION'] },
          updatedAt: { gte: monthStart },
        },
      }),
      prisma.affaire.count({
        where: {
          organizationId,
          deletedAt: null,
          statut: { in: ['PROPOSITION', 'NEGOCIATION'] },
          updatedAt: { gte: prevMonthStart, lt: monthStart },
        },
      }),
      prisma.affaire.count({
        where: {
          organizationId,
          deletedAt: null,
          statut: 'GAGNE',
          OR: [
            { dateClotureReelle: { gte: monthStart } },
            { updatedAt: { gte: monthStart }, dateClotureReelle: null },
          ],
        },
      }),
      prisma.affaire.count({
        where: {
          organizationId,
          deletedAt: null,
          statut: 'GAGNE',
          OR: [
            { dateClotureReelle: { gte: prevMonthStart, lt: monthStart } },
            {
              updatedAt: { gte: prevMonthStart, lt: monthStart },
              dateClotureReelle: null,
            },
          ],
        },
      }),
      prisma.aiProspect.count({
        where: { organizationId, deletedAt: null },
      }),
      prisma.contact.count({
        where: {
          organizationId,
          erasedAt: null,
          pipelineStatus: { in: ['CHAUD', 'TIEDE'] },
        },
      }),
      prisma.scoutOpportunity.count({
        where: { organizationId, status: { not: 'DISMISSED' } },
      }),
      prisma.affaire.count({
        where: {
          organizationId,
          deletedAt: null,
          statut: { in: ['PROPOSITION', 'NEGOCIATION'] },
        },
      }),
      prisma.affaire.count({
        where: { organizationId, deletedAt: null, statut: 'GAGNE' },
      }),
      prisma.scoutOpportunity.groupBy({
        by: ['category'],
        where: { organizationId, createdAt: { gte: monthStart } },
        _count: { _all: true },
      }),
      prisma.contact.groupBy({
        by: ['createdVia'],
        where: { organizationId, erasedAt: null, createdAt: { gte: monthStart } },
        _count: { _all: true },
      }),
      prisma.agentUsageMonthly.findMany({
        where: { organizationId, monthKey },
        select: { agentSlug: true, usageCount: true },
      }),
      prisma.organizationAgent.findMany({
        where: { organizationId },
        select: { agentSlug: true, active: true },
      }),
      listRecentEventsForOrganization(organizationId, since30d, { take: 12 }),
      prisma.suggestion.count({
        where: { organizationId, status: 'PENDING' },
      }),
      prisma.aiProspect.count({
        where: {
          organizationId,
          deletedAt: null,
          score: { gte: 70 },
          status: { not: 'IGNORED' },
        },
      }),
      prisma.affaire.count({
        where: {
          organizationId,
          deletedAt: null,
          statut: { notIn: ['GAGNE', 'PERDU'] },
          dateProchaineAction: { lte: now },
        },
      }),
      prisma.aiProspect.findMany({
        where: { organizationId, deletedAt: null, createdAt: { gte: since30d } },
        select: { createdAt: true },
      }),
      prisma.scoutOpportunity.findMany({
        where: { organizationId, createdAt: { gte: since30d } },
        select: { createdAt: true },
      }),
      prisma.affaire.findMany({
        where: {
          organizationId,
          deletedAt: null,
          statut: { in: ['PROPOSITION', 'NEGOCIATION'] },
          updatedAt: { gte: since30d },
        },
        select: { updatedAt: true },
      }),
    ]);

    const usageBySlug = Object.fromEntries(usageRows.map((u) => [u.agentSlug, u.usageCount]));
    const activeSlugs = new Set(agents.filter((a) => a.active).map((a) => a.agentSlug));

    const bucket = (items: { createdAt?: Date; updatedAt?: Date }[], field: 'createdAt' | 'updatedAt') => {
      const map = new Map<string, number>();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86_400_000);
        map.set(dayKey(d), 0);
      }
      for (const item of items) {
        const raw = field === 'updatedAt' ? item.updatedAt : item.createdAt;
        if (!raw) continue;
        const k = dayKey(raw);
        if (map.has(k)) map.set(k, (map.get(k) || 0) + 1);
      }
      return map;
    };

    const prospectsMap = bucket(prospects30d, 'createdAt');
    const oppsMap = bucket(opportunities30d, 'createdAt');
    const propsMap = bucket(proposals30d, 'updatedAt');

    const evolution = Array.from(prospectsMap.keys()).map((date) => ({
      date,
      prospects: prospectsMap.get(date) || 0,
      opportunities: oppsMap.get(date) || 0,
      proposals: propsMap.get(date) || 0,
    }));

    const oppPrevHalf = evolution.slice(0, 15).reduce((s, d) => s + d.opportunities, 0);
    const oppCurrHalf = evolution.slice(15).reduce((s, d) => s + d.opportunities, 0);
    const oppGrowthPct = pctDelta(oppCurrHalf, oppPrevHalf);

    const funnelStages = [
      { key: 'companies', label: 'Entreprises détectées', count: companiesDetected },
      { key: 'qualified', label: 'Prospects qualifiés', count: qualifiedProspects },
      { key: 'opportunities', label: 'Opportunités', count: opportunitiesTotal },
      { key: 'proposals', label: 'Propositions', count: proposalsOpen },
      { key: 'sales', label: 'Ventes', count: salesWon },
    ].map((stage, i, arr) => ({
      ...stage,
      conversionPct:
        i === 0 || arr[i - 1].count <= 0
          ? null
          : Math.round((stage.count / arr[i - 1].count) * 100),
    }));

    const sourceBuckets: Record<string, number> = {
      'Appels d\'offres': 0,
      LinkedIn: 0,
      Prospection: 0,
      Recommandations: 0,
      'Site web': 0,
    };

    for (const row of scoutByCategory) {
      const n = row._count._all;
      if (row.category === 'TENDER') sourceBuckets["Appels d'offres"] += n;
      else if (row.category === 'EVENT') sourceBuckets.LinkedIn += n;
      else sourceBuckets.Prospection += n;
    }
    for (const row of contactsByVia) {
      const n = row._count._all;
      if (row.createdVia === 'HUNT') sourceBuckets.Prospection += n;
      else if (row.createdVia === 'SCOUT') sourceBuckets["Appels d'offres"] += n;
      else if (row.createdVia === 'MANUAL_IMPORT') sourceBuckets.Recommandations += n;
      else if (row.createdVia === 'GMAIL') sourceBuckets['Site web'] += n;
      else sourceBuckets.LinkedIn += n;
    }

    const sourceTotal = Object.values(sourceBuckets).reduce((a, b) => a + b, 0) || 1;
    let opportunitySources = Object.entries(sourceBuckets)
      .map(([name, value]) => ({
        name,
        value,
        pct: Math.round((value / sourceTotal) * 100),
      }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);

    if (opportunitySources.length === 0) {
      opportunitySources = [
        { name: "Appels d'offres", value: 0, pct: 0 },
        { name: 'LinkedIn', value: 0, pct: 0 },
        { name: 'Prospection', value: 0, pct: 0 },
        { name: 'Recommandations', value: 0, pct: 0 },
        { name: 'Site web', value: 0, pct: 0 },
      ];
    }

    const teamDefs = [
      {
        slug: 'hunt-ai',
        name: 'Prospecteur',
        role: 'Trouver de nouveaux clients',
        metric: `${prospectsThisMonth} prospects ce mois`,
        actions: usageBySlug['hunt-ai'] ?? prospectsThisMonth,
        href: '/prospection-ia',
      },
      {
        slug: 'scout-ai',
        name: 'Veilleur',
        role: 'Détecter les opportunités',
        metric: `${opportunitiesThisMonth} opportunités détectées`,
        actions: usageBySlug['scout-ai'] ?? opportunitiesThisMonth,
        href: '/agents/scout-ai',
      },
      {
        slug: 'analyste-ai',
        name: 'Analyste',
        role: 'Analyser les entreprises',
        metric: `${usageBySlug['analyste-ai'] ?? 0} analyses réalisées`,
        actions: usageBySlug['analyste-ai'] ?? 0,
        href: '/agents/analyste-ai',
      },
      {
        slug: 'copilot-ia',
        name: 'Assistant',
        role: 'Piloter les actions commerciales',
        metric: `${usageBySlug['copilot-ia'] ?? 0} actions préparées`,
        actions: usageBySlug['copilot-ia'] ?? 0,
        href: '/ai-assistant',
      },
    ] as const;

    const todaysActions = [
      {
        id: 'review-opps',
        label: 'opportunités à examiner',
        count: Math.min(opportunitiesThisMonth, 99) || suggestionsPending,
        cta: 'Examiner',
        href: '/agents/scout-ai',
      },
      {
        id: 'contact-prospects',
        label: 'prospects à contacter',
        count: hotProspects,
        cta: 'Contacter',
        href: '/prospection-ia',
      },
      {
        id: 'finalize-proposals',
        label: 'propositions à finaliser',
        count: proposalsOpen,
        cta: 'Finaliser',
        href: '/agents/offre-bot',
      },
      {
        id: 'follow-ups',
        label: 'relances prévues',
        count: followUpsDue,
        cta: 'Relancer',
        href: '/contacts',
      },
    ].filter((a) => a.count > 0);

    const timeline = recentEvents.slice(0, 10).map((e) => ({
      id: e.id,
      at: e.createdAt.toISOString(),
      source: e.source,
      agentLabel: SOURCE_LABELS[e.source] || e.source,
      resume: e.resume,
      contactId: e.contactId,
      contactName: e.contact?.name ?? null,
    }));

    res.json({
      generatedAt: now.toISOString(),
      kpis: [
        {
          key: 'prospects',
          label: 'Nouveaux prospects',
          value: prospectsThisMonth,
          deltaPct: pctDelta(prospectsThisMonth, prospectsPrevMonth),
        },
        {
          key: 'opportunities',
          label: 'Opportunités détectées',
          value: opportunitiesThisMonth,
          deltaPct: pctDelta(opportunitiesThisMonth, opportunitiesPrevMonth),
        },
        {
          key: 'proposals',
          label: 'Propositions envoyées',
          value: proposalsThisMonth,
          deltaPct: pctDelta(proposalsThisMonth, proposalsPrevMonth),
        },
        {
          key: 'won',
          label: 'Affaires gagnées',
          value: wonThisMonth,
          deltaPct: pctDelta(wonThisMonth, wonPrevMonth),
        },
      ],
      evolution: {
        days: evolution,
        insight:
          oppGrowthPct == null
            ? 'Suivez l’évolution de vos opportunités au fil du mois.'
            : oppGrowthPct >= 0
              ? `Les opportunités progressent de ${oppGrowthPct} % ce mois.`
              : `Les opportunités baissent de ${Math.abs(oppGrowthPct)} % ce mois.`,
        growthPct: oppGrowthPct,
      },
      funnel: funnelStages,
      opportunitySources,
      agentActivity: teamDefs.map((t) => ({
        slug: t.slug,
        name: t.name,
        actions: t.actions,
        active: activeSlugs.has(t.slug),
      })),
      todaysActions,
      timeline,
      team: teamDefs.map((t) => ({
        slug: t.slug,
        name: t.name,
        role: t.role,
        metric: t.metric,
        href: t.href,
        active: activeSlugs.has(t.slug),
      })),
    });
  } catch (err) {
    next(err);
  }
});
