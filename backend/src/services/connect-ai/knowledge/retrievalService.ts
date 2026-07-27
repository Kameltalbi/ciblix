import {
  formatKnowledgeForPrompt,
  searchKnowledgeChunks,
  type RetrievedChunk,
} from '../repositories/knowledgeRepository.js';

export async function retrieveOrgKnowledge(params: {
  organizationId: string;
  queryParts: Array<string | null | undefined>;
  limit?: number;
}): Promise<{ chunks: RetrievedChunk[]; promptBlock: string }> {
  const query = params.queryParts.filter(Boolean).join(' ').trim();
  if (!query) return { chunks: [], promptBlock: '' };

  const chunks = await searchKnowledgeChunks(params.organizationId, query, params.limit ?? 5);
  return {
    chunks,
    promptBlock: formatKnowledgeForPrompt(chunks),
  };
}
