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
import { isTrialAgentSlug } from '../config/trial.js';
import { resolveOrganizationPlan } from '../middleware/planRestrictions.js';
import { getOrganizationAgentUsageSummary } from '../services/agentUsage.js';

export const agentsRoutes = Router();

const AVAILABLE_AGENTS = [
  {
    slug: 'hunt-ai',
    name: 'Prospecteur',
    role: 'Trouver de nouveaux clients',
    whenToUse:
      'Quand vous voulez une liste d’entreprises à contacter (secteur + ville), déjà scorées et prêtes à relancer.',
    description:
      'Identifie les entreprises correspondant à vos critères, enrichit les contacts, qualifie les prospects et prépare vos campagnes de prospection.',
    icon: 'Crosshair',
    color: 'sky',
    features: ['Recherche par critères métier', 'Enrichissement contacts', 'Scoring IA', 'Messages de prospection', 'Automatisation périodique'],
    route: '/prospection-ia',
    defaultActive: false,
  },
  {
    slug: 'scout-ai',
    name: 'Veilleur',
    role: 'Détecter les opportunités d’affaires',
    whenToUse:
      'Quand vous voulez être alerté sur des appels d’offres, investissements, recrutements ou signaux marché.',
    description:
      'Surveille en continu AO, marchés publics et signaux pour identifier de nouvelles opportunités.',
    icon: 'Radar',
    color: 'blue',
    features: ['Appels d’offres', 'Signaux marché', 'Alertes scorées', 'Analyse d’URL', 'Sauvegarde d’opportunités'],
    route: '/agents/scout-ai',
    defaultActive: false,
  },
  {
    slug: 'analyste-ai',
    name: 'Analyste',
    role: 'Analyser les entreprises',
    whenToUse:
      'Quand vous devez préparer une approche : activité, décideurs, concurrents et potentiel.',
    description:
      'Étudie les entreprises cibles pour produire un brief d’approche avant contact.',
    icon: 'Search',
    color: 'indigo',
    features: ['Brief entreprise', 'Décideurs', 'Concurrents', 'Angles d’approche', 'Prochaines actions'],
    route: '/agents/analyste-ai',
    defaultActive: false,
  },
  {
    slug: 'copilot-ia',
    name: 'Assistant',
    role: 'Piloter vos actions commerciales',
    whenToUse:
      'Quand vous voulez coordonner les autres agents, savoir qui relancer, ou préparer emails, CR et propositions.',
    description:
      'Chef d’orchestre Ciblix : coordonne Prospecteur, Veilleur et Analyste, recommande les prochaines actions et prépare vos documents commerciaux.',
    icon: 'Bot',
    color: 'violet',
    features: ['Coordination des agents', 'Briefing du jour', 'Chat IA', 'Emails & CR', 'Propositions commerciales'],
    route: '/ai-assistant',
    defaultActive: false,
  },
  {
    slug: 'offre-bot',
    name: 'Propositions',
    role: 'Capacité de l’Assistant',
    whenToUse: 'Accessible via l’Assistant pour générer une proposition commerciale.',
    description: 'Capacité intégrée à l’Assistant — pas un agent de la flotte commerciale.',
    icon: 'FileSignature',
    color: 'amber',
    features: ['Génération offre', 'Ton personnalisable', 'Export texte'],
    route: '/agents/offre-bot',
    defaultActive: false,
    showInFleet: false,
  },
  {
    slug: 'gmail-ai',
    name: 'Gmail',
    role: 'Connecteur messagerie',
    whenToUse:
      'Quand vous voulez connecter Gmail pour que les agents analysent les emails et préparent des brouillons.',
    description:
      'Connecteur : lit les nouveaux mails, résume et prépare une réponse. Accessible depuis Connecteurs — pas un agent de la flotte.',
    icon: 'Mail',
    color: 'red',
    features: [
      'Sync des nouveaux e-mails uniquement',
      'Résumé IA',
      'Brouillon de réponse dans Gmail',
      'Libellé « Réponse à valider »',
      'Validation humaine avant envoi',
    ],
    route: '/agents/gmail-ai',
    defaultActive: false,
    showInFleet: false,
  },
  {
    slug: 'connect-ai',
    name: 'LinkedIn',
    role: 'Messages LinkedIn depuis la fiche',
    whenToUse:
      'Quand vous voulez préparer un message LinkedIn, le copier depuis la fiche contact, puis l’envoyer vous-même.',
    description:
      'Pas d’extension à installer. Le message se prépare sur la fiche contact : copiez, collez sur LinkedIn, envoyez.',
    icon: 'Link2',
    color: 'blue',
    features: [
      'Message IA sur la fiche',
      'Copier vers LinkedIn',
      'Envoi manuel (vous validez)',
      'Même flux que WhatsApp / email',
    ],
    route: '/agents/connect-ai',
    defaultActive: false,
  },
  {
    slug: 'factcheck-ai',
    name: 'Vérificateur IA',
    role: 'Capacité transverse (non commercialisé)',
    whenToUse: 'Utilisé en interne par les agents — pas un produit standalone.',
    description: 'Masqué de la flotte : la vérification est une capacité des agents, pas un agent à part.',
    icon: 'ShieldCheck',
    color: 'emerald',
    features: ['Vérification d\'affirmations', 'Croisement multi-sources'],
    route: '/agents/factcheck-ai',
    defaultActive: false,
    showInFleet: false,
  },
  {
    slug: 'brand-pulse-ai',
    name: 'BrandPulse AI',
    role: 'Marketing / SEO (hors scope commercial)',
    whenToUse: 'Produit marketing séparé — hors flotte commerciale Ciblix.',
    description: 'Masqué de la flotte : pas de lien direct avec le développement commercial.',
    icon: 'Megaphone',
    color: 'rose',
    features: ['Score marque', 'Audit SEO', 'Pipeline blog'],
    route: '/agents/brand-pulse',
    defaultActive: false,
    showInFleet: false,
  },
];

