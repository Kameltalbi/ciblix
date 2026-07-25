import { describe, expect, it } from 'vitest';
import { validateGeneratedMessage, validateOfferFidelity } from './generateOutreach.js';

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
