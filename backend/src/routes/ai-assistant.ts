import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import auth, { AuthRequest } from '../middleware/auth.js';
import { checkAgentAccess } from '../middleware/planRestrictions.js';
import { tryConsumeAgentQuota } from '../services/agentUsage.js';
import { requireMissionForMutations } from '../middleware/requireMissionMutations.js';
import {
  buildFollowUpTemplates,
  computeCommercialInsight,
  heatToFrench,
  labelToFrench,
} from '../lib/commercialIntel.js';

export const aiAssistantRoutes = Router();

aiAssistantRoutes.use(auth);
aiAssistantRoutes.use(checkAgentAccess('copilot-ia'));
aiAssistantRoutes.use(requireMissionForMutations);

const OPEN_PIPELINE = ['PROSPECT', 'QUALIFIE', 'PROPOSITION', 'NEGOCIATION'] as const;

async function buildOperationalBriefing(organizationId: string) {
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;

  const [openAffaires, hotLeadsCount, monthWeighted, users] = await Promise.all([
    prisma.affaire.findMany({
      where: { organizationId, deletedAt: null, statut: { in: [...OPEN_PIPELINE] } },
      take: 400,
      orderBy: { updatedAt: 'asc' },
      select: {
        id: true,
        title: true,
        statut: true,
        probabilite: true,
        score: true,
        montantHT: true,
        createdAt: true,
        updatedAt: true,
        dateProchaineAction: true,
        devisId: true,
        devisNumero: true,
        prochaineAction: true,
        assignedToId: true,
        client: { select: { name: true } },
      },
    }),
    prisma.lead.count({
      where: { organizationId, deletedAt: null, status: 'QUALIFIED', score: { gte: 70 } },
    }),
    prisma.affaire.findMany({
      where: {
        organizationId,
        deletedAt: null,
        statut: { in: [...OPEN_PIPELINE] },
        moisPrevu: cm,
        anneePrevue: cy,
      },
      select: { montantHT: true, probabilite: true },
    }),
    prisma.user.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    }),
  ]);

  const ids = openAffaires.map((a) => a.id);
  const lastActs =
    ids.length === 0
      ? []
      : await prisma.activite.groupBy({
          by: ['affaireId'],
          where: { organizationId, affaireId: { in: ids } },
          _max: { createdAt: true },
        });
  const lastMap: Record<string, Date> = {};
  for (const r of lastActs) {
    if (r._max.createdAt) lastMap[r.affaireId] = r._max.createdAt;
  }

  const insights = openAffaires.map((a) => {
    const ins = computeCommercialInsight(
      {
        statut: a.statut,
        probabilite: a.probabilite,
        score: a.score,
        montantHT: Number(a.montantHT),
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        lastActivityAt: lastMap[a.id] ?? null,
        dateProchaineAction: a.dateProchaineAction,
        hasDevis: Boolean(a.devisId || a.devisNumero),
      },
      now
    );
    return { affaire: a, ins };
  });

  const priorityOpps = insights.filter(
    (x) => x.ins.iaScoreLabel === 'TRES_CHAUD' || x.ins.iaScoreLabel === 'CHAUD'
  ).length;
  const quotesNoReply = insights.filter((x) => x.ins.staleQuoteNoReply).length;
  const atRisk = insights.filter(
    (x) => x.ins.iaScoreLabel === 'RISQUE_PERTE' || x.ins.negotiationBlocked
  ).length;

  const forecastMonth = Math.round(
    monthWeighted.reduce((s, a) => s + Number(a.montantHT) * (a.probabilite / 100), 0)
  );

  const sortedRec = [...insights].sort((a, b) => b.ins.iaScoreNumeric - a.ins.iaScoreNumeric).slice(0, 12);

  const recommendations = sortedRec.map(({ affaire: a, ins }) => {
    let action = 'Planifier une relance courte';
    if (ins.staleQuoteNoReply) {
      action = `Relancer ${a.client?.name || 'le client'} (offre sans réponse depuis ${ins.daysSinceLastTouch} j.)`;
    } else if (ins.negotiationBlocked) {
      action = `Débloquer la négociation avec ${a.client?.name || 'le client'}`;
    } else if (ins.daysOverdueNextAction != null) {
      action = `Rattraper l’action prévue (+${ins.daysOverdueNextAction} j.) — ${a.client?.name || ''}`;
    } else if (ins.iaScoreLabel === 'TRES_CHAUD') {
      action = `Accélérer la clôture — ${a.client?.name || ''} (${labelToFrench(ins.iaScoreLabel)})`;
    }
    return {
      affaireId: a.id,
      clientName: a.client?.name ?? '—',
      action,
      iaLabel: ins.iaScoreLabel,
      iaLabelFr: labelToFrench(ins.iaScoreLabel),
      score: ins.iaScoreNumeric,
    };
  });

  const alerts = insights
    .filter(
      (x) =>
        x.ins.staleQuoteNoReply ||
        x.ins.negotiationBlocked ||
        (x.ins.daysOverdueNextAction !== null && x.ins.daysOverdueNextAction > 5)
    )
    .slice(0, 15)
    .map(({ affaire: a, ins }) => ({
      type: ins.staleQuoteNoReply
        ? 'DEVIS_SILENCE'
        : ins.negotiationBlocked
          ? 'NEGO_BLOC'
          : 'ACTION_RETARD',
      affaireId: a.id,
      title: a.title,
      clientName: a.client?.name,
      message:
        ins.staleQuoteNoReply
          ? `Sans nouvelles depuis ${ins.daysSinceLastTouch} j. — ${a.statut}`
          : ins.negotiationBlocked
            ? 'Négociation sans animation depuis 14+ j.'
            : `Action commerciale en retard de ${ins.daysOverdueNextAction} j.`,
    }));

  const hotOpportunitiesTop = [...insights]
    .sort((a, b) => b.ins.iaScoreNumeric - a.ins.iaScoreNumeric)
    .slice(0, 5)
    .map(({ affaire: a, ins }) => ({
      id: a.id,
      clientName: a.client?.name,
      montantHT: Number(a.montantHT),
      iaLabelFr: labelToFrench(ins.iaScoreLabel),
      heatFr: heatToFrench(ins.heatLevel),
      daysSinceLastTouch: ins.daysSinceLastTouch,
      signatureProbabilityPct: ins.signatureProbabilityPct,
      statut: a.statut,
    }));

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  return {
    generatedAt: now.toISOString(),
    summary: {
      priorityOpportunities: priorityOpps,
      quotesWithoutReply7d: quotesNoReply,
      atRiskCount: atRisk,
      hotLeads: hotLeadsCount,
      monthForecastWeightedHT: forecastMonth,
    },
    recommendations,
    alerts,
    hotOpportunities: hotOpportunitiesTop,
    userNamesById: userMap,
  };
}

