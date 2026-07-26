import { describe, expect, it } from 'vitest';
import {
  validateGeneratedMessage,
  validateOfferFidelity,
} from '../commercial-writing/offerFidelity.js';
import { buildTenantProfile, buildTargetProfile } from '../commercial-writing/buildProfiles.js';

describe('validateGeneratedMessage', () => {
  it('rejects messages signed as the prospect', () => {
    const body = `Bonjour,
J'espère que tout va bien. Je suis Afifa Bahroun, et je travaille dans la comptabilité.
À bientôt,
Afifa`;
    expect(validateGeneratedMessage(body, 'Comptable Afifa bahroun', 'Archibat').ok).toBe(false);
  });

  it('rejects "Je suis {prospect}" identity theft', () => {
    const body = `Bonjour,\nJe suis Afifa Bahroun et je souhaite vous proposer nos services.\nCordialement,\nArchibat`;
    expect(validateGeneratedMessage(body, 'Afifa Bahroun', 'Archibat').ok).toBe(false);
  });

  it('accepts a correct sender-signed message', () => {
    const body = `Bonjour,\n\nJe vous contacte de la part d'Archibat concernant votre activité comptable.\nSeriez-vous disponible pour un échange court ?\n\nBien cordialement,\nKamel Talbi\nArchibat`;
    expect(validateGeneratedMessage(body, 'Comptable Afifa bahroun', 'Archibat').ok).toBe(true);
  });
});

describe('validateOfferFidelity', () => {
  it('rejette un pitch événementiel quand Softfacture = facturation', () => {
    const body = `Bonjour,

Chez Softfacture, nous proposons des solutions événementielles sur mesure.

Cordialement,
Kamel
Softfacture`;
    const check = validateOfferFidelity(body, {
      organizationName: 'Softfacture',
      organizationBrief: 'Application de facturation en ligne pour TPE et PME',
      productsServices: ['facturation en ligne', 'devis', 'factures'],
    });
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/hallucinated_events/);
  });

  it('rejette un développement SaaS inventé pour Softfacture facturation', () => {
    const body = `Prestations: Développement et mise en place de la solution SaaS pour A2FO.`;
    const check = validateOfferFidelity(body, {
      organizationName: 'Softfacture',
      organizationBrief: 'Application de facturation en ligne',
      productsServices: ['facturation en ligne', 'devis', 'factures'],
    });
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/custom_saas_dev/);
  });

  it('accepte un pitch aligné facturation', () => {
    const body = `Bonjour,

Chez Softfacture, notre application de facturation en ligne aide les PME à émettre devis et factures plus simplement.

Cordialement,
Kamel
Softfacture`;
    const check = validateOfferFidelity(body, {
      organizationName: 'Softfacture',
      organizationBrief: 'Application de facturation en ligne pour TPE et PME',
      productsServices: ['facturation en ligne', 'devis', 'factures'],
    });
    expect(check.ok).toBe(true);
  });
});

describe('buildTenantProfile / buildTargetProfile', () => {
  it('ne tire les services que de la Mission / catalogue, pas du nom', () => {
    const tenant = buildTenantProfile({
      organizationName: 'Softfacture',
      targeting: {
        companyBrief: 'Facturation en ligne',
        productsServices: ['facturation', 'devis'],
        sectors: ['SaaS'],
      },
      catalogProductNames: ['Abonnement Pro'],
      ton: 'commercial',
    });
    expect(tenant.services_offerts).toEqual(['facturation', 'devis', 'Abonnement Pro']);
    expect(tenant.nom_entreprise).toBe('Softfacture');

    const target = buildTargetProfile({
      companyName: 'A2FO',
      industry: 'Place de marché',
      besoin: 'digitalisation admin',
    });
    expect(target.nom_entreprise).toBe('A2FO');
    expect(target.secteur_activite).toContain('Place de marché');
  });
});
