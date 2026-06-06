import { prisma } from '../../../db/prisma.js';
import { encryptJson, decryptJson } from '../../../lib/encryption.js';

export type SocialChannelStatus = {
  connected: boolean;
  comingSoon: false;
  score: number | null;
  provider: string;
  message: string;
  metadata?: Record<string, unknown>;
};

type SocialConfig = {
  linkedinUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  manualMentionScore?: number;
};

const SOCIAL_PATTERNS: Array<{ key: keyof SocialConfig; re: RegExp }> = [
  { key: 'linkedinUrl', re: /https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/[^\s"'<>]+/gi },
  { key: 'facebookUrl', re: /https?:\/\/(?:[\w.-]+\.)?facebook\.com\/[^\s"'<>]+/gi },
  { key: 'instagramUrl', re: /https?:\/\/(?:[\w.-]+\.)?instagram\.com\/[^\s"'<>]+/gi },
  { key: 'twitterUrl', re: /https?:\/\/(?:[\w.-]+\.)?(?:twitter|x)\.com\/[^\s"'<>]+/gi },
];

function extractSocialLinks(html: string): SocialConfig {
  const found: SocialConfig = {};
  for (const { key, re } of SOCIAL_PATTERNS) {
    const m = html.match(re);
    if (m?.[0]) {
      if (key === 'linkedinUrl') found.linkedinUrl = m[0];
      if (key === 'facebookUrl') found.facebookUrl = m[0];
      if (key === 'instagramUrl') found.instagramUrl = m[0];
      if (key === 'twitterUrl') found.twitterUrl = m[0];
    }
  }
  return found;
}

function socialToScore(config: SocialConfig, mentionHits = 0): number {
  if (config.manualMentionScore != null) {
    return Math.min(100, Math.max(0, config.manualMentionScore));
  }
  let score = 20;
  const platforms = [config.linkedinUrl, config.facebookUrl, config.instagramUrl, config.twitterUrl].filter(Boolean);
  score += Math.min(40, platforms.length * 12);
  score += Math.min(30, mentionHits * 5);
  if (config.linkedinUrl) score += 10;
  return Math.min(100, score);
}

async function countBrandMentions(brandName: string, websiteUrl: string): Promise<number> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId || !brandName) return 0;

  let domain = '';
  try {
    domain = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`).hostname;
  } catch {
    domain = '';
  }

  const q = `"${brandName}"${domain ? ` -site:${domain}` : ''}`;
  const params = new URLSearchParams({ key: apiKey, cx: cseId, q, num: '10' });
  try {
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return 0;
    const json = (await res.json()) as { searchInformation?: { totalResults?: string } };
    const total = Number(json.searchInformation?.totalResults || 0);
    return Math.min(10, isNaN(total) ? 0 : Math.floor(total / 100));
  } catch {
    return 0;
  }
}

export async function getSocialChannelStatus(
  organizationId: string,
  brandProfileId: string,
): Promise<SocialChannelStatus> {
  const conn = await prisma.brandChannelConnection.findUnique({
    where: { brandProfileId_channel: { brandProfileId, channel: 'SOCIAL' } },
  });

  if (!conn) {
    return {
      connected: false,
      comingSoon: false,
      score: null,
      provider: 'NONE',
      message: 'Lancez la détection automatique depuis votre site ou configurez manuellement.',
    };
  }

  return {
    connected: true,
    comingSoon: false,
    score: conn.lastScore,
    provider: conn.provider,
    message: conn.lastSyncAt ? `Dernière sync : ${conn.lastSyncAt.toISOString()}` : 'Connexion configurée.',
    metadata: (conn.metadata as Record<string, unknown>) || undefined,
  };
}

export async function connectSocialFromWebsite(
  organizationId: string,
  brandProfileId: string,
  websiteUrl: string,
  brandName: string,
): Promise<SocialChannelStatus> {
  let url = websiteUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CiblixBrandPulse/2.0)' },
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();
  const links = extractSocialLinks(html);
  const mentions = await countBrandMentions(brandName, websiteUrl);
  const score = socialToScore(links, mentions);
  const metadata = { ...links, mentionHits: mentions };

  await prisma.brandChannelConnection.upsert({
    where: { brandProfileId_channel: { brandProfileId, channel: 'SOCIAL' } },
    create: {
      organizationId,
      brandProfileId,
      channel: 'SOCIAL',
      provider: 'AUTO_DETECT',
      encryptedConfig: encryptJson(links),
      lastScore: score,
      lastSyncAt: new Date(),
      metadata,
      active: true,
    },
    update: {
      provider: 'AUTO_DETECT',
      encryptedConfig: encryptJson(links),
      lastScore: score,
      lastSyncAt: new Date(),
      metadata,
      active: true,
    },
  });

  return {
    connected: true,
    comingSoon: false,
    score,
    provider: 'AUTO_DETECT',
    message: `${Object.keys(links).length} réseau(x) détecté(s), ${mentions} signal(x) de mentions.`,
    metadata,
  };
}

export async function connectSocialManual(
  organizationId: string,
  brandProfileId: string,
  config: SocialConfig,
): Promise<SocialChannelStatus> {
  const score = socialToScore(config);
  await prisma.brandChannelConnection.upsert({
    where: { brandProfileId_channel: { brandProfileId, channel: 'SOCIAL' } },
    create: {
      organizationId,
      brandProfileId,
      channel: 'SOCIAL',
      provider: 'MANUAL',
      encryptedConfig: encryptJson(config),
      lastScore: score,
      lastSyncAt: new Date(),
      metadata: config,
      active: true,
    },
    update: {
      provider: 'MANUAL',
      encryptedConfig: encryptJson(config),
      lastScore: score,
      lastSyncAt: new Date(),
      metadata: config,
      active: true,
    },
  });

  return getSocialChannelStatus(organizationId, brandProfileId);
}

export async function syncSocialChannel(
  organizationId: string,
  brandProfileId: string,
  websiteUrl: string,
  brandName: string,
): Promise<SocialChannelStatus> {
  const conn = await prisma.brandChannelConnection.findUnique({
    where: { brandProfileId_channel: { brandProfileId, channel: 'SOCIAL' } },
  });
  if (!conn) return getSocialChannelStatus(organizationId, brandProfileId);

  if (conn.provider === 'AUTO_DETECT') {
    return connectSocialFromWebsite(organizationId, brandProfileId, websiteUrl, brandName);
  }

  const config = conn.encryptedConfig ? decryptJson<SocialConfig>(conn.encryptedConfig) : {};
  const mentions = await countBrandMentions(brandName, websiteUrl);
  const score = socialToScore(config, mentions);
  const metadata = { ...config, mentionHits: mentions };

  await prisma.brandChannelConnection.update({
    where: { id: conn.id },
    data: { lastScore: score, lastSyncAt: new Date(), metadata },
  });

  return {
    connected: true,
    comingSoon: false,
    score,
    provider: conn.provider,
    message: 'Scores sociaux synchronisés.',
    metadata,
  };
}