aiAssistantRoutes.get('/operational-briefing', async (req: AuthRequest, res, next) => {
  try {
    const briefing = await buildOperationalBriefing(req.organizationId!);
    res.json(briefing);
  } catch (e) {
    next(e);
  }
});

const followUpDraftSchema = z.object({
  affaireId: z.string().min(1),
  tone: z.enum(['soft', 'commercial', 'firm']),
  channel: z.enum(['email', 'whatsapp']),
  length: z.enum(['short', 'long']),
  language: z.string().optional(),
});

aiAssistantRoutes.post('/follow-up-draft', async (req: AuthRequest, res, next) => {
  try {
    if (!(await tryConsumeAgentQuota(req.organizationId!, 'copilot-ia', res))) return;

    const body = followUpDraftSchema.parse(req.body);
    const affaire = await prisma.affaire.findFirst({
      where: { id: body.affaireId, organizationId: req.organizationId!, deletedAt: null },
      include: { client: { select: { name: true } } },
    });
    if (!affaire) return res.status(404).json({ error: 'Affaire introuvable' });

    const clientName = affaire.client?.name || 'Madame, Monsieur';
    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey) {
      try {
        const prompt =
          `Génère une relance ${body.channel === 'whatsapp' ? 'type message court (sans objet)' : 'email avec objet'}.\n` +
          `Ton : ${body.tone === 'soft' ? 'doux' : body.tone === 'firm' ? 'ferme' : 'commercial'}.\n` +
          `Longueur : ${body.length === 'short' ? 'courte' : 'plus développée'}.\n` +
          `Client : ${clientName}\n` +
          `Statut opportunité : ${affaire.statut}, montant HT : ${affaire.montantHT} DT, probabilité : ${affaire.probabilite}%.\n` +
          (body.language?.startsWith('en')
            ? 'Write in English.'
            : body.language?.startsWith('ar')
              ? 'Write in Arabic.'
              : 'Write in French.');

        const systemPrompt =
          'Tu es un assistant commercial PME. Messages clairs, respectueux, orientés action. Pas de jargon inutile.';
        const aiResponse = await callOpenAI(prompt, systemPrompt);
        res.json({ source: 'openai', text: aiResponse, affaireId: affaire.id });
        return;
      } catch {
        // fallback templates
      }
    }

    const tpl = buildFollowUpTemplates({
      clientName,
      montantHT: Number(affaire.montantHT),
      statut: affaire.statut,
      tone: body.tone,
      channel: body.channel,
      length: body.length,
    });
    res.json({
      source: 'template',
      subject: tpl.subject,
      body: tpl.body,
      affaireId: affaire.id,
    });
  } catch (e) {
    next(e);
  }
});

