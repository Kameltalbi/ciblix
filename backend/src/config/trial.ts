import type { AgentSlug } from './agentPlans.js';

/** Durée de l'essai gratuit (jours). Source de vérité unique. */
export const TRIAL_DURATION_DAYS = 7;

/**
 * Agents activés pendant l'essai — indépendants du tier choisi à l'inscription.
 * Flotte commerciale : Prospecteur · Assistant · Veilleur · Analyste (+ capacités Assistant).
 */
export const TRIAL_AGENTS = [
  'hunt-ai',
  'copilot-ia',
  'scout-ai',
  'analyste-ai',
  'offre-bot',
] as const satisfies readonly AgentSlug[];

export type TrialAgentSlug = (typeof TRIAL_AGENTS)[number];

export const TRIAL_AGENT_LABELS: Record<TrialAgentSlug, string> = {
  'hunt-ai': 'Prospecteur',
  'copilot-ia': 'Assistant',
  'scout-ai': 'Veilleur',
  'analyste-ai': 'Analyste',
  'offre-bot': 'Propositions (Assistant)',
};

/** Quota dédié à l'essai — volontairement indépendant des quotas par tier. */
export const TRIAL_QUOTA = {
  agentActionsLimit: 200,
  overageAllowed: false,
} as const;

/** Agent appliqué si Découverte expire sans choix explicite. */
export const DEFAULT_DISCOVERY_AGENT: TrialAgentSlug = 'copilot-ia';

export function isTrialAgentSlug(slug: string): slug is TrialAgentSlug {
  return (TRIAL_AGENTS as readonly string[]).includes(slug);
}
