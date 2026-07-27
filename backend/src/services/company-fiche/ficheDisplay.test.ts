import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildPourquoiMaintenant,
  freshnessLabel,
  isAppreciativeWhy,
  normalizeObjectionTags,
} from './ficheDisplay.js';

describe('pourquoiMaintenant', () => {
  it('fusionne engagement Scribe + signal Veilleur', () => {
    const why = buildPourquoiMaintenant({
      prochaineAction: 'Rappeler après l’été',
      lastSignalTitre: 'Recrute 12 personnes',
    });
    expect(why).toContain('Rappeler');
    expect(why).toContain('Recrute');
  });

  it('retombe sur besoin_detecte si premier contact', () => {
    expect(
      buildPourquoiMaintenant({
        besoinDetecte: 'Aucun logiciel RH détecté',
      })
    ).toMatch(/logiciel RH/i);
  });

  it('rejette les formulations appréciatives', () => {
    expect(isAppreciativeWhy('Forte probabilité de conversion')).toBe(true);
    expect(isAppreciativeWhy('Recrute 12 personnes ce mois-ci')).toBe(false);
  });
});

describe('objections normalisées', () => {
  it('mappe vers liste fermée', () => {
    expect(normalizeObjectionTags(['budget bloqué jusqu’en septembre', 'pas maintenant'])).toEqual(
      expect.arrayContaining(['budget', 'timing'])
    );
  });
});

describe('fraîcheur référentiel', () => {
  it('signale si score bas', () => {
    expect(freshnessLabel(20, new Date(Date.now() - 400 * 24 * 3600_000))).toMatch(/Non vérifié/);
    expect(freshnessLabel(80, new Date())).toBeNull();
  });
});

describe('contrat anti-CRM — routes & UI lecture seule', () => {
  const backendRoot = process.cwd();
  const frontendRoot = join(backendRoot, '../frontend');

  it('contacts API n’expose pas PUT/PATCH d’édition de champs', () => {
    const src = readFileSync(join(backendRoot, 'src/routes/contacts.ts'), 'utf8');
    expect(src).not.toMatch(/contactsRoutes\.(put|patch)\(/i);
    expect(src).toMatch(/contactsRoutes\.post\('\/:id\/reprendre'/);
  });

  it('FicheEntreprise mobile n’expose pas d’input éditable de champ métier', () => {
    const src = readFileSync(
      join(frontendRoot, 'src/components/fiche-entreprise/FicheEntreprise.tsx'),
      'utf8'
    );
    expect(src).not.toMatch(/contentEditable/);
    expect(src).not.toMatch(/type=["']text["']/);
  });

  it('FicheEntrepriseDashboard affiche score et contacts (fiche premium)', () => {
    const src = readFileSync(
      join(frontendRoot, 'src/components/fiche-entreprise/FicheEntrepriseDashboard.tsx'),
      'utf8'
    );
    expect(src).toMatch(/\/100/);
    expect(src).toMatch(/Décideurs identifiés/);
    expect(src).toMatch(/Informations entreprise/);
  });

  it('ContactDetail utilise la fiche dashboard premium', () => {
    const src = readFileSync(join(frontendRoot, 'src/pages/ContactDetail.tsx'), 'utf8');
    expect(src).toMatch(/FicheEntrepriseDashboard/);
    expect(src).toMatch(/contactName/);
  });
});
