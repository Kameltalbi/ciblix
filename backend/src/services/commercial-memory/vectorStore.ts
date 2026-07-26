/**
 * Index vectoriel mémoire commerciale — scopé par organizationId (tenant).
 *
 * CONTRAT : organizationId est obligatoire sur TOUTE écriture et TOUTE lecture.
 * Un index partagé sans filtre tenant est une fuite RAG classique — interdit.
 */

export type MemoryChunkKind =
  | 'historique_interactions'
  | 'besoin_detecte'
  | 'objections_detectees'
  | 'notes'
  | 'raison_du_score';

export type MemoryVectorChunk = {
  id: string;
  organizationId: string;
  contactId: string;
  kind: MemoryChunkKind;
  contentText: string;
  embedding: number[];
  updatedAt: Date;
};

export type VectorUpsertInput = {
  organizationId: string;
  contactId: string;
  kind: MemoryChunkKind;
  contentText: string;
  embedding: number[];
  /** Si fourni, upsert sur cet id ; sinon id dérivé org+contact+kind */
  id?: string;
};

export type VectorSearchInput = {
  /** Obligatoire — injecté depuis le contexte auth, jamais depuis le client seul. */
  organizationId: string;
  queryEmbedding: number[];
  limit?: number;
  /** Filtre optionnel post-isolation (toujours après le scope tenant). */
  contactIds?: string[];
};

export type VectorSearchHit = {
  chunk: MemoryVectorChunk;
  score: number;
};

export class TenantScopeRequiredError extends Error {
  constructor(op: string) {
    super(`VECTOR_TENANT_SCOPE_REQUIRED — ${op} sans organizationId`);
    this.name = 'TenantScopeRequiredError';
  }
}

export function assertTenantScope(organizationId: string | null | undefined, op: string): string {
  if (!organizationId || typeof organizationId !== 'string' || !organizationId.trim()) {
    throw new TenantScopeRequiredError(op);
  }
  return organizationId.trim();
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function chunkId(organizationId: string, contactId: string, kind: MemoryChunkKind): string {
  return `${organizationId}:${contactId}:${kind}`;
}

/** Port d’index — toute implémentation DOIT passer vectorIsolation.test.ts */
export interface TenantScopedVectorIndex {
  upsert(input: VectorUpsertInput): Promise<MemoryVectorChunk>;
  search(input: VectorSearchInput): Promise<VectorSearchHit[]>;
  /** Debug / tests : liste brute filtrée (toujours scopée). */
  listForTenant(organizationId: string): Promise<MemoryVectorChunk[]>;
}

/** Embedder déterministe pour tests (pas d’appel réseau). */
export function deterministicEmbed(text: string, dims = 32): number[] {
  const v = new Array(dims).fill(0) as number[];
  const tokens = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9\u0600-\u06ff]+/)
    .filter(Boolean);
  for (const t of tokens) {
    let h = 0;
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
    v[h % dims]! += 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export function createInMemoryVectorIndex(): TenantScopedVectorIndex {
  const byId = new Map<string, MemoryVectorChunk>();

  return {
    async upsert(input) {
      const organizationId = assertTenantScope(input.organizationId, 'upsert');
      const contactId = input.contactId?.trim();
      if (!contactId) throw new Error('contactId_required');
      if (!input.embedding?.length) throw new Error('embedding_required');

      const id = input.id || chunkId(organizationId, contactId, input.kind);
      const existing = byId.get(id);
      // Empêche de « déplacer » un chunk vers un autre tenant
      if (existing && existing.organizationId !== organizationId) {
        throw new TenantScopeRequiredError('upsert_cross_tenant');
      }
      const chunk: MemoryVectorChunk = {
        id,
        organizationId,
        contactId,
        kind: input.kind,
        contentText: input.contentText,
        embedding: input.embedding,
        updatedAt: new Date(),
      };
      byId.set(id, chunk);
      return chunk;
    },

    async search(input) {
      const organizationId = assertTenantScope(input.organizationId, 'search');
      const limit = Math.min(20, Math.max(1, input.limit ?? 8));
      const allow = input.contactIds ? new Set(input.contactIds) : null;

      const hits: VectorSearchHit[] = [];
      for (const chunk of byId.values()) {
        // Isolation : filtre tenant AVANT similarité
        if (chunk.organizationId !== organizationId) continue;
        if (allow && !allow.has(chunk.contactId)) continue;
        hits.push({
          chunk,
          score: cosineSimilarity(input.queryEmbedding, chunk.embedding),
        });
      }
      return hits.sort((a, b) => b.score - a.score).slice(0, limit);
    },

    async listForTenant(organizationId) {
      const org = assertTenantScope(organizationId, 'list');
      return [...byId.values()].filter((c) => c.organizationId === org);
    },
  };
}
