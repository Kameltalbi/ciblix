import { prisma } from '../../db/prisma.js';

export async function logLlmUsage(opts: {
  organizationId: string;
  service: string;
  success: boolean;
  durationMs: number;
  tokensEstimate?: number;
  costEstimateUsd?: number;
  errorCode?: string;
}): Promise<void> {
  await prisma.llmUsageLog.create({
    data: {
      organizationId: opts.organizationId,
      service: opts.service,
      success: opts.success,
      durationMs: opts.durationMs,
      tokensEstimate: opts.tokensEstimate ?? null,
      costEstimateUsd: opts.costEstimateUsd ?? null,
      errorCode: opts.errorCode ?? null,
    },
  });
}

/** Estimation grossière : ~$0.002 / 1k tokens gpt-4o-mini, $0.006 / min Whisper. */
export function estimateLlmCost(service: string, tokensOrChars: number): number {
  if (service.includes('transcribe') || service.includes('whisper')) {
    return (tokensOrChars / 60) * 0.006;
  }
  return (tokensOrChars / 1000) * 0.002;
}
