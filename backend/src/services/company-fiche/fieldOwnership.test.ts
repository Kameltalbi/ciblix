import { describe, expect, it } from 'vitest';
import { assertAgentMayWrite, findOwnershipViolations, pickOwnedFields } from './fieldOwnership.js';
import { FieldOwnershipError } from './types.js';
import { applyAgentWrite, applyVeilleurSignal } from './applyWrite.js';
import { canAutoTransition, IllegalTransitionError, assertAutoTransition } from './stateMachine.js';
import {
  checkAnalysteExit,
  checkProspecteurExit,
  checkRedacteurExit,
  checkScribeExit,
} from './exitConditions.js';
import { AGENT_OWNED_FIELDS, FIELD_OWNER, type FicheOwnedField } from './types.js';

describe('contrat de propriété des champs', () => {
  it('chaque champ a exactement un propriétaire', () => {
    const owners = Object.values(FIELD_OWNER);
    expect(owners.length).toBeGreaterThan(10);
    for (const [field, owner] of Object.entries(FIELD_OWNER)) {
      expect(AGENT_OWNED_FIELDS[owner as keyof typeof AGENT_OWNED_FIELDS]).toContain(field);
    }
  });

  it('aucun chevauchement entre agents', () => {
    const seen = new Map<string, string>();
    for (const [agent, fields] of Object.entries(AGENT_OWNED_FIELDS)) {
      for (const f of fields) {
        expect(seen.has(f), `${f} déjà possédé par ${seen.get(f)}`).toBe(false);
        seen.set(f, agent);
      }
    }
  });

  it('Prospecteur ne peut pas écrire decideur / score / message / historique', () => {
    expect(() =>
      assertAgentMayWrite('prospecteur', ['identite_entreprise', 'decideur'])
    ).toThrow(FieldOwnershipError);

    expect(
      findOwnershipViolations('prospecteur', [
        'decideur',
        'besoin_detecte',
        'score_fit',
        'message_brouillon',
        'historique_interactions',
      ])
    ).toEqual([
      'decideur',
      'besoin_detecte',
      'score_fit',
      'message_brouillon',
      'historique_interactions',
    ]);
  });

  it('Analyste ne peut pas écrire identite / message / historique', () => {
    expect(
      findOwnershipViolations('analyste', [
        'identite_entreprise',
        'source_decouverte',
        'message_brouillon',
        'historique_interactions',
        'score_fit',
      ])
    ).toEqual([
      'identite_entreprise',
      'source_decouverte',
      'message_brouillon',
      'historique_interactions',
    ]);
  });

  it('Rédacteur ne peut pas écrire score_fit / decideur / historique', () => {
    expect(
      findOwnershipViolations('redacteur', ['score_fit', 'decideur', 'historique_interactions', 'message_brouillon'])
    ).toEqual(['score_fit', 'decideur', 'historique_interactions']);
  });

  it('Scribe ne peut pas écrire score_fit / decideur / message_brouillon', () => {
    expect(
      findOwnershipViolations('scribe', [
        'score_fit',
        'decideur',
        'message_brouillon',
        'statut_deal',
        'prochaine_action',
      ])
    ).toEqual(['score_fit', 'decideur', 'message_brouillon']);
  });

  it('pickOwnedFields ne conserve que les champs autorisés', () => {
    const picked = pickOwnedFields('scribe', {
      statut_deal: 'en negociation',
      prochaine_action: 'relancer lundi',
      score_fit: 99,
      decideur: { nom: 'X' },
    });
    expect(picked).toEqual({
      statut_deal: 'en negociation',
      prochaine_action: 'relancer lundi',
    });
  });

  it('applyAgentWrite refuse un patch hors contrat', () => {
    expect(() =>
      applyAgentWrite({
        tenantId: 't1',
        ficheId: 'c1',
        agent: 'prospecteur',
        etatActuel: null,
        dataActuelle: {},
        patch: {
          identite_entreprise: { nom_legal: 'A2FO' },
          critere_de_match: 'secteur SaaS',
          score_fit: 80,
        } as never,
        etatCible: 'decouverte',
        raison: 'test',
        conditionSortieRemplie: true,
      })
    ).toThrow(FieldOwnershipError);
  });

  it('applyAgentWrite Prospecteur → decouverte OK', () => {
    const r = applyAgentWrite({
      tenantId: 't1',
      ficheId: 'c1',
      agent: 'prospecteur',
      etatActuel: null,
      dataActuelle: {},
      patch: {
        identite_entreprise: { nom_legal: 'SoftPME' },
        source_decouverte: { source: 'Google Places', at: new Date().toISOString() },
        secteur_declare: 'Services',
        zone_geographique: 'Tunis',
        critere_de_match: 'secteur Services · Tunis',
      },
      etatCible: 'decouverte',
      raison: 'match ICP',
      conditionSortieRemplie: true,
    });
    expect(r.etat).toBe('decouverte');
    expect(r.transition.prochain_agent).toBe('analyste');
    expect(r.champsEcrits).toContain('identite_entreprise');
    expect(r.champsEcrits).not.toContain('score_fit' as FicheOwnedField);
  });

  it('Veilleur n’écrit que signaux_externes sourcés', () => {
    expect(() =>
      applyVeilleurSignal({}, {
        at: new Date().toISOString(),
        titre: 'AO',
        source_ref: '',
      })
    ).toThrow(/non sourcé/);

    const d = applyVeilleurSignal({}, {
      at: new Date().toISOString(),
      titre: 'Appel d’offres',
      source_ref: 'boe:123',
      source_url: 'https://example.com/ao',
      destination: 'analyste',
    });
    expect(d.signaux_externes).toHaveLength(1);
  });
});

