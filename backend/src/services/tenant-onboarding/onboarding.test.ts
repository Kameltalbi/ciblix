import { describe, expect, it } from 'vitest';
import { assertNoUnsoursedServices } from './extractTenantProfile.js';
import { assertRedacteurMayGenerate, buildOfferSheetDraft, isOfferSheetValidated } from './offerSheet.js';
import { emptySourced, sourced, type ExtractedTenantProfile } from './types.js';
import { buildInverseIcp } from './inverseIcp.js';

function baseProfile(over: Partial<ExtractedTenantProfile> = {}): ExtractedTenantProfile {
  return {
    nom_legal: emptySourced(),
    noms_commerciaux: emptySourced(),
    secteur_activite: emptySourced(),
    services_et_produits: emptySourced(),
    proposition_de_valeur: emptySourced(),
    zone_actuelle_d_activite: emptySourced(),
    langues_utilisees: emptySourced(),
    ton_editorial_apparent: emptySourced(),
    email_public: emptySourced(),
    telephone_public: emptySourced(),
    adresse_publique: emptySourced(),
    canaux_presents: emptySourced(),
    extracted_at: new Date().toISOString(),
    ...over,
  };
}

describe('anti-hallucination extraction', () => {
  it('rejette des services sans source', () => {
    const p = baseProfile({
      services_et_produits: {
        value: ['Facturation SaaS inventée'],
        source: null,
        confidence: 0.9,
        empty: false,
      },
    });
    expect(assertNoUnsoursedServices(p).ok).toBe(false);
  });

  it('accepte des services sourcés', () => {
    const p = baseProfile({
      services_et_produits: sourced(['facturation', 'devis'], 'https://softfacture.com', 0.8),
    });
    expect(assertNoUnsoursedServices(p).ok).toBe(true);
  });

  it('un champ non extractible reste empty — pas d’inférence', () => {
    const p = baseProfile();
    expect(p.services_et_produits.empty).toBe(true);
    expect(p.services_et_produits.value).toBeNull();
  });
});

describe('fiche offre + verrou Rédacteur', () => {
  it('brouillon pré-rempli depuis extraction', () => {
    const draft = buildOfferSheetDraft(
      baseProfile({
        services_et_produits: sourced(['Devis', 'Factures'], 'https://x.com', 0.7),
        proposition_de_valeur: sourced('Facturation PME', 'https://x.com', 0.6),
      })
    );
    expect(draft.services_valides).toHaveLength(2);
    expect(draft.validee_le).toBeNull();
    expect(isOfferSheetValidated(draft)).toBe(false);
  });

  it('bloque le Rédacteur tant que non validé', () => {
    const draft = buildOfferSheetDraft(
      baseProfile({
        services_et_produits: sourced(['Devis'], 'https://x.com', 0.7),
      })
    );
    expect(assertRedacteurMayGenerate({ offerSheet: draft }).ok).toBe(false);
    expect(assertRedacteurMayGenerate({ offerSheet: draft }).code).toBe('OFFER_SHEET_REQUIRED');
  });

  it('autorise après validation', () => {
    const sheet = {
      services_valides: [
        {
          libelle: 'Facturation',
          description_courte: '',
          cible_typique: '',
          valide_par_tenant: true,
          source_extraction: 'https://x.com',
        },
      ],
      proposition_de_valeur: 'SaaS facturation',
      validee_le: new Date().toISOString(),
      validee_par: 'user1',
    };
    expect(isOfferSheetValidated(sheet)).toBe(true);
    expect(assertRedacteurMayGenerate({ offerSheet: sheet }).ok).toBe(true);
  });
});

describe('ICP inversé — fallback si < 3 clients', () => {
  it('ne bloque pas avec 1 client — confiance abaissée', async () => {
    const icp = await buildInverseIcp({
      referenceClients: ['Client A'],
      geoZones: ['Tunisie'],
      extracted: baseProfile({
        secteur_activite: sourced('SaaS', 'saisie', 0.5),
      }),
    });
    expect(icp.fallback_from_offer).toBe(true);
    expect(icp.confiance).toBeLessThan(0.5);
    expect(icp.texte_naturel.length).toBeGreaterThan(20);
  });
});
