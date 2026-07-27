import type { GenerateMessageInput, GeneratedMessageResult } from '../core/types.js';
import { generateInitialMessage } from './refineService.js';

/** @deprecated Utiliser generateInitialMessage via la route /generate */
export async function generateMessage(input: GenerateMessageInput): Promise<GeneratedMessageResult> {
  const started = Date.now();
  if (!input.qualification) {
    throw new Error('Qualification requise');
  }
  const content = await generateInitialMessage({
    organizationId: input.organizationId,
    userId: input.userId,
    profile: input.profile,
    qualification: input.qualification,
    objective: input.objective,
    tone: input.userMemory?.preferredTone,
  });
  return {
    content,
    productSlug: input.qualification.recommendedProductSlug,
    strategy: input.strategy,
    generationMs: Date.now() - started,
    source: 'openai',
  };
}
