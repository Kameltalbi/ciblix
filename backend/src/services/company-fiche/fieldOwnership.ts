import {
  AGENT_OWNED_FIELDS,
  FIELD_OWNER,
  FieldOwnershipError,
  type FicheAgent,
  type FicheOwnedField,
} from './types.js';

const ALL_OWNED = new Set<string>(Object.keys(FIELD_OWNER));

/**
 * Vérifie qu’un agent n’écrit que dans ses champs exclusifs.
 * Test le plus important de l’architecture — empêche la re-dégradation.
 */
export function assertAgentMayWrite(
  agent: Exclude<FicheAgent, 'humain'>,
  fields: readonly string[]
): asserts fields is FicheOwnedField[] {
  const owned = new Set<string>(AGENT_OWNED_FIELDS[agent]);
  const forbidden = fields.filter((f) => !owned.has(f));
  if (forbidden.length > 0) {
    throw new FieldOwnershipError(agent, forbidden);
  }
}

/** Filtre un patch : ne conserve que les champs autorisés pour l’agent. */
export function pickOwnedFields<T extends Record<string, unknown>>(
  agent: Exclude<FicheAgent, 'humain'>,
  patch: T
): Partial<T> {
  const owned = new Set<string>(AGENT_OWNED_FIELDS[agent]);
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (owned.has(k)) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** Liste les champs d’un patch qui violent le contrat (sans throw). */
export function findOwnershipViolations(
  agent: Exclude<FicheAgent, 'humain'>,
  fields: readonly string[]
): string[] {
  const owned = new Set<string>(AGENT_OWNED_FIELDS[agent]);
  return fields.filter((f) => ALL_OWNED.has(f) && !owned.has(f));
}

export function ownerOf(field: FicheOwnedField): Exclude<FicheAgent, 'humain'> {
  return FIELD_OWNER[field];
}

/** True si le champ est dans le contrat (champ « fiche ») — hors métadonnées libres. */
export function isOwnedField(field: string): field is FicheOwnedField {
  return ALL_OWNED.has(field);
}
