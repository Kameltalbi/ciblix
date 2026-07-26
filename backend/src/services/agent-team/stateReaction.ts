import type { AgentTask } from '@prisma/client';
import { ingestScribeInteraction } from '../company-fiche/scribeService.js';
import { enqueueAgentTask } from './agentTaskService.js';
import type { FicheAgent, FicheEtat } from '../company-fiche/types.js';

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * Réaction d’état → enqueue l’agent propriétaire de l’étape suivante.
 * Pas d’appel agent→agent : uniquement file de tâches.
 */
export async function reactToFicheStateChange(opts: {
  organizationId: string;
  contactId: string;
  etatNouveau: FicheEtat;
  prochainAgent: FicheAgent | null;
}): Promise<void> {
  const { organizationId, contactId, etatNouveau, prochainAgent } = opts;
  if (!prochainAgent || prochainAgent === 'humain' || prochainAgent === 'veilleur') return;

  if (prochainAgent === 'analyste' && etatNouveau === 'decouverte') {
    await enqueueAgentTask({
      organizationId,
      assignee: 'ANALYSTE',
      kind: 'ANALYZE_FIT',
      priority: 70,
      contactId,
      dedupeKey: `analyze:${contactId}`,
      payload: { triggeredBy: 'fiche_state', etat: etatNouveau },
    });
    return;
  }

  if (prochainAgent === 'redacteur' && etatNouveau === 'qualifiee') {
    await enqueueAgentTask({
      organizationId,
      assignee: 'COPILOT',
      kind: 'PREPARE_OUTREACH',
      priority: 65,
      contactId,
      dedupeKey: `outreach:${contactId}`,
      payload: { triggeredBy: 'fiche_state', etat: etatNouveau },
    });
  }
}

/** Handler Scribe — PROCESS_INTERACTION */
export async function handleProcessInteraction(task: AgentTask): Promise<Record<string, unknown>> {
  const payload = asRecord(task.payload);
  const texte = str(payload.texteBrut);
  const canal = (str(payload.canal) || 'note') as 'whatsapp' | 'email' | 'appel' | 'note' | 'vocal';
  if (!task.contactId || !texte) {
    return { skipped: true, reason: 'missing_contact_or_texte' };
  }

  const { getIntegrationUserId } = await import('../integrations/orgIntegrationUser.js');
  const userId = await getIntegrationUserId(task.organizationId);

  const result = await ingestScribeInteraction({
    organizationId: task.organizationId,
    contactId: task.contactId,
    userId,
    canal,
    texteBrut: texte,
  });

  return {
    etat: result.etat,
    needsHumanChoice: result.needsHumanChoice,
    options: result.options,
    champsEcrits: result.champsEcrits,
    raison: result.transition.raison,
  };
}
