import type { AgentEvent, Contact, SuggestionType } from '@prisma/client';

export type SuggestionRuleContext = {
  event: Pick<
    AgentEvent,
    'id' | 'source' | 'type' | 'score' | 'resume' | 'actionsSuggerees' | 'organizationId' | 'userId' | 'contactId'
  >;
  contact: Pick<Contact, 'id' | 'name' | 'companyName' | 'organizationId'>;
  previousEvents: Array<
    Pick<AgentEvent, 'id' | 'source' | 'type' | 'score' | 'resume' | 'actionsSuggerees'>
  >;
};

export type SuggestionRuleResult = {
  type: SuggestionType;
  message: string;
  targetAgent: string;
};

export type SuggestionRule = (ctx: SuggestionRuleContext) => SuggestionRuleResult | null;

function contactLabel(contact: SuggestionRuleContext['contact']): string {
  return contact.name?.trim() || contact.companyName?.trim() || 'ce contact';
}

/** Prospect à score élevé jamais contacté (Hunt). */
export const ruleHighScoreNeverContacted: SuggestionRule = (ctx) => {
  if (ctx.event.source !== 'HUNT' || ctx.event.score == null || ctx.event.score < 70) return null;
  const alreadyContacted = ctx.previousEvents.some(
    (e) => e.source === 'HUNT' && (e.type === 'EMAIL' || e.type === 'WHATSAPP')
  );
  if (alreadyContacted) return null;

  return {
    type: 'ENVOYER_MESSAGE',
    message: `${contactLabel(ctx.contact)} a un score élevé (${Math.round(ctx.event.score)}/100). Envoyer un message de prospection maintenant ?`,
    targetAgent: 'HUNT',
  };
};

/** Signal d'achat détecté par Assistant IA. */
export const ruleBuyingSignalDetected: SuggestionRule = (ctx) => {
  if (ctx.event.source !== 'COPILOT') return null;
  const hasSignal =
    (ctx.event.actionsSuggerees ?? []).some((a) =>
      /budget|urgent|d[ée]cision|signer|acheter/i.test(a)
    ) ||
    (ctx.event.score != null && ctx.event.score >= 75);
  if (!hasSignal) return null;

  return {
    type: 'GENERER_OFFRE',
    message: `Signal d'achat détecté pour ${contactLabel(ctx.contact)}. Générer une offre maintenant avec Rédacteur d'offres ?`,
    targetAgent: 'OFFREBOT',
  };
};

/** Question technique détectée dans un email Gmail IA. */
export const ruleTechnicalQuestionInEmail: SuggestionRule = (ctx) => {
  if (ctx.event.source !== 'GMAIL') return null;
  const hasTechnicalQuestion =
    /norme|certification|prix exact|d[ée]lai de livraison|sp[ée]cification/i.test(
      ctx.event.resume ?? ''
    );
  if (!hasTechnicalQuestion) return null;

  return {
    type: 'VERIFIER_INFO',
    message: `Une question technique a été détectée dans l'email de ${contactLabel(ctx.contact)}. Vérifier l'information avant de répondre ?`,
    targetAgent: 'FACTCHECK',
  };
};

/** Offre générée → programmer un suivi. */
export const ruleOfferGeneratedSuggestSend: SuggestionRule = (ctx) => {
  if (ctx.event.source !== 'OFFREBOT') return null;

  return {
    type: 'PROGRAMMER_SUIVI',
    message: `Offre générée pour ${contactLabel(ctx.contact)}. Programmer un suivi dans 3 jours si sans réponse ?`,
    targetAgent: 'COPILOT',
  };
};

export const SUGGESTION_RULES: SuggestionRule[] = [
  ruleHighScoreNeverContacted,
  ruleBuyingSignalDetected,
  ruleTechnicalQuestionInEmail,
  ruleOfferGeneratedSuggestSend,
];

/** Message pour la règle de refroidissement (cron pipeline). */
export function coolingDownSuggestionMessage(
  contact: Pick<Contact, 'name' | 'companyName'>
): SuggestionRuleResult {
  return {
    type: 'RELANCER',
    message: `${contact.name?.trim() || contact.companyName?.trim() || 'Ce contact'} refroidit après avoir été chaud. Relancer maintenant ?`,
    targetAgent: 'HUNT',
  };
}
