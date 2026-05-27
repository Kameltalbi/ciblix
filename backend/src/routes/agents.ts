import { Router, type NextFunction, type Response } from 'express';
import auth, { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import {
  getMinimumPlanForAgent,
  isAgentIncludedInPlan,
  normalizePlan,
  PLAN_AGENT_LABELS,
  syncAgentsForPlan,
} from '../config/agentPlans.js';
import { resolveOrganizationPlan } from '../middleware/planRestrictions.js';
import { getOrganizationAgentUsageSummary } from '../services/agentUsage.js';

export const agentsRoutes = Router();

const AVAILABLE_AGENTS = [
  {
    slug: 'hunt-ai',
    name: 'Chasseur IA',
    role: 'Prospection & qualification',
    description: 'Recherche d\'entreprises ciblées par secteur et zone, scoring IA et messages de prospection personnalisés.',
    icon: 'Radio',
    color: 'sky',
    features: ['Recherche par critères métier', 'Qualification automatique', 'Scoring IA', 'Messages de prospection', 'Automatisation périodique'],
    route: '/prospection-ia',
    defaultActive: false,
  },
  {
    slug: 'copilot-ia',
    name: 'Assistant IA',
    role: 'Assistant commercial',
    description: 'Briefing opérationnel, chat conversationnel, prédictions CA et recommandations commerciales.',
    icon: 'Bot',
    color: 'violet',
    features: ['Briefing du jour', 'Chat IA conversationnel', 'Prédiction CA fin d\'année', 'Brouillons relances/emails', 'Scoring leads'],
    route: '/ai-assistant',
    defaultActive: false,
  },
  {
    slug: 'scout-ai',
    name: 'Veilleur IA',
    role: 'Veille & détection d\'opportunités',
    description: 'Surveille les appels d\'offres, détecte les événements et alerte sur les opportunités pertinentes.',
    icon: 'Radar',
    color: 'blue',
    features: ['Recherche appels d\'offres', 'Détection événements/salons', 'Analyse IA des résultats', 'Analyse d\'URL', 'Sauvegarde d\'opportunités'],
    route: '/agents/scout-ai',
    defaultActive: false,
  },
  {
    slug: 'offre-bot',
    name: 'Rédacteur d\'offres',
    role: 'Préparation d\'offres commerciales',
    description: 'Génère des propositions commerciales personnalisées à partir des données client et affaire.',
    icon: 'FileSignature',
    color: 'amber',
    features: ['Génération offre depuis affaire CRM', 'Ton personnalisable', 'Conditions générales auto', 'Export texte', 'Régénération par section'],
    route: '/agents/offre-bot',
    defaultActive: false,
  },
  {
    slug: 'factcheck-ai',
    name: 'Vérificateur IA',
    role: 'Vérification d\'informations',
    description: 'Vérifie la fiabilité des informations en croisant plusieurs sources web.',
    icon: 'ShieldCheck',
    color: 'emerald',
    features: ['Vérification d\'affirmations', 'Croisement multi-sources', 'Verdict avec confiance', 'Analyse fiabilité URL', 'Sources citées'],
    route: '/agents/factcheck-ai',
    defaultActive: false,
  },
  {
    slug: 'comm-bot',
    name: 'CommBot',
    role: 'Marketing & contenu B2B',
    description: 'Produit des contenus SEO, posts LinkedIn, newsletters, fiches produits et pages services pour améliorer votre visibilité.',
    icon: 'Megaphone',
    color: 'rose',
    features: ['Articles SEO', 'Posts LinkedIn', 'Newsletters B2B', 'Fiches produits', 'Pages services'],
    route: '/agents/comm-bot',
    defaultActive: false,
  },
];

agentsRoutes.use(auth);

function buildAgentResponse(
  agent: (typeof AVAILABLE_AGENTS)[number],
  orgAgent: { active: boolean; activatedAt: Date | null } | undefined,
  plan: ReturnType<typeof normalizePlan>,
) {
  const includedInPlan = isAgentIncludedInPlan(plan, agent.slug);
  const requiredPlan = getMinimumPlanForAgent(agent.slug);
  const isActive = includedInPlan && (orgAgent ? orgAgent.active : true);

  return {
    ...agent,
    active: isActive,
    activatedAt: orgAgent?.activatedAt || null,
    includedInPlan,
    canActivate: includedInPlan,
    requiredPlan,
    requiredPlanLabel: requiredPlan ? PLAN_AGENT_LABELS[requiredPlan] : null,
  };
}

/**
 * GET /api/agents
 * Liste tous les agents avec leur statut d'activation pour le tenant.
 */
agentsRoutes.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const plan = await resolveOrganizationPlan(orgId);

    const orgAgents = await prisma.organizationAgent.findMany({
      where: { organizationId: orgId },
    });

    const agentMap = new Map(orgAgents.map((a) => [a.agentSlug, a]));

    const agents = AVAILABLE_AGENTS.map((agent) =>
      buildAgentResponse(agent, agentMap.get(agent.slug), plan),
    );

    res.json({ agents, plan, planLabel: PLAN_AGENT_LABELS[plan] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/agents/active-slugs
 * Retourne uniquement les slugs des agents actifs (pour la sidebar).
 */
agentsRoutes.get('/active-slugs', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const plan = await resolveOrganizationPlan(orgId);

    const orgAgents = await prisma.organizationAgent.findMany({
      where: { organizationId: orgId },
    });

    const agentMap = new Map(orgAgents.map((a) => [a.agentSlug, a]));

    const activeSlugs = AVAILABLE_AGENTS
      .filter((agent) => buildAgentResponse(agent, agentMap.get(agent.slug), plan).active)
      .map((a) => a.slug);

    res.json({ activeSlugs });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/agents/usage
 * Consommation mensuelle des quotas IA par agent.
 */
agentsRoutes.get('/usage', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const plan = await resolveOrganizationPlan(orgId);
    const usage = await getOrganizationAgentUsageSummary(orgId, plan);
    res.json({ plan, planLabel: PLAN_AGENT_LABELS[plan], usage });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/agents/:slug/activate
 * Active un agent pour le tenant.
 */
agentsRoutes.post('/:slug/activate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const slug = req.params.slug as string;
    const orgId = req.organizationId!;

    if (!AVAILABLE_AGENTS.find((a) => a.slug === slug)) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const plan = await resolveOrganizationPlan(orgId);
    if (!isAgentIncludedInPlan(plan, slug)) {
      const requiredPlan = getMinimumPlanForAgent(slug) ?? 'ENTERPRISE';
      res.status(403).json({
        error: 'Agent not available in your plan',
        agentSlug: slug,
        currentPlan: plan,
        requiredPlan,
        requiredPlanLabel: PLAN_AGENT_LABELS[requiredPlan],
      });
      return;
    }

    const agent = await prisma.organizationAgent.upsert({
      where: { organizationId_agentSlug: { organizationId: orgId, agentSlug: slug } },
      update: { active: true, activatedAt: new Date(), deactivatedAt: null },
      create: { organizationId: orgId, agentSlug: slug, active: true },
    });

    res.json({ activated: true, agent });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/agents/:slug/deactivate
 * Desactive un agent pour le tenant.
 */
agentsRoutes.post('/:slug/deactivate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const slug = req.params.slug as string;
    const orgId = req.organizationId!;

    if (!AVAILABLE_AGENTS.find((a) => a.slug === slug)) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const agent = await prisma.organizationAgent.upsert({
      where: { organizationId_agentSlug: { organizationId: orgId, agentSlug: slug } },
      update: { active: false, deactivatedAt: new Date() },
      create: { organizationId: orgId, agentSlug: slug, active: false },
    });

    res.json({ deactivated: true, agent });
  } catch (err) {
    next(err);
  }
});