// OpenAI API integration
async function callOpenAI(prompt: string, systemPrompt?: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

const querySchema = z.object({
  message: z.string().min(1),
  language: z.string().optional(),
});

// Predictive analytics
function sortMonthKeys(keys: string[]) {
  return [...keys].sort((a, b) => {
    const [ya, ma] = a.split('-').map((x) => parseInt(x!, 10));
    const [yb, mb] = b.split('-').map((x) => parseInt(x!, 10));
    if (ya !== yb) return ya - yb;
    return ma - mb;
  });
}

async function predictYearEndCA(organizationId: string) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const historyStartYear = currentYear - 2;

  const [allAffaires, wonHistoryByMonth, currentYearPipeline] = await Promise.all([
    prisma.affaire.findMany({
      where: {
        organizationId,
        deletedAt: null,
        anneePrevue: currentYear,
        statut: { not: 'PERDU' },
      },
      select: { montantHT: true, probabilite: true, moisPrevu: true, statut: true },
    }),
    prisma.affaire.groupBy({
      by: ['anneePrevue', 'moisPrevu'],
      where: {
        organizationId,
        deletedAt: null,
        statut: 'GAGNE',
        anneePrevue: { gte: historyStartYear, lte: currentYear },
      },
      _sum: { montantHT: true },
      orderBy: [{ anneePrevue: 'asc' }, { moisPrevu: 'asc' }],
    }),
    prisma.affaire.findMany({
      where: {
        organizationId,
        deletedAt: null,
        anneePrevue: currentYear,
        statut: { in: ['PROSPECT', 'QUALIFIE', 'PROPOSITION', 'NEGOCIATION'] },
      },
      select: { moisPrevu: true, montantHT: true, probabilite: true },
    }),
  ]);

  const caTotalAll = allAffaires.reduce((sum, a) => sum + Number(a.montantHT), 0);
  const realise = allAffaires.filter((a) => a.statut === 'GAGNE');
  const caRealise = realise.reduce((sum, a) => sum + Number(a.montantHT), 0);

  const monthlyCA: { [key: string]: number } = {};
  for (const a of realise) {
    const key = `${currentYear}-${a.moisPrevu}`;
    monthlyCA[key] = (monthlyCA[key] || 0) + Number(a.montantHT);
  }

  const pipelineTotal = currentYearPipeline.reduce((sum, a) => sum + Number(a.montantHT), 0);
  const pipelinePondere = currentYearPipeline.reduce(
    (sum, a) => sum + Number(a.montantHT) * (a.probabilite / 100),
    0
  );

  // --- Seasonality from won history (month index 1..12) ---
  const monthHistory: Record<number, number[]> = {};
  for (let m = 1; m <= 12; m++) monthHistory[m] = [];
  const fullSeries: number[] = [];
  for (const g of wonHistoryByMonth) {
    const val = Number(g._sum.montantHT ?? 0);
    monthHistory[g.moisPrevu].push(val);
    fullSeries.push(val);
  }

  const avgSeries = fullSeries.length > 0
    ? fullSeries.reduce((s, v) => s + v, 0) / fullSeries.length
    : 0;
  const monthSeasonality: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    const arr = monthHistory[m];
    const monthAvg = arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : avgSeries;
    monthSeasonality[m] = avgSeries > 0 ? monthAvg / avgSeries : 1;
  }

  // --- Current-year won series (for trend + MoM growth) ---
  const wonByMonthCurrentYear: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) wonByMonthCurrentYear[m] = 0;
  for (const g of wonHistoryByMonth) {
    if (g.anneePrevue === currentYear) {
      wonByMonthCurrentYear[g.moisPrevu] = Number(g._sum.montantHT ?? 0);
    }
  }
  const realizedSeries = Array.from({ length: Math.max(1, currentMonth - 1) }, (_, i) => wonByMonthCurrentYear[i + 1] ?? 0);
  const avgMonthlyCA = realizedSeries.length > 0
    ? realizedSeries.reduce((s, v) => s + v, 0) / realizedSeries.length
    : 0;

  // Robust MoM growth: median of non-extreme changes
  const growthRates: number[] = [];
  for (let i = 1; i < realizedSeries.length; i++) {
    const prev = realizedSeries[i - 1];
    const curr = realizedSeries[i];
    if (prev > 0) {
      const rate = (curr - prev) / prev;
      // clamp noise/outliers to keep forecast stable
      growthRates.push(Math.max(-0.5, Math.min(0.8, rate)));
    }
  }
  growthRates.sort((a, b) => a - b);
  const medianGrowth = growthRates.length === 0
    ? 0
    : growthRates[Math.floor(growthRates.length / 2)];

  // Linear trend slope on recent realized months (simple and deterministic)
  let trendSlope = 0;
  if (realizedSeries.length >= 3) {
    const n = realizedSeries.length;
    const xs = Array.from({ length: n }, (_, i) => i + 1);
    const xMean = xs.reduce((s, v) => s + v, 0) / n;
    const yMean = realizedSeries.reduce((s, v) => s + v, 0) / n;
    const num = xs.reduce((s, x, i) => s + (x - xMean) * (realizedSeries[i] - yMean), 0);
    const den = xs.reduce((s, x) => s + (x - xMean) * (x - xMean), 0);
    trendSlope = den > 0 ? num / den : 0;
  }

  // Pipeline weighted by target month
  const pipelineWeightedByMonth: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) pipelineWeightedByMonth[m] = 0;
  for (const p of currentYearPipeline) {
    const weighted = Number(p.montantHT) * (p.probabilite / 100);
    pipelineWeightedByMonth[p.moisPrevu] += weighted;
  }

  // Forecast remaining months: seasonality + trend + mom growth + weighted pipeline
  const monthlyForecast: Record<number, number> = {};
  const lastRealized = realizedSeries.length > 0 ? realizedSeries[realizedSeries.length - 1] : avgSeries;
  const baseForProjection = lastRealized > 0 ? lastRealized : avgMonthlyCA;
  let projectedFuture = 0;

  for (let m = currentMonth; m <= 12; m++) {
    const step = m - currentMonth + 1;
    const seasonalBaseline = (avgSeries > 0 ? avgSeries : baseForProjection) * monthSeasonality[m];
    const trendComponent = Math.max(0, baseForProjection + trendSlope * step);
    const growthComponent = Math.max(0, trendComponent * (1 + medianGrowth * 0.6));
    const structuralForecast = 0.45 * seasonalBaseline + 0.55 * growthComponent;
    const monthForecast = Math.max(0, structuralForecast + pipelineWeightedByMonth[m]);
    monthlyForecast[m] = monthForecast;
    projectedFuture += monthForecast;
  }

  // Guardrails to keep forecasts realistic:
  // - floor anchored to weighted pipeline
  // - cap anchored to current run-rate + weighted pipeline
  const realizedMonthsCount = Math.max(1, currentMonth - 1);
  const remainingMonthsCount = Math.max(0, 12 - currentMonth + 1);
  const runRateRealized = caRealise / realizedMonthsCount;
  const conservativeFutureFromRunRate = runRateRealized * remainingMonthsCount;
  const minFutureBound = Math.max(0, pipelinePondere * 0.6);
  const maxFutureBound = Math.max(
    minFutureBound,
    conservativeFutureFromRunRate * 1.2 + pipelinePondere * 1.05
  );
  const projectedFutureBounded = Math.max(
    minFutureBound,
    Math.min(projectedFuture, maxFutureBound)
  );

  const predictedCA = Math.round(caRealise + projectedFutureBounded);

  // Taux de croissance vs année précédente
  const prevYearAgg = await prisma.affaire.aggregate({
    where: {
      organizationId,
      deletedAt: null,
      statut: { not: 'PERDU' },
      anneePrevue: currentYear - 1,
    },
    _sum: { montantHT: true },
  });
  const prevYearCA = Number(prevYearAgg._sum.montantHT ?? 0);
  const growthVsPrev = prevYearCA > 0 ? Math.round(((predictedCA - prevYearCA) / prevYearCA) * 100) : 0;

  return {
    caTotalAll: Math.round(caTotalAll),
    caRealise: Math.round(caRealise),
    predictedCA,
    pipelineCA: Math.round(pipelineTotal),
    pipelinePondere: Math.round(pipelinePondere),
    avgGrowth: growthVsPrev,
    monthsData: monthlyCA,
    avgMonthlyCA: Math.round(avgMonthlyCA),
    projectionMeta: {
      medianMoMGrowthPct: Math.round(medianGrowth * 100),
      trendSlope: Math.round(trendSlope),
      projectedFuture: Math.round(projectedFuture),
      projectedFutureBounded: Math.round(projectedFutureBounded),
      forecastBounds: {
        minFutureBound: Math.round(minFutureBound),
        maxFutureBound: Math.round(maxFutureBound),
      },
      monthlyForecast: Object.fromEntries(
        Object.entries(monthlyForecast).map(([k, v]) => [k, Math.round(v)])
      ),
    },
  };
}

