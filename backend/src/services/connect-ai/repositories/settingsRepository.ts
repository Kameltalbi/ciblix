import type { Prisma } from '@prisma/client';
import { prisma } from '../../../db/prisma.js';
import type { ConnectSettings, ConnectTone } from '../core/types.js';

const DEFAULTS: ConnectSettings = {
  language: 'fr',
  tone: 'professionnel',
  style: 'concis',
  length: 'moyen',
  favoriteProducts: [],
};

export async function getEffectiveSettings(
  organizationId: string,
  userId: string
): Promise<ConnectSettings> {
  const [org, user] = await Promise.all([
    prisma.connectOrgSettings.findUnique({ where: { organizationId } }),
    prisma.connectUserSettings.findUnique({ where: { userId } }),
  ]);

  return {
    language: user?.language ?? org?.defaultLanguage ?? DEFAULTS.language,
    tone: (user?.tone ?? org?.defaultTone ?? DEFAULTS.tone) as ConnectTone,
    style: user?.style ?? org?.defaultStyle ?? DEFAULTS.style,
    length: user?.length ?? org?.defaultLength ?? DEFAULTS.length,
    favoriteProducts:
      user?.favoriteProducts?.length ? user.favoriteProducts : org?.favoriteProducts ?? [],
    signature: user?.signature ?? org?.signature,
    customPrompt: user?.customPrompt ?? org?.customPrompt,
  };
}

export async function upsertOrgSettings(organizationId: string, data: Partial<ConnectSettings>) {
  return prisma.connectOrgSettings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      defaultLanguage: data.language ?? 'fr',
      defaultTone: data.tone ?? 'professionnel',
      defaultStyle: data.style ?? 'concis',
      defaultLength: data.length ?? 'moyen',
      favoriteProducts: data.favoriteProducts ?? [],
      signature: data.signature,
      customPrompt: data.customPrompt,
    },
    update: {
      defaultLanguage: data.language,
      defaultTone: data.tone,
      defaultStyle: data.style,
      defaultLength: data.length,
      favoriteProducts: data.favoriteProducts,
      signature: data.signature,
      customPrompt: data.customPrompt,
    },
  });
}

export async function upsertUserSettings(userId: string, data: Partial<ConnectSettings>) {
  return prisma.connectUserSettings.upsert({
    where: { userId },
    create: {
      userId,
      language: data.language,
      tone: data.tone,
      style: data.style,
      length: data.length,
      favoriteProducts: data.favoriteProducts ?? [],
      signature: data.signature,
      customPrompt: data.customPrompt,
    },
    update: {
      language: data.language,
      tone: data.tone,
      style: data.style,
      length: data.length,
      favoriteProducts: data.favoriteProducts,
      signature: data.signature,
      customPrompt: data.customPrompt,
    },
  });
}

export async function upsertExtensionSession(params: {
  organizationId: string;
  userId: string;
  browser?: string;
  extensionVersion?: string;
  metadata?: Record<string, unknown>;
}) {
  const existing = await prisma.connectExtensionSession.findFirst({
    where: { organizationId: params.organizationId, userId: params.userId },
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) {
    return prisma.connectExtensionSession.update({
      where: { id: existing.id },
      data: {
        browser: params.browser ?? existing.browser,
        extensionVersion: params.extensionVersion ?? existing.extensionVersion,
        lastSyncAt: new Date(),
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  return prisma.connectExtensionSession.create({
    data: {
      ...params,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function getExtensionSession(organizationId: string, userId: string) {
  return prisma.connectExtensionSession.findFirst({
    where: { organizationId, userId },
    orderBy: { lastSyncAt: 'desc' },
  });
}
