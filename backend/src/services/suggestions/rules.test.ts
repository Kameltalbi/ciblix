import { describe, expect, it } from 'vitest';
import type { Contact } from '@prisma/client';
import {
  ruleBuyingSignalDetected,
  ruleHighScoreNeverContacted,
  ruleOfferGeneratedSuggestSend,
  ruleTechnicalQuestionInEmail,
  type SuggestionRuleContext,
} from './rules.js';
import { redirectPathForSuggestion } from './suggestionService.js';

function baseCtx(overrides: Partial<SuggestionRuleContext> = {}): SuggestionRuleContext {
  const contact = {
    id: 'c1',
    name: 'Ahmed',
    companyName: 'Acme SARL',
    organizationId: 'org1',
  } as Pick<Contact, 'id' | 'name' | 'companyName' | 'organizationId'>;

  const event = {
    id: 'e1',
    source: 'HUNT',
    type: 'NOTE',
    score: 80,
    resume: null,
    actionsSuggerees: [],
    organizationId: 'org1',
    userId: 'u1',
    contactId: 'c1',
  } as SuggestionRuleContext['event'];

  return {
    event,
    contact,
    previousEvents: [],
    ...overrides,
  };
}

describe('suggestion rules', () => {
  it('ruleHighScoreNeverContacted — score élevé jamais contacté', () => {
    const r = ruleHighScoreNeverContacted(baseCtx());
    expect(r?.type).toBe('ENVOYER_MESSAGE');
    expect(r?.targetAgent).toBe('HUNT');
  });

  it('ruleHighScoreNeverContacted — ignore si déjà contacté', () => {
    const r = ruleHighScoreNeverContacted(
      baseCtx({
        previousEvents: [
          {
            id: 'e0',
            source: 'HUNT',
            type: 'EMAIL',
            score: 70,
            resume: null,
            actionsSuggerees: [],
          },
        ],
      })
    );
    expect(r).toBeNull();
  });

  it('ruleHighScoreNeverContacted — ignore score bas', () => {
    const r = ruleHighScoreNeverContacted(
      baseCtx({
        event: { ...baseCtx().event, score: 40 },
      })
    );
    expect(r).toBeNull();
  });

  it('ruleBuyingSignalDetected — actionsSuggerees budget', () => {
    const r = ruleBuyingSignalDetected(
      baseCtx({
        event: {
          ...baseCtx().event,
          source: 'COPILOT',
          score: 50,
          actionsSuggerees: ['Demander le budget disponible'],
        },
      })
    );
    expect(r?.type).toBe('GENERER_OFFRE');
    expect(r?.targetAgent).toBe('OFFREBOT');
  });

  it('ruleBuyingSignalDetected — score ≥ 75', () => {
    const r = ruleBuyingSignalDetected(
      baseCtx({
        event: {
          ...baseCtx().event,
          source: 'COPILOT',
          score: 78,
          actionsSuggerees: [],
        },
      })
    );
    expect(r?.type).toBe('GENERER_OFFRE');
  });

  it('ruleTechnicalQuestionInEmail', () => {
    const r = ruleTechnicalQuestionInEmail(
      baseCtx({
        event: {
          ...baseCtx().event,
          source: 'GMAIL',
          resume: 'Quelle est la certification ISO requise ?',
        },
      })
    );
    expect(r?.type).toBe('VERIFIER_INFO');
    expect(r?.targetAgent).toBe('FACTCHECK');
  });

  it('ruleOfferGeneratedSuggestSend', () => {
    const r = ruleOfferGeneratedSuggestSend(
      baseCtx({
        event: { ...baseCtx().event, source: 'OFFREBOT' },
      })
    );
    expect(r?.type).toBe('PROGRAMMER_SUIVI');
    expect(r?.targetAgent).toBe('COPILOT');
  });
});

describe('redirectPathForSuggestion', () => {
  it('redirige vers OffreBot avec contactId', () => {
    expect(redirectPathForSuggestion({ targetAgent: 'OFFREBOT', contactId: 'c1' })).toBe(
      '/agents/offre-bot?contactId=c1'
    );
  });

  it('redirige vers Hunt', () => {
    expect(redirectPathForSuggestion({ targetAgent: 'HUNT', contactId: 'c1' })).toBe(
      '/prospection-ia?contactId=c1'
    );
  });
});