async function generateRecommendations(organizationId: string, prediction: any) {
  const recommendations: string[] = [];
  
  // Check if on track
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const monthsPassed = currentMonth;
  const expectedAtThisPoint = (prediction.predictedCA / 12) * monthsPassed;
  
  if (prediction.caRealise < expectedAtThisPoint * 0.8) {
    recommendations.push(`⚠️ Vous êtes en retard de ${Math.round((expectedAtThisPoint - prediction.caRealise) / 1000) * 1000} DT par rapport à votre tendance.`);
    recommendations.push('💡 Action prioritaire : Contactez vos opportunités en Pipeline avec probabilité > 50%');
  }
  
  // High probability opportunities
  const highProb = await prisma.affaire.findMany({
    where: {
      organizationId,
      deletedAt: null,
      statut: { in: ['PROSPECT', 'QUALIFIE', 'PROPOSITION', 'NEGOCIATION'] },
      probabilite: { gte: 60 },
    },
    orderBy: { montantHT: 'desc' },
    take: 5,
    select: { montantHT: true },
  });
  
  if (highProb.length > 0) {
    recommendations.push(`🎯 ${highProb.length} opportunités à forte probabilité (${highProb.reduce((s, a) => s + Number(a.montantHT), 0).toLocaleString('fr-TN')} DT)`);
  }
  
  // Seasonal patterns
  const months = Object.keys(prediction.monthsData);
  if (months.length >= 12) {
    const monthlyAvgs: { [key: string]: number[] } = {};
    months.forEach(m => {
      const month = m.split('-')[1];
      if (!monthlyAvgs[month]) monthlyAvgs[month] = [];
      monthlyAvgs[month].push(prediction.monthsData[m]);
    });
    
    const avgByMonth: { [key: string]: number } = {};
    Object.keys(monthlyAvgs).forEach(month => {
      avgByMonth[month] = monthlyAvgs[month].reduce((a, b) => a + b, 0) / monthlyAvgs[month].length;
    });
    
    const nextMonth = String((currentMonth % 12) + 1);
    const nextMonthAvg = avgByMonth[nextMonth] || 0;
    if (nextMonthAvg > 0) {
      recommendations.push(`📊 Historiquement, le mois prochain génère en moyenne ${nextMonthAvg.toLocaleString('fr-TN')} DT`);
    }
  }
  
  return recommendations;
}

// Enhanced query processor with predictive features
function processQuery(message: string, organizationId: string): string {
  const lowerMessage = message.toLowerCase();
  
  // Predictive queries
  if (lowerMessage.includes('prédire') || lowerMessage.includes('predire') || lowerMessage.includes('prévision') || lowerMessage.includes('fin d\'année') || lowerMessage.includes('année')) {
    return 'predict_year_end';
  }
  
  if (lowerMessage.includes('conseil') || lowerMessage.includes('recommandation') || lowerMessage.includes('améliorer') || lowerMessage.includes('atteindre')) {
    return 'recommendations';
  }
  
  if (lowerMessage.includes('objectif') || lowerMessage.includes('cible') || lowerMessage.includes('target')) {
    return 'target_analysis';
  }
  
  // Query patterns
  if (lowerMessage.includes('opportunité') || lowerMessage.includes('affaire')) {
    if (lowerMessage.includes('cette semaine') || lowerMessage.includes('semaine')) {
      return 'opportunities_this_week';
    }
    if (lowerMessage.includes('ce mois') || lowerMessage.includes('mois')) {
      return 'opportunities_this_month';
    }
    if (lowerMessage.includes('total') || lowerMessage.includes('combien')) {
      return 'total_opportunities';
    }
    return 'opportunities_list';
  }
  
  if (lowerMessage.includes('ca') || lowerMessage.includes('chiffre') || lowerMessage.includes('revenu')) {
    if (lowerMessage.includes('réalisé') || lowerMessage.includes('realise')) {
      return 'ca_realise';
    }
    if (lowerMessage.includes('prévision') || lowerMessage.includes('prevision')) {
      return 'ca_prevision';
    }
    if (lowerMessage.includes('pipeline')) {
      return 'ca_pipeline';
    }
    return 'ca_total';
  }
  
  if (lowerMessage.includes('client')) {
    if (lowerMessage.includes('combien')) {
      return 'total_clients';
    }
    return 'clients_list';
  }
  
  if (lowerMessage.includes('action') || lowerMessage.includes('priorité') || lowerMessage.includes('faire')) {
    return 'priority_actions';
  }
  
  if (lowerMessage.includes('risque') || lowerMessage.includes('alerte')) {
    return 'risks_alerts';
  }
  
  if (lowerMessage.includes('breakeven') || lowerMessage.includes('point mort') || lowerMessage.includes('équilibre')) {
    return 'breakeven_analysis';
  }
  
  if (lowerMessage.includes('dépense') || lowerMessage.includes('dépense') && (lowerMessage.includes('ca') || lowerMessage.includes('comparer'))) {
    return 'ca_vs_expenses';
  }

  if (
    lowerMessage.includes('relancer') ||
    (lowerMessage.includes('client') && (lowerMessage.includes('relanc') || lowerMessage.includes('rappel')))
  ) {
    return 'clients_to_follow_up';
  }

  if (
    (lowerMessage.includes('chaud') || lowerMessage.includes('chaude')) &&
    (lowerMessage.includes('opportun') || lowerMessage.includes('affaire'))
  ) {
    return 'hot_opportunities';
  }

  if (
    lowerMessage.includes('bloqu') &&
    (lowerMessage.includes('dossier') || lowerMessage.includes('opportun') || lowerMessage.includes('affaire'))
  ) {
    return 'stalled_opportunities';
  }

  if (
    lowerMessage.includes('commercial') &&
    (lowerMessage.includes('perform') || lowerMessage.includes('meilleur') || lowerMessage.includes('classement'))
  ) {
    return 'sales_rep_leaderboard';
  }

  return 'unknown';
}

