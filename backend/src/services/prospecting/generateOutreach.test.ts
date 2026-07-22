import { describe, expect, it } from 'vitest';
import { validateGeneratedMessage } from './generateOutreach.js';

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
