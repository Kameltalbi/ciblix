import { describe, expect, it } from 'vitest';
import {
  assertNoForbiddenReferentielFields,
  ForbiddenReferentielFieldError,
  onlyGenericEmail,
  REFERENTIEL_FORBIDDEN_FIELDS,
} from './types.js';
import { normalizeCompanyName, nameSimilarity, extractDomain } from './normalize.js';
import { computeFreshnessScore } from './freshness.js';
import { assertTenantFilterPresent } from './tenantIsolation.js';

describe('référentiel — champs interdits', () => {
  it('échoue si un champ personne / score / historique est poussé', () => {
    expect(() =>
      assertNoForbiddenReferentielFields({
        nomLegal: 'Acme',
        decideur: 'Jean',
        score_fit: 90,
      })
    ).toThrow(ForbiddenReferentielFieldError);

    for (const f of ['decideur', 'email_nominatif', 'historique_interactions', 'score_fit']) {
      expect(REFERENTIEL_FORBIDDEN_FIELDS).toContain(f);
    }
  });

  it('accepte un payload faits publics uniquement', () => {
    expect(() =>
      assertNoForbiddenReferentielFields({
        nomLegal: 'Softfacture',
        secteur: 'SaaS',
        siteWeb: 'https://softfacture.com',
      })
    ).not.toThrow();
  });

  it('filtre les emails nominatifs', () => {
    expect(onlyGenericEmail('contact@acme.tn')).toBe('contact@acme.tn');
    expect(onlyGenericEmail('jean.dupont@acme.tn')).toBeNull();
  });
});

describe('dédup normalisation', () => {
  it('normalise formes juridiques et accents', () => {
    expect(normalizeCompanyName('Société Étoile SARL')).toBe('etoile');
    expect(normalizeCompanyName('STE ETOILE')).toContain('etoile');
  });

  it('extrait le domaine', () => {
    expect(extractDomain('https://www.Acme.tn/path')).toBe('acme.tn');
  });

  it('similarité de noms', () => {
    expect(nameSimilarity('Acme Industries', 'Acme Industrie')).toBeGreaterThan(0.4);
  });
});

describe('fraîcheur', () => {
  it('score bas si jamais vérifié', () => {
    expect(computeFreshnessScore({ dateDerniereVerification: null, statutActivite: 'ACTIVE' })).toBe(
      15
    );
  });

  it('score haut si vérifié récemment', () => {
    expect(
      computeFreshnessScore({
        dateDerniereVerification: new Date(),
        statutActivite: 'ACTIVE',
      })
    ).toBeGreaterThan(90);
  });
});

describe('isolation tenant (filtre obligatoire)', () => {
  it('échoue sans organizationId', () => {
    expect(() => assertTenantFilterPresent({})).toThrow(/TENANT_FILTER_MISSING/);
    expect(() => assertTenantFilterPresent({ organizationId: 'org_1' })).not.toThrow();
  });
});