// Execute query based on intent
async function executeQuery(intent: string, organizationId: string) {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  switch (intent) {
    case 'predict_year_end': {
      const prediction = await predictYearEndCA(organizationId);
      return {
        type: 'prediction',
        title: 'Prédiction CA fin d\'année',
        caTotalAll: prediction.caTotalAll,
        caRealise: prediction.caRealise,
        predictedCA: prediction.predictedCA,
        pipelineCA: prediction.pipelineCA,
        pipelinePondere: prediction.pipelinePondere,
        avgMonthlyCA: prediction.avgMonthlyCA,
        growth: prediction.avgGrowth,
        monthsData: prediction.monthsData,
      };
    }
    
    case 'recommendations': {
      const prediction = await predictYearEndCA(organizationId);
      const recommendations = await generateRecommendations(organizationId, prediction);
      return {
        type: 'recommendations',
        title: 'Recommandations personnalisées',
        recommendations,
        prediction,
      };
    }
    
    case 'target_analysis': {
      const prediction = await predictYearEndCA(organizationId);
      const recommendations = await generateRecommendations(organizationId, prediction);
      const monthsRemaining = 12 - currentMonth;
      const monthlyTarget = prediction.predictedCA / 12;
      return {
        type: 'target_analysis',
        title: 'Analyse des objectifs',
        currentCA: prediction.caRealise,
        predictedCA: prediction.predictedCA,
        monthlyTarget,
        monthsRemaining,
        recommendations,
      };
    }

    case 'opportunities_this_week': {
      const weekAffaires = await prisma.affaire.findMany({
        where: {
          organizationId,
          deletedAt: null,
          createdAt: { gte: weekAgo },
        },
        include: { client: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      return {
        type: 'list',
        title: `Opportunités cette semaine (${weekAffaires.length})`,
        data: weekAffaires.map(a => ({
          client: a.client?.name || 'N/A',
          montant: Number(a.montantHT).toLocaleString('fr-TN') + ' DT',
          statut: a.statut,
        })),
      };
    }
    
    case 'opportunities_this_month': {
      const monthAffaires = await prisma.affaire.findMany({
        where: {
          organizationId,
          deletedAt: null,
          moisPrevu: currentMonth,
          anneePrevue: currentYear,
        },
        include: { client: { select: { name: true } } },
        orderBy: { montantHT: 'desc' },
        take: 150,
      });
      return {
        type: 'list',
        title: `Opportunités ce mois (${monthAffaires.length})`,
        data: monthAffaires.map((a: any) => ({
          client: a.client?.name || 'N/A',
          montant: Number(a.montantHT).toLocaleString('fr-TN') + ' DT',
          statut: a.statut,
          score: a.score || 0,
        })),
      };
    }
    
    case 'total_opportunities': {
      const totalAffaires = await prisma.affaire.count({
        where: { organizationId, deletedAt: null },
      });
      return {
        type: 'metric',
        title: 'Total opportunités',
        value: totalAffaires.toString(),
      };
    }
    
    case 'ca_realise': {
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear + 1, 0, 1);
      const [closedInYear, wonNoCloseInYear] = await Promise.all([
        prisma.affaire.aggregate({
          where: {
            organizationId,
            deletedAt: null,
            statut: 'GAGNE',
            dateClotureReelle: { gte: yearStart, lt: yearEnd },
          },
          _sum: { montantHT: true },
        }),
        prisma.affaire.aggregate({
          where: {
            organizationId,
            deletedAt: null,
            statut: 'GAGNE',
            dateClotureReelle: null,
            createdAt: { gte: yearStart, lt: yearEnd },
          },
          _sum: { montantHT: true },
        }),
      ]);
      const caRealiseCurrentYear =
        Number(closedInYear._sum.montantHT ?? 0) + Number(wonNoCloseInYear._sum.montantHT ?? 0);

      return {
        type: 'metric',
        title: `CA réalisé ${currentYear}`,
        value: caRealiseCurrentYear.toLocaleString('fr-TN') + ' DT',
      };
    }
    
    case 'ca_pipeline': {
      const pipelineAgg = await prisma.affaire.aggregate({
        where: {
          organizationId,
          deletedAt: null,
          statut: { in: ['QUALIFIE', 'PROPOSITION', 'NEGOCIATION'] },
          moisPrevu: currentMonth,
          anneePrevue: currentYear,
        },
        _sum: { montantHT: true },
      });
      const caPipeline = Number(pipelineAgg._sum.montantHT ?? 0);
      return {
        type: 'metric',
        title: `CA pipeline ce mois`,
        value: caPipeline.toLocaleString('fr-TN') + ' DT',
      };
    }
    
    case 'ca_total': {
      const agg = await prisma.affaire.aggregate({
        where: { organizationId, deletedAt: null },
        _sum: { montantHT: true },
      });
      const caTotal = Number(agg._sum.montantHT ?? 0);
      return {
        type: 'metric',
        title: 'CA total',
        value: caTotal.toLocaleString('fr-TN') + ' DT',
      };
    }
    
    case 'total_clients': {
      const totalClients = await prisma.client.count({
        where: { organizationId, deletedAt: null },
      });
      return {
        type: 'metric',
        title: 'Total clients',
        value: totalClients.toString(),
      };
    }
    
    case 'clients_list': {
      const clients = await prisma.client.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { name: true, email: true, phone: true },
      });
      return {
        type: 'list',
        title: `Derniers clients (${clients.length})`,
        data: clients.map(c => ({
          nom: c.name,
          email: c.email || 'N/A',
          telephone: c.phone || 'N/A',
        })),
      };
    }
    
    case 'priority_actions': {
      const highScoreAffaires = await prisma.affaire.findMany({
        where: {
          organizationId,
          deletedAt: null,
          statut: { in: ['PROSPECT', 'QUALIFIE', 'PROPOSITION', 'NEGOCIATION'] },
        },
        include: { client: { select: { name: true } } },
        orderBy: { montantHT: 'desc' },
        take: 5,
      });
      return {
        type: 'list',
        title: 'Actions prioritaires',
        data: (highScoreAffaires as any[]).map(a => ({
          client: a.client?.name || 'N/A',
          montant: Number(a.montantHT).toLocaleString('fr-TN') + ' DT',
        })),
      };
    }
    
    case 'risks_alerts': {
      const oldPipeline = await prisma.affaire.findMany({
        where: {
          organizationId,
          deletedAt: null,
          statut: { in: ['QUALIFIE', 'PROPOSITION', 'NEGOCIATION'] },
          createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        include: { client: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
        take: 40,
      });
      return {
        type: 'list',
        title: `Alertes opportunités à risque (${oldPipeline.length})`,
        data: (oldPipeline as any[]).map(a => ({
          client: a.client?.name || 'N/A',
          montant: Number(a.montantHT).toLocaleString('fr-TN') + ' DT',
          alerte: 'En pipeline depuis plus de 30 jours',
        })),
      };
    }
    
    case 'breakeven_analysis': {
      const [caAgg, expAgg] = await Promise.all([
        prisma.affaire.aggregate({
          where: { organizationId, deletedAt: null, statut: 'GAGNE' },
          _sum: { montantHT: true },
        }),
        prisma.expense.aggregate({
          where: { organizationId, deletedAt: null },
          _sum: { amount: true },
        }),
      ]);
      const caTotalBE = Number(caAgg._sum.montantHT ?? 0);
      const expensesTotal = Number(expAgg._sum.amount ?? 0);
      
      const profit = caTotalBE - expensesTotal;
      const margin = caTotalBE > 0 ? ((profit / caTotalBE) * 100).toFixed(1) : 0;
      const breakevenStatus = profit >= 0 ? 'Rentable' : 'Déficitaire';
      
      return {
        type: 'text',
        title: 'Analyse Breakeven',
        value: `CA Total: ${caTotalBE.toLocaleString('fr-TN')} DT\nDépenses: ${expensesTotal.toLocaleString('fr-TN')} DT\nProfit/Perte: ${profit.toLocaleString('fr-TN')} DT\nMarge: ${margin}%\nStatut: ${breakevenStatus}`,
      };
    }
    
    case 'ca_vs_expenses': {
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear + 1, 0, 1);
      const [caYearAgg, expYearAgg] = await Promise.all([
        prisma.affaire.aggregate({
          where: {
            organizationId,
            deletedAt: null,
            anneePrevue: currentYear,
          },
          _sum: { montantHT: true },
        }),
        prisma.expense.aggregate({
          where: {
            organizationId,
            deletedAt: null,
            date: { gte: yearStart, lt: yearEnd },
          },
          _sum: { amount: true },
        }),
      ]);
      const caYear = Number(caYearAgg._sum.montantHT ?? 0);
      const expensesYearTotal = Number(expYearAgg._sum.amount ?? 0);
      
      const ratio = caYear > 0 ? ((expensesYearTotal / caYear) * 100).toFixed(1) : 0;
      
      return {
        type: 'text',
        title: `Comparaison CA/Dépenses ${currentYear}`,
        value: `CA: ${caYear.toLocaleString('fr-TN')} DT\nDépenses: ${expensesYearTotal.toLocaleString('fr-TN')} DT\nRatio dépenses/CA: ${ratio}%`,
      };
    }

    case 'clients_to_follow_up': {
      const now = new Date();
      const rows = await prisma.affaire.findMany({
        where: {
          organizationId,
          deletedAt: null,
          statut: { in: ['PROSPECT', 'QUALIFIE', 'PROPOSITION', 'NEGOCIATION'] },
          OR: [
            { dateProchaineAction: { lt: now } },
            { updatedAt: { lt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) } },
          ],
        },
        include: { client: { select: { name: true } } },
        orderBy: { dateProchaineAction: 'asc' },
        take: 25,
      });
      return {
        type: 'list',
        title: `Contacts / dossiers à relancer (${rows.length})`,
        data: rows.map((a) => ({
          client: a.client?.name || 'N/A',
          statut: a.statut,
          prochaine: a.prochaineAction || '—',
          montant: Number(a.montantHT).toLocaleString('fr-TN') + ' DT',
        })),
      };
    }

    case 'hot_opportunities': {
      const briefing = await buildOperationalBriefing(organizationId);
      const top = briefing.hotOpportunities.slice(0, 12);
      return {
        type: 'list',
        title: 'Opportunités les plus chaudes (score IA)',
        data: top.map((o) => ({
          client: o.clientName || 'N/A',
          montant: o.montantHT.toLocaleString('fr-TN') + ' DT',
          niveau: o.iaLabelFr,
          chaleur: o.heatFr,
          proba_signature: `${o.signatureProbabilityPct}%`,
        })),
      };
    }

    case 'stalled_opportunities': {
      const briefing = await buildOperationalBriefing(organizationId);
      const stalled = briefing.alerts.slice(0, 20);
      return {
        type: 'list',
        title: `Dossiers à risque ou bloqués (${stalled.length})`,
        data: stalled.map((s) => ({
          client: s.clientName || 'N/A',
          detail: s.message,
          type: s.type,
        })),
      };
    }

    case 'sales_rep_leaderboard': {
      const rows = await prisma.affaire.groupBy({
        by: ['assignedToId'],
        where: {
          organizationId,
          deletedAt: null,
          statut: 'GAGNE',
          anneePrevue: currentYear,
          assignedToId: { not: null },
        },
        _sum: { montantHT: true },
        _count: true,
      });
      const users = await prisma.user.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      });
      const nm = Object.fromEntries(users.map((u) => [u.id, u.name]));
      const sorted = [...rows].sort((a, b) => Number(b._sum.montantHT ?? 0) - Number(a._sum.montantHT ?? 0));
      return {
        type: 'list',
        title: `CA gagné par commercial (${currentYear})`,
        data: sorted.map((r) => ({
          commercial: r.assignedToId ? nm[r.assignedToId] || r.assignedToId : '—',
          ca_gagne: Number(r._sum.montantHT ?? 0).toLocaleString('fr-TN') + ' DT',
          affaires: r._count,
        })),
      };
    }

    default:
      return {
        type: 'text',
        title: 'Je n\'ai pas compris',
        value: 'Essayez: "Combien d\'opportunités ?", "CA ce mois", "Actions prioritaires", "Alertes"',
      };
  }
}

