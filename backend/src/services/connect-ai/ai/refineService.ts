import type { ProspectProfile, ProspectQualification } from '../core/types.js';
import { callConnectAiLlm } from './llmClient.js';
import { formatUserMemoryForPrompt, learnFromInstruction } from '../repositories/userMemoryRepository.js';
import { getProductBySlug } from '../repositories/productCatalogRepository.js';
import { retrieveOrgKnowledge } from '../knowledge/retrievalService.js';

export async function refineMessage(params: {
  organizationId: string;
  userId: string;
  message: string;
  instruction: string;
  profile?: ProspectProfile;
  qualification?: ProspectQualification;
  objective?: string;
}): Promise<{ content: string; learned: boolean }> {
  void learnFromInstruction(params.userId, params.instruction);

  const product = params.qualification?.recommendedProductSlug
    ? await getProductBySlug(params.organizationId, params.qualification.recommendedProductSlug)
    : null;

  const memory = await import('../repositories/userMemoryRepository.js').then((m) =>
    m.getUserMemory(params.userId)
  );

  const knowledge = await retrieveOrgKnowledge({
    organizationId: params.organizationId,
    queryParts: [
      params.instruction,
      params.message.slice(0, 400),
      product?.name,
      params.qualification?.recommendedSubject,
      params.profile?.company,
      params.profile?.jobTitle,
    ],
  });

  const system = `Tu es Connect AI, copilote commercial. L'utilisateur a un brouillon de message et te demande de le modifier.
Applique EXACTEMENT l'instruction. Garde le sens commercial. Ne mentionne jamais que tu es une IA.
Réponds UNIQUEMENT avec le message modifié, sans guillemets ni préambule.

Préférences utilisateur:
${formatUserMemoryForPrompt(memory)}

${product ? `Produit: ${product.name} — ${product.description}` : ''}
${params.qualification ? `Angles recommandés: ${params.qualification.bestAngles.join(', ')}` : ''}
${params.qualification ? `À éviter: ${params.qualification.avoidTopics.join(', ')}` : ''}

${knowledge.promptBlock}`;

  const user = `Message actuel:\n${params.message}\n\nInstruction: ${params.instruction}`;

  const refined = await callConnectAiLlm(system, user, { temperature: 0.4, maxTokens: 700 });
  if (refined) return { content: refined, learned: true };

  return { content: params.message, learned: false };
}

export async function generateInitialMessage(params: {
  organizationId: string;
  userId: string;
  profile: ProspectProfile;
  qualification: ProspectQualification;
  objective?: string;
  tone?: string;
}): Promise<string> {
  const memory = await import('../repositories/userMemoryRepository.js').then((m) =>
    m.getUserMemory(params.userId)
  );
  const product = await getProductBySlug(params.organizationId, params.qualification.recommendedProductSlug);

  const knowledge = await retrieveOrgKnowledge({
    organizationId: params.organizationId,
    queryParts: [
      params.profile.company,
      params.profile.jobTitle,
      params.profile.sector,
      params.qualification.recommendedSubject,
      params.qualification.bestAngles.join(' '),
      product?.name,
      params.objective,
    ],
  });

  const system = `Tu rédiges un message de prospection LinkedIn pour Ciblix.
Ton: ${params.tone || memory.preferredTone}. Longueur: ${memory.messageLength}.
${formatUserMemoryForPrompt(memory)}

Prospect: ${params.profile.fullName} — ${params.profile.jobTitle} @ ${params.profile.company}
Insight: ${params.qualification.contextualInsight}
Angles: ${params.qualification.bestAngles.join(', ')}
À éviter: ${params.qualification.avoidTopics.join(', ')}
Produit: ${product?.name} — ${product?.cta}
Objectif: ${params.objective || params.qualification.recommendedSubject}

${knowledge.promptBlock}

Rédige le message uniquement. Pas d'envoi automatique — l'utilisateur enverra lui-même.`;

  const ai = await callConnectAiLlm(system, 'Génère le message.', { maxTokens: 600 });
  if (ai) return ai;

  const name = params.profile.firstName || params.profile.fullName || 'Bonjour';
  return `Bonjour ${name},\n\n${params.qualification.contextualInsight}\n\nSeriez-vous ouvert à un échange de 15 minutes ?`;
}
