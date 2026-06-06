import { syncReviewsChannel } from './channels/reviews.js';
import { syncSocialChannel } from './channels/social.js';
import { scorePressChannel } from './channels/press.js';
import { scoreLlmChannel } from './channels/llmChannel.js';
import type { BrandProfile } from '@prisma/client';

export type SyncedChannelData = {
  SOCIAL?: { score: number; details: Record<string, unknown> };
  REVIEWS?: { score: number; details: Record<string, unknown> };
  PRESS?: { score: number; details: Record<string, unknown> };
  LLM?: { score: number; details: Record<string, unknown> };
};

export async function syncAllChannels(profile: BrandProfile): Promise<SyncedChannelData> {
  const orgId = profile.organizationId;
  const result: SyncedChannelData = {};

  const [social, reviews, press, llm] = await Promise.all([
    syncSocialChannel(orgId, profile.websiteUrl, profile.brandName).catch(() => null),
    syncReviewsChannel(orgId).catch(() => null),
    scorePressChannel(profile.brandName, profile.sector).catch(() => null),
    scoreLlmChannel(profile.brandName, profile.sector, (profile.brandKeywords as string[]) || []).catch(() => null),
  ]);

  if (social?.score != null) {
    result.SOCIAL = { score: social.score, details: { ...social.metadata, provider: social.provider } };
  }
  if (reviews?.score != null) {
    result.REVIEWS = { score: reviews.score, details: { ...reviews.metadata, provider: reviews.provider } };
  }
  if (press) result.PRESS = press;
  if (llm) result.LLM = llm;

  return result;
}
