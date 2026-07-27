import type { Prisma } from '@prisma/client';
import { prisma } from '../../../db/prisma.js';
import type { ConnectChannelSlug } from '../core/types.js';
import type { ProspectAnalysis, ProspectProfile } from '../core/types.js';

const CHANNEL_SEED: { slug: ConnectChannelSlug; name: string; description: string }[] = [
  { slug: 'LINKEDIN', name: 'LinkedIn', description: 'Prospection assistée sur LinkedIn' },
  { slug: 'GMAIL', name: 'Gmail', description: 'Bientôt disponible' },
  { slug: 'OUTLOOK', name: 'Outlook', description: 'Bientôt disponible' },
  { slug: 'WHATSAPP', name: 'WhatsApp Web', description: 'Bientôt disponible' },
];

export async function ensureChannelsSeeded(): Promise<void> {
  for (const ch of CHANNEL_SEED) {
    await prisma.connectChannel.upsert({
      where: { slug: ch.slug },
      update: { name: ch.name, description: ch.description },
      create: { slug: ch.slug, name: ch.name, description: ch.description, active: ch.slug === 'LINKEDIN' },
    });
  }
}

export async function getChannelId(slug: ConnectChannelSlug): Promise<string> {
  await ensureChannelsSeeded();
  const ch = await prisma.connectChannel.findUniqueOrThrow({ where: { slug } });
  return ch.id;
}

export async function upsertProspect(params: {
  organizationId: string;
  userId: string;
  channelSlug: ConnectChannelSlug;
  profile: ProspectProfile;
  analysis?: ProspectAnalysis;
  contactId?: string;
}) {
  const channelId = await getChannelId(params.channelSlug);
  const profileUrl = params.profile.profileUrl;

  const existing = profileUrl
    ? await prisma.connectProspect.findFirst({
        where: { organizationId: params.organizationId, profileUrl },
      })
    : null;

  const data = {
    userId: params.userId,
    channelId,
    contactId: params.contactId,
    firstName: params.profile.firstName,
    lastName: params.profile.lastName,
    fullName: params.profile.fullName,
    company: params.profile.company,
    jobTitle: params.profile.jobTitle,
    country: params.profile.country,
    sector: params.profile.sector ?? params.analysis?.sector,
    profileUrl,
    headline: params.profile.headline,
    description: params.profile.description,
    connectionCount: params.profile.connectionCount,
    experience: (params.profile.experience ?? undefined) as Prisma.InputJsonValue | undefined,
    education: (params.profile.education ?? undefined) as Prisma.InputJsonValue | undefined,
    rawProfile: (params.profile.raw ?? params.profile) as Prisma.InputJsonValue,
    aiScore: params.analysis?.score,
    aiSummary: params.analysis?.summary,
    aiOpportunities: params.analysis?.opportunitiesBullets?.join(' · ') ?? null,
    aiRisks: params.analysis?.risks,
    aiAngle: params.analysis?.recommendedSubject ?? params.analysis?.bestAngles?.[0] ?? null,
    aiAnalysis: (params.analysis ?? undefined) as Prisma.InputJsonValue | undefined,
    aiQualification: (params.analysis ?? undefined) as Prisma.InputJsonValue | undefined,
    lastSeenAt: new Date(),
  };

  const prospect = existing
    ? await prisma.connectProspect.update({ where: { id: existing.id }, data })
    : await prisma.connectProspect.create({
        data: { organizationId: params.organizationId, ...data },
      });

  await prisma.connectProspectHistory.create({
    data: {
      prospectId: prospect.id,
      snapshot: { profile: params.profile, analysis: params.analysis } as unknown as Prisma.InputJsonValue,
      source: params.channelSlug,
    },
  });

  return prospect;
}

export async function listProspects(organizationId: string, limit = 50) {
  return prisma.connectProspect.findMany({
    where: { organizationId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: { channel: true },
  });
}

export async function getProspectById(organizationId: string, id: string) {
  return prisma.connectProspect.findFirst({
    where: { id, organizationId },
    include: { channel: true, history: { orderBy: { createdAt: 'desc' }, take: 10 } },
  });
}
