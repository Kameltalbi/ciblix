import { prisma } from '../../../db/prisma.js';
import { encryptJson, decryptJson } from '../../../lib/encryption.js';
import {
  fetchPlaceReviews,
  reviewsToScore,
  searchPlaceByText,
} from './googlePlaces.js';

export type ReviewsChannelStatus = {
  connected: boolean;
  comingSoon: false;
  score: number | null;
  provider: string;
  message: string;
  metadata?: Record<string, unknown>;
};

type ReviewsConfig = {
  placeId?: string;
  placeName?: string;
  manualRating?: number;
  manualReviewCount?: number;
};

export async function getReviewsChannelStatus(organizationId: string): Promise<ReviewsChannelStatus> {
  const conn = await prisma.brandChannelConnection.findUnique({
    where: { organizationId_channel: { organizationId, channel: 'REVIEWS' } },
  });

  if (!conn) {
    return {
      connected: false,
      comingSoon: false,
      score: null,
      provider: 'NONE',
      message: 'Connectez Google Business (Place ID) ou saisissez une note manuelle.',
    };
  }

  return {
    connected: true,
    comingSoon: false,
    score: conn.lastScore,
    provider: conn.provider,
    message: conn.lastSyncAt
      ? `Dernière sync : ${conn.lastSyncAt.toISOString()}`
      : 'Connexion configurée — lancez une synchronisation.',
    metadata: (conn.metadata as Record<string, unknown>) || undefined,
  };
}

export async function connectReviewsChannel(
  organizationId: string,
  input: { placeId?: string; searchQuery?: string; manualRating?: number; manualReviewCount?: number },
): Promise<ReviewsChannelStatus> {
  let config: ReviewsConfig = {};
  let provider = 'MANUAL';

  if (input.placeId) {
    config = { placeId: input.placeId };
    provider = 'GOOGLE_PLACES';
  } else if (input.searchQuery) {
    const found = await searchPlaceByText(input.searchQuery);
    if (!found) throw Object.assign(new Error('Établissement Google introuvable'), { statusCode: 404 });
    config = { placeId: found.placeId, placeName: found.name };
    provider = 'GOOGLE_PLACES';
  } else if (input.manualRating != null) {
    config = {
      manualRating: input.manualRating,
      manualReviewCount: input.manualReviewCount ?? 0,
    };
    provider = 'MANUAL';
  } else {
    throw Object.assign(new Error('placeId, searchQuery ou manualRating requis'), { statusCode: 400 });
  }

  await prisma.brandChannelConnection.upsert({
    where: { organizationId_channel: { organizationId, channel: 'REVIEWS' } },
    create: {
      organizationId,
      channel: 'REVIEWS',
      provider,
      encryptedConfig: encryptJson(config),
      active: true,
    },
    update: {
      provider,
      encryptedConfig: encryptJson(config),
      active: true,
    },
  });

  return syncReviewsChannel(organizationId);
}

export async function syncReviewsChannel(organizationId: string): Promise<ReviewsChannelStatus> {
  const conn = await prisma.brandChannelConnection.findUnique({
    where: { organizationId_channel: { organizationId, channel: 'REVIEWS' } },
  });
  if (!conn?.encryptedConfig) {
    return getReviewsChannelStatus(organizationId);
  }

  const config = decryptJson<ReviewsConfig>(conn.encryptedConfig);
  let score = 50;
  let metadata: Record<string, unknown> = {};

  if (conn.provider === 'GOOGLE_PLACES' && config.placeId) {
    const data = await fetchPlaceReviews(config.placeId);
    if (data) {
      score = reviewsToScore(data.rating, data.reviewCount);
      metadata = {
        rating: data.rating,
        reviewCount: data.reviewCount,
        recentNegative: data.recentNegative,
        placeId: config.placeId,
        placeName: config.placeName,
      };
    }
  } else if (config.manualRating != null) {
    score = reviewsToScore(config.manualRating, config.manualReviewCount ?? 0);
    metadata = {
      rating: config.manualRating,
      reviewCount: config.manualReviewCount ?? 0,
      manual: true,
    };
  }

  await prisma.brandChannelConnection.update({
    where: { id: conn.id },
    data: { lastScore: score, lastSyncAt: new Date(), metadata: metadata as object },
  });

  return {
    connected: true,
    comingSoon: false,
    score,
    provider: conn.provider,
    message: 'Scores avis synchronisés.',
    metadata,
  };
}
