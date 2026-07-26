import type { FicheAgent, FicheEtat } from './types.js';

/**
 * Machine à états de la fiche entreprise.
 * Aucune boucle automatique — seul l’humain peut revenir en arrière.
 */

/** Transitions automatiques autorisées (agent → états cibles). */
const AUTO_TRANSITIONS: Record<
  Exclude<FicheAgent, 'humain' | 'veilleur'>,
  Partial<Record<FicheEtat, FicheEtat[]>>
> = {
  prospecteur: {
    // création → decouverte (état initial, pas de précédent)
  },
  analyste: {
    decouverte: ['qualifiee', 'archivee', 'bloquee_humain'],
  },
  redacteur: {
    qualifiee: ['contactee', 'bloquee_humain'],
  },
  scribe: {
    qualifiee: ['en_discussion', 'contactee', 'bloquee_humain'], // note après contact hors flux
    contactee: ['en_discussion', 'gagnee', 'perdue', 'bloquee_humain'],
    en_discussion: ['en_discussion', 'gagnee', 'perdue', 'bloquee_humain'],
  },
};

/** Depuis n’importe quel état actif → archivee / bloquee_humain / reset humain */
const TERMINAL: FicheEtat[] = ['gagnee', 'perdue', 'archivee'];

export function isTerminalEtat(etat: FicheEtat): boolean {
  return TERMINAL.includes(etat);
}

export function agentForIncomingEtat(etat: FicheEtat): FicheAgent | null {
  switch (etat) {
    case 'decouverte':
      return 'analyste';
    case 'qualifiee':
      return 'redacteur';
    case 'contactee':
    case 'en_discussion':
      return 'scribe';
    default:
      return null;
  }
}

/**
 * Agent déclenché quand la fiche arrive dans cet état
 * (réaction orchestrateur — pas un appel agent→agent).
 */
export function nextAgentAfterTransition(etatNouveau: FicheEtat): FicheAgent | null {
  return agentForIncomingEtat(etatNouveau);
}

export function canAutoTransition(
  agent: Exclude<FicheAgent, 'humain' | 'veilleur'>,
  from: FicheEtat | null,
  to: FicheEtat
): boolean {
  if (from === null) {
    // Prospecteur crée toujours en decouverte
    return agent === 'prospecteur' && to === 'decouverte';
  }
  if (from === to && agent === 'scribe' && (from === 'en_discussion' || from === 'contactee')) {
    return true; // mise à jour CRM sans changer d’état
  }
  const table = AUTO_TRANSITIONS[agent];
  const allowed = table[from];
  return Boolean(allowed?.includes(to));
}

/** Humain seul peut forcer un retour arrière ou une archive depuis n’importe où. */
export function canHumanTransition(from: FicheEtat, to: FicheEtat): boolean {
  if (from === to) return true;
  if (to === 'archivee' || to === 'bloquee_humain') return true;
  // Reset autorisé vers un état antérieur uniquement par humain
  return true;
}

export class IllegalTransitionError extends Error {
  constructor(
    public readonly agent: FicheAgent,
    public readonly from: FicheEtat | null,
    public readonly to: FicheEtat
  ) {
    super(`Transition interdite : ${agent} ${from ?? '∅'} → ${to}`);
    this.name = 'IllegalTransitionError';
  }
}

export function assertAutoTransition(
  agent: Exclude<FicheAgent, 'humain' | 'veilleur'>,
  from: FicheEtat | null,
  to: FicheEtat
): void {
  if (!canAutoTransition(agent, from, to)) {
    throw new IllegalTransitionError(agent, from, to);
  }
}