// POST /api/ai-assistant/query
aiAssistantRoutes.post('/query', async (req: AuthRequest, res, next) => {
  try {
    if (!(await tryConsumeAgentQuota(req.organizationId!, 'copilot-ia', res))) return;

    const { message, language = 'fr' } = querySchema.parse(req.body);
    const organizationId = req.organizationId!;
    const lowerMessage = message.toLowerCase();
    const normalizedMessage = lowerMessage
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    // Dedicated onboarding helper for product adoption
    if (
      normalizedMessage.includes('onboarding') ||
      normalizedMessage.includes('demarrer') ||
      normalizedMessage.includes('commencer') ||
      normalizedMessage.includes('utiliser') ||
      normalizedMessage.includes('comment fonctionne') ||
      normalizedMessage.includes('guide') ||
      normalizedMessage.includes('prise en main')
    ) {
      const onboardingTextByLanguage = {
        fr:
          `🚀 Guide rapide KTOptima (prise en main)\n\n` +
          `1) Commencez par les Prospects\n` +
          `- Ajoutez vos leads dans "Prospects"\n` +
          `- Qualifiez-les (score, source, notes)\n` +
          `- Convertissez les leads chauds: client + affaire créés automatiquement\n\n` +
          `2) Pilotez vos ventes dans "Affaires"\n` +
          `- Vue Kanban = suivi visuel du pipeline\n` +
          `- Déplacez les affaires entre étapes (drag & drop)\n` +
          `- Suivez les prochaines actions et dates de relance\n\n` +
          `3) Gérez les données clients\n` +
          `- "Clients" pour la fiche client complète\n` +
          `- Historisez vos interactions et opportunités\n\n` +
          `4) Passez à l'exécution\n` +
          `- "Calendrier" pour RDV et rappels\n` +
          `- "Activités" pour les actions commerciales\n` +
          `- "Dépenses" pour le suivi rentabilité\n\n` +
          `5) Analysez et optimisez\n` +
          `- Utilisez KPI + IA Assistant pour priorités et prévisions CA\n` +
          `- Priorisez les affaires chaudes et les relances en retard\n\n` +
          `💡 Astuce: workflow recommandé = Prospect -> Conversion -> Affaire (Kanban) -> Activités/RDV -> Clôture gagnée.`,
        en:
          `🚀 KTOptima Quick Onboarding\n\n` +
          `1) Start with Prospects\n` +
          `- Add and qualify leads\n` +
          `- Convert hot leads (client + deal created automatically)\n\n` +
          `2) Manage sales in Deals\n` +
          `- Use Kanban for visual pipeline tracking\n` +
          `- Move deals between stages\n` +
          `- Track next actions and follow-up dates\n\n` +
          `3) Work your customer base\n` +
          `- Use Clients for complete account records\n\n` +
          `4) Execute daily\n` +
          `- Calendar for meetings and reminders\n` +
          `- Activities for sales tasks\n` +
          `- Expenses for profitability tracking\n\n` +
          `5) Optimize\n` +
          `- Use KPI + AI Assistant for priorities and forecasting.`,
        ar:
          `🚀 دليل سريع لاستخدام KTOptima\n\n` +
          `1) ابدأ من صفحة العملاء المحتملين\n` +
          `2) تابع المبيعات في لوحة Kanban\n` +
          `3) نظم العملاء والفرص\n` +
          `4) نفّذ يومياً عبر التقويم والأنشطة\n` +
          `5) حسّن الأداء عبر مؤشرات KPI والمساعد الذكي.`,
      } as const;

      res.json({
        intent: 'onboarding',
        result: {
          type: 'text',
          value: onboardingTextByLanguage[language as keyof typeof onboardingTextByLanguage] || onboardingTextByLanguage.fr,
        },
      });
      return;
    }

    // Use deterministic rule-based predictions for forecast-related queries
    if (
      normalizedMessage.includes('prevision') ||
      normalizedMessage.includes('prevoir') ||
      normalizedMessage.includes('prediction') ||
      normalizedMessage.includes('predire') ||
      normalizedMessage.includes('chiffre d\'affaires') ||
      normalizedMessage.includes('chiffre d affaires') ||
      normalizedMessage.includes('ca') ||
      normalizedMessage.includes('fin d\'annee') ||
      normalizedMessage.includes('fin d annee') ||
      normalizedMessage.includes('annee') ||
      normalizedMessage.includes('forecast') ||
      normalizedMessage.includes('revenu')
    ) {
      const prediction = await predictYearEndCA(organizationId);
      const recommendations = await generateRecommendations(organizationId, prediction);
      
      res.json({
        intent: 'prediction',
        result: {
          type: 'prediction',
          title: 'Prédiction CA fin d\'année',
          caTotalAll: prediction.caTotalAll,
          caRealise: prediction.caRealise,
          predictedCA: prediction.predictedCA,
          pipelineCA: prediction.pipelineCA,
          pipelinePondere: prediction.pipelinePondere,
          avgMonthlyCA: prediction.avgMonthlyCA,
          growth: prediction.avgGrowth,
          monthsData: prediction.monthsData,
          projectionMeta: prediction.projectionMeta,
          recommendations,
        },
      });
      return;
    }

    const structuredIntent = processQuery(message, organizationId);
    if (structuredIntent !== 'unknown') {
      const result = await executeQuery(structuredIntent, organizationId);
      res.json({ intent: structuredIntent, result });
      return;
    }

    // Use OpenAI for other queries (email drafting, general advice, etc.)
    const [affaires, clients, objectifs] = await Promise.all([
      prisma.affaire.findMany({
        where: { organizationId, deletedAt: null, statut: { not: 'PERDU' } },
        select: { title: true, montantHT: true, statut: true, probabilite: true, createdAt: true },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.client.findMany({
        where: { organizationId },
        select: { name: true, email: true, createdAt: true },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.salesObjective.findMany({
        where: { organizationId, year: new Date().getFullYear() },
        select: { targetAmount: true, month: true },
        take: 12,
      }),
    ]);

    const context = {
      affairesCount: affaires.length,
      clientsCount: clients.length,
      totalCA: affaires.reduce((sum, a) => sum + Number(a.montantHT), 0),
      recentAffaires: affaires.slice(0, 5).map(a => ({
        titre: a.title,
        statut: a.statut,
        montant: Number(a.montantHT),
        probabilite: a.probabilite,
      })),
      objectifs: objectifs.map(o => ({
        mois: o.month,
        cible: Number(o.targetAmount),
      })),
    };

    const languageInstructions = {
      fr: 'Réponds de manière professionnelle, concise et actionnable. En français.',
      en: 'Respond professionally, concisely, and in an actionable manner. In English.',
      ar: 'أجب بطريقة احترافية ومختصرة وقابلة للتنفيذ. باللغة العربية.',
    };

    const systemPrompt = `You are a professional CRM assistant and sales expert.
You help sales teams with:
- Pipeline analysis
- Strategic advice to improve conversions
- Personalized email drafting
- Lead scoring and recommendations
- Performance analysis

Current CRM context:
- Number of deals in progress: ${context.affairesCount}
- Number of clients: ${context.clientsCount}
- Total pipeline revenue: ${context.totalCA} DT

Recent deals:
${context.recentAffaires.map(a => `- ${a.titre}: ${a.montant} DT, status: ${a.statut}, probability: ${a.probabilite}%`).join('\n')}

Monthly objectives:
${context.objectifs.map(o => `- ${o.mois}: ${o.cible} DT`).join('\n') || 'No objectives defined'}

${languageInstructions[language as keyof typeof languageInstructions] || languageInstructions.fr}`;

    const aiResponse = await callOpenAI(message, systemPrompt);

    res.json({
      intent: 'ai_response',
      result: aiResponse,
      context: {
        affairesCount: context.affairesCount,
        clientsCount: context.clientsCount,
        totalCA: context.totalCA,
      },
    });
  } catch (e) { next(e); }
});

// POST /api/ai-assistant/draft-email - Draft personalized email with AI
aiAssistantRoutes.post('/draft-email', async (req: AuthRequest, res, next) => {
  try {
    if (!(await tryConsumeAgentQuota(req.organizationId!, 'copilot-ia', res))) return;

    const { clientId, affaireId, type, language = 'fr' } = req.body;

    let client, affaire;
    if (clientId) {
      client = await prisma.client.findFirst({
        where: { id: clientId, organizationId: req.organizationId, deletedAt: null },
        select: { name: true, email: true, phone: true },
      });
      if (!client) return res.status(404).json({ error: 'Client introuvable' });
    }
    if (affaireId) {
      affaire = await prisma.affaire.findFirst({
        where: { id: affaireId, organizationId: req.organizationId, deletedAt: null },
        select: { title: true, montantHT: true, statut: true, probabilite: true },
      });
      if (!affaire) return res.status(404).json({ error: 'Affaire introuvable' });
    }

    const emailPrompt = type === 'followup' 
      ? `Rédige un email de suivi professionnel pour ${client?.name || 'le client'}. 
         Contexte affaire: ${affaire?.title || 'Non spécifié'}, montant: ${affaire?.montantHT || 0} DT, statut: ${affaire?.statut}.
         Objectif: Relancer le client pour avancer l'affaire. Ton professionnel mais convaincant.`
      : type === 'proposal'
      ? `Rédige un email d'envoi de proposition pour ${client?.name || 'le client'}.
         Contexte affaire: ${affaire?.title || 'Non spécifié'}, montant: ${affaire?.montantHT || 0} DT.
         Objectif: Présenter la proposition et demander un rendez-vous. Ton professionnel et orienté action.`
      : `Rédige un email professionnel pour ${client?.name || 'le client'}.`;

    const languageInstructions = {
      fr: 'Rédige des emails professionnels, concis et orientés action. En français. Inclus un objet d\'email clair.',
      en: 'Write professional, concise, and action-oriented emails. In English. Include a clear email subject.',
      ar: 'اكتب رسائل بريدية احترافية ومختصرة وموجهة نحو العمل. باللغة العربية. أضف موضوعاً واضحاً للبريد الإلكتروني.',
    };

    const systemPrompt = `You are an expert in commercial email writing.
Write professional, concise, and action-oriented emails.
${languageInstructions[language as keyof typeof languageInstructions] || languageInstructions.fr}`;

    const aiResponse = await callOpenAI(emailPrompt, systemPrompt);

    res.json({
      emailDraft: aiResponse,
      clientName: client?.name,
      clientEmail: client?.email,
    });
  } catch (e) { next(e); }
});

// POST /api/ai-assistant/score-lead - Score lead with AI
aiAssistantRoutes.post('/score-lead', async (req: AuthRequest, res, next) => {
  try {
    if (!(await tryConsumeAgentQuota(req.organizationId!, 'copilot-ia', res))) return;

    const { affaireId } = req.body;

    const affaire = await prisma.affaire.findFirst({
      where: { id: affaireId, organizationId: req.organizationId, deletedAt: null },
      include: { client: true },
    });

    if (!affaire) {
      return res.status(404).json({ error: 'Affaire not found' });
    }

    const scoringPrompt = `Analyse cette opportunité et donne un score de 0 à 100 basé sur:
- Probabilité actuelle: ${affaire.probabilite}%
- Montant: ${affaire.montantHT} DT
- Statut: ${affaire.statut}
- Client: ${affaire.client?.name}
- Date création: ${affaire.createdAt}

Donne aussi 3 recommandations concrètes pour améliorer ce score.`;

    const aiResponse = await callOpenAI(scoringPrompt, 'Tu es un expert en scoring de leads commerciaux. Sois analytique et actionnable.');

    res.json({
      score: aiResponse,
      affaireId,
    });
  } catch (e) { next(e); }
});
