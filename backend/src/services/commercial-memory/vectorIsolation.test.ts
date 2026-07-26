/**
 * GATE D’ISOLATION VECTORIELLE — écrire / maintenir AVANT d’étendre hybridSearch.
 *
 * Risque classique RAG multi-tenant : un index unique partagé sans filtre tenant_id
 * fuit l’historique commercial d’un client vers un autre.
 *
 * Si ce fichier échoue → bloquer le déploiement de la recherche mémoire.
 */
import { describe, expect, it } from 'vitest';
import {
  TenantScopeRequiredError,
  createInMemoryVectorIndex,
  deterministicEmbed,
  type TenantScopedVectorIndex,
} from './vectorStore.js';

async function seedTwoTenants(index: TenantScopedVectorIndex) {
  const embA = deterministicEmbed('textile Sfax budget bloqué jusqu en septembre');
  const embB = deterministicEmbed('textile Sfax budget bloqué jusqu en septembre'); // même contenu

  await index.upsert({
    organizationId: 'tenant_A',
    contactId: 'contact_A1',
    kind: 'historique_interactions',
    contentText: 'Appel mai — intéressés mais budget bloqué',
    embedding: embA,
  });
  await index.upsert({
    organizationId: 'tenant_B',
    contactId: 'contact_B1',
    kind: 'historique_interactions',
    contentText: 'Appel mai — intéressés mais budget bloqué',
    embedding: embB,
  });
}

describe('index vectoriel — isolation tenant (gate)', () => {
  it('refuse toute recherche sans organizationId', async () => {
    const index = createInMemoryVectorIndex();
    await expect(
      index.search({
        organizationId: '',
        queryEmbedding: deterministicEmbed('textile'),
      })
    ).rejects.toBeInstanceOf(TenantScopeRequiredError);

    await expect(
      index.search({
        // @ts-expect-error — simule oubli d’injection auth
        organizationId: undefined,
        queryEmbedding: deterministicEmbed('textile'),
      })
    ).rejects.toBeInstanceOf(TenantScopeRequiredError);
  });

  it('refuse tout upsert sans organizationId', async () => {
    const index = createInMemoryVectorIndex();
    await expect(
      index.upsert({
        organizationId: '  ',
        contactId: 'c1',
        kind: 'besoin_detecte',
        contentText: 'x',
        embedding: deterministicEmbed('x'),
      })
    ).rejects.toBeInstanceOf(TenantScopeRequiredError);
  });

  it('ne retourne JAMAIS un vecteur d’un autre tenant (même embedding identique)', async () => {
    const index = createInMemoryVectorIndex();
    await seedTwoTenants(index);

    const query = deterministicEmbed('textile Sfax budget');
    const hitsA = await index.search({ organizationId: 'tenant_A', queryEmbedding: query, limit: 10 });
    const hitsB = await index.search({ organizationId: 'tenant_B', queryEmbedding: query, limit: 10 });

    expect(hitsA.length).toBeGreaterThan(0);
    expect(hitsB.length).toBeGreaterThan(0);

    for (const h of hitsA) {
      expect(h.chunk.organizationId).toBe('tenant_A');
      expect(h.chunk.contactId).not.toBe('contact_B1');
    }
    for (const h of hitsB) {
      expect(h.chunk.organizationId).toBe('tenant_B');
      expect(h.chunk.contactId).not.toBe('contact_A1');
    }

    const listedA = await index.listForTenant('tenant_A');
    expect(listedA.every((c) => c.organizationId === 'tenant_A')).toBe(true);
    expect(listedA.some((c) => c.organizationId === 'tenant_B')).toBe(false);
  });

  it('filtre contactIds ne peut pas contourner le scope tenant', async () => {
    const index = createInMemoryVectorIndex();
    await seedTwoTenants(index);

    // Attaque : demander explicitement le contactId de l’autre tenant
    const hits = await index.search({
      organizationId: 'tenant_A',
      queryEmbedding: deterministicEmbed('textile Sfax budget'),
      contactIds: ['contact_B1', 'contact_A1'],
      limit: 10,
    });

    expect(hits.every((h) => h.chunk.organizationId === 'tenant_A')).toBe(true);
    expect(hits.some((h) => h.chunk.contactId === 'contact_B1')).toBe(false);
  });
});
