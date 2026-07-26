import { assertAgentMayWrite, isOwnedField } from './fieldOwnership.js';
import {
  assertAutoTransition,
  nextAgentAfterTransition,
} from './stateMachine.js';
import type {
  FicheAgent,
  FicheEntrepriseData,
  FicheEtat,
  FicheOwnedField,
  FicheTransitionLog,
} from './types.js';

export type ApplyAgentWriteInput = {
  tenantId: string;
  ficheId: string;
  agent: Exclude<FicheAgent, 'humain' | 'veilleur'>;
  etatActuel: FicheEtat | null;
  dataActuelle: FicheEntrepriseData;
  /** Patch — seules les clés présentes sont écrites ; ownership vérifié. */
  patch: Partial<FicheEntrepriseData>;
  /** Nouvel état demandé (après condition de sortie). */
  etatCible: FicheEtat;
  raison: string;
  conditionSortieRemplie: boolean;
};

export type ApplyAgentWriteResult = {
  data: FicheEntrepriseData;
  etat: FicheEtat;
  champsEcrits: FicheOwnedField[];
  transition: FicheTransitionLog;
};

/**
 * Applique un patch agent sous contrat de propriété + transition d’état.
 * Pure (pas d’I/O) — la persistence est dans ficheService.
 */
export function applyAgentWrite(input: ApplyAgentWriteInput): ApplyAgentWriteResult {
  const keys = Object.keys(input.patch).filter((k) => input.patch[k as keyof FicheEntrepriseData] !== undefined);
  const ownedKeys = keys.filter(isOwnedField);
  assertAgentMayWrite(input.agent, ownedKeys);

  // Interdit d’écrire des champs hors contrat via ce chemin
  const unknownOwned = keys.filter((k) => !isOwnedField(k) && k !== 'block_reason' && k !== 'archive_reason');
  if (unknownOwned.length) {
    // métadonnées block/archive ok ; autres clés rejetées
    const bad = unknownOwned.filter((k) => k !== 'block_reason' && k !== 'archive_reason');
    if (bad.length) {
      throw new Error(`Champs hors contrat fiche : ${bad.join(', ')}`);
    }
  }

  assertAutoTransition(input.agent, input.etatActuel, input.etatCible);

  const data: FicheEntrepriseData = { ...input.dataActuelle };
  for (const k of ownedKeys) {
    const v = input.patch[k];
    if (k === 'historique_interactions' && Array.isArray(v)) {
      const prev = data.historique_interactions || [];
      data.historique_interactions = [...prev, ...(v as NonNullable<FicheEntrepriseData['historique_interactions']>)];
    } else if (k === 'signaux_externes' && Array.isArray(v)) {
      const prev = data.signaux_externes || [];
      data.signaux_externes = [...prev, ...(v as NonNullable<FicheEntrepriseData['signaux_externes']>)];
    } else {
      (data as Record<string, unknown>)[k] = v;
    }
  }
  if (input.patch.block_reason !== undefined) data.block_reason = input.patch.block_reason;
  if (input.patch.archive_reason !== undefined) data.archive_reason = input.patch.archive_reason;

  const prochain = nextAgentAfterTransition(input.etatCible);
  const transition: FicheTransitionLog = {
    fiche_id: input.ficheId,
    tenant_id: input.tenantId,
    etat_precedent: input.etatActuel,
    etat_nouveau: input.etatCible,
    agent_emetteur: input.agent,
    champs_ecrits: ownedKeys,
    condition_sortie_remplie: input.conditionSortieRemplie,
    raison: input.raison,
    prochain_agent: prochain,
    horodatage: new Date().toISOString(),
  };

  return { data, etat: input.etatCible, champsEcrits: ownedKeys, transition };
}

/** Veilleur : append-only sur signaux_externes, sans changer l’état de chaîne. */
export function applyVeilleurSignal(
  dataActuelle: FicheEntrepriseData,
  signal: NonNullable<FicheEntrepriseData['signaux_externes']>[number]
): FicheEntrepriseData {
  assertAgentMayWrite('veilleur', ['signaux_externes']);
  if (!signal.source_ref?.trim()) {
    throw new Error('Signal Veilleur non sourcé — non injecté');
  }
  const list = [...(dataActuelle.signaux_externes || []), signal];
  return { ...dataActuelle, signaux_externes: list };
}
