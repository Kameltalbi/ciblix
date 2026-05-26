import { Router, type NextFunction, type Response } from 'express';
import auth, { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';

export const agentsRoutes = Router();

const AVAILABLE_AGENTS = [
  {
    slug: 'hunt-ai',
    name: 'Hunt AI',
    role: 'Prospection & qualification',
    description: 'Recherche d\'entreprises, enrichissement web, scoring IA et génération de messages de prospection.',
    icon: 'Radio',
    color: 'sky',
    features: ['Recherche Google Places / Outscraper', 'Enrichissement site web', 'Scoring IA (GPT-4o-mini)', 'Messages de prospection', 'Automatisation périodique'],
    route: '/prospection-ia',
    defaultActive: true,
  },
  {
    slug: 'copilot-ia',
    name: 'Copilot IA',
    role: 'Assistant de direction commerciale',
    description: 'Briefing opérationnel, chat conversationnel, prédictions CA et recommandations commerciales.',
    icon: 'Bot',
    color: 'violet',
    features: ['Briefing du jour', 'Chat IA conversationnel', 'Prédiction CA fin d\'année', 'Brouillons relances/emails', 'Scoring leads'],
    route: '/ai-assistant',
    defaultActive: true,
  },
  {
    slug: 'scout-ai',
    name: 'Scout AI',
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
    name: 'OffreBot',
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
    name: 'FactCheck AI',
    role: 'Vérification d\'informations en ligne',
    description: 'Vérifie la fiabilité des informations en croisant plusieurs sources web.',
    icon: 'ShieldCheck',
    color: 'emerald',
    features: ['Vérification d\'affirmations', 'Croisement multi-sources', 'Verdict avec confiance', 'Analyse fiabilité URL', 'Sources citées'],
    route: '/agents/factcheck-ai',
    defaultActive: false,
  },
];

agentsRoutes.use(auth);

/**
 * GET /api/agents
 * Liste tous les agents avec leur statut d'activation pour le tenant.
 */
agentsRoutes.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;

    const orgAgents = await prisma.organizationAgent.findMany({
      where: { organizationId: orgId },
    });

    const agentMap = new Map(orgAgents.map((a) => [a.agentSlug, a]));

    const agents = AVAILABLE_AGENTS.map((agent) => {
      const orgAgent = agentMap.get(agent.slug);
      const isActive = orgAgent ? orgAgent.active : agent.defaultActive;

      return {
        ...agent,
        active: isActive,
        activatedAt: orgAgent?.activatedAt || null,
      };
    });

    res.json({ agents });
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

    const orgAgents = await prisma.organizationAgent.findMany({
      where: { organizationId: orgId },
    });

    const agentMap = new Map(orgAgents.map((a) => [a.agentSlug, a]));

    const activeSlugs = AVAILABLE_AGENTS
      .filter((agent) => {
        const orgAgent = agentMap.get(agent.slug);
        return orgAgent ? orgAgent.active : agent.defaultActive;
      })
      .map((a) => a.slug);

    res.json({ activeSlugs });
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
    const { slug } = req.params;
    const orgId = req.organizationId!;

    if (!AVAILABLE_AGENTS.find((a) => a.slug === slug)) {
      res.status(404).json({ error: 'Agent not found' });
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
    const { slug } = req.params;
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