describe('machine à états', () => {
  it('interdit Analyste de sauter vers contactee', () => {
    expect(canAutoTransition('analyste', 'decouverte', 'contactee')).toBe(false);
    expect(() => assertAutoTransition('analyste', 'decouverte', 'contactee')).toThrow(
      IllegalTransitionError
    );
  });

  it('autorise Analyste decouverte → qualifiee | archivee | bloquee', () => {
    expect(canAutoTransition('analyste', 'decouverte', 'qualifiee')).toBe(true);
    expect(canAutoTransition('analyste', 'decouverte', 'archivee')).toBe(true);
    expect(canAutoTransition('analyste', 'decouverte', 'bloquee_humain')).toBe(true);
  });

  it('interdit toute boucle arrière automatique', () => {
    expect(canAutoTransition('redacteur', 'contactee', 'qualifiee')).toBe(false);
    expect(canAutoTransition('scribe', 'en_discussion', 'decouverte')).toBe(false);
  });
});

describe('conditions de sortie', () => {
  it('Prospecteur refuse une fiche sans identité', () => {
    expect(checkProspecteurExit({ critere_de_match: 'x' }).ok).toBe(false);
  });

  it('Analyste archive si score sous seuil', () => {
    const r = checkAnalysteExit(
      {
        score_fit: 30,
        raison_du_score: 'faible signal',
        decideur: { nom: 'A', source: 'LinkedIn' },
      },
      55
    );
    expect(r.ok).toBe(false);
    expect(r.etatCible).toBe('archivee');
  });

  it('Analyste bloque si décideur non sourcé', () => {
    const r = checkAnalysteExit({
      score_fit: 80,
      raison_du_score: 'recrute',
      decideur: { nom: 'Guess' }, // pas de source
    });
    expect(r.etatCible).toBe('bloquee_humain');
  });

  it('Rédacteur bloque si confusion rôles', () => {
    const r = checkRedacteurExit({
      message_brouillon: 'hello',
      validation_separation: { erreur_detectee: true, details: 'confusion' },
      validation_qualite: { conforme: true, problemes: [] },
    });
    expect(r.ok).toBe(false);
    expect(r.etatCible).toBe('bloquee_humain');
  });

  it('Scribe exige statut_deal + prochaine_action', () => {
    expect(checkScribeExit({ statut_deal: 'ok' }).ok).toBe(false);
    const ok = checkScribeExit({
      statut_deal: 'en discussion',
      prochaine_action: 'Envoyer devis',
    });
    expect(ok.ok).toBe(true);
    expect(ok.etatCible).toBe('en_discussion');
  });
});