agentsRoutes.use(auth);

function buildAgentResponse(
  agent: (typeof AVAILABLE_AGENTS)[number],
  orgAgent: { active: boolean; activatedAt: Date | null } | undefined,
  plan: ReturnType<typeof normalizePlan>,
  opts?: { trialing?: boolean },
) {
  const trialIncluded = Boolean(opts?.trialing && isTrialAgentSlug(agent.slug));
  const includedInPlan = trialIncluded || isAgentIncludedInPlan(plan, agent.slug);
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

async function isOrgTrialing(organizationId: string): Promise<boolean> {
  const sub = await prisma.billingSubscription.findUnique({
    where: { organizationId },
    select: { status: true },
  });
  return sub?.status === 'TRIALING';
}

/**
 * GET /api/agents
 * Liste tous les agents avec leur statut d'activation pour le tenant.
 */
agentsRoutes.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const plan = await resolveOrganizationPlan(orgId);
    const trialing = await isOrgTrialing(orgId);

    const orgAgents = await prisma.organizationAgent.findMany({
      where: { organizationId: orgId },
    });

    const agentMap = new Map(orgAgents.map((a) => [a.agentSlug, a]));

    const agents = AVAILABLE_AGENTS.filter((agent) => agent.showInFleet !== false).map((agent) =>
      buildAgentResponse(agent, agentMap.get(agent.slug), plan, { trialing }),
    );

    res.json({ agents, plan, planLabel: PLAN_AGENT_LABELS[plan], trialing });
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
    const trialing = await isOrgTrialing(orgId);

    const orgAgents = await prisma.organizationAgent.findMany({
      where: { organizationId: orgId },
    });

    const agentMap = new Map(orgAgents.map((a) => [a.agentSlug, a]));

    const activeSlugs = AVAILABLE_AGENTS
      .filter((agent) => agent.showInFleet !== false)
      .filter((agent) => buildAgentResponse(agent, agentMap.get(agent.slug), plan, { trialing }).active)
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
    const trialing = await isOrgTrialing(orgId);
    const allowed = (trialing && isTrialAgentSlug(slug)) || isAgentIncludedInPlan(plan, slug);
    if (!allowed) {
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

    if (slug === 'gmail-ai' && req.userId) {
      try {
        const { ensureGmailAiSyncState } = await import('../services/gmail-ai/sync.js');
        await ensureGmailAiSyncState({
          userId: req.userId,
          organizationId: orgId,
        });
      } catch (syncErr) {
        // Gmail peut ne pas être connecté encore — l'UI guidera la connexion.
        console.warn('[agents] gmail-ai activate-sync deferred', syncErr);
      }
    }

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
