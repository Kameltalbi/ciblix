import { prisma } from '../../db/prisma.js';
import type { BrandProfile } from '@prisma/client';

/** Marque active (isPrimary) — celle affichée dans le dashboard. */
export async function getActiveBrandProfile(organizationId: string): Promise<BrandProfile | null> {
  return prisma.brandProfile.findFirst({
    where: { organizationId, isPrimary: true },
    orderBy: { createdAt: 'asc' },
  });
}

/** @deprecated Alias — utiliser getActiveBrandProfile */
export const getPrimaryBrandProfile = getActiveBrandProfile;

export async function getBrandProfileBySlug(organizationId: string, slug: string): Promise<BrandProfile | null> {
  return prisma.brandProfile.findUnique({
    where: { organizationId_slug: { organizationId, slug } },
  });
}

export async function getBrandProfileById(organizationId: string, brandProfileId: string): Promise<BrandProfile | null> {
  return prisma.brandProfile.findFirst({
    where: { id: brandProfileId, organizationId },
  });
}

export async function activateBrandProfile(organizationId: string, brandProfileId: string): Promise<BrandProfile> {
  const brand = await getBrandProfileById(organizationId, brandProfileId);
  if (!brand) {
    throw Object.assign(new Error('Marque introuvable'), { statusCode: 404 });
  }

  await prisma.$transaction([
    prisma.brandProfile.updateMany({
      where: { organizationId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.brandProfile.update({
      where: { id: brandProfileId },
      data: { isPrimary: true },
    }),
  ]);

  const active = await prisma.brandProfile.findUnique({ where: { id: brandProfileId } });
  if (!active) {
    throw Object.assign(new Error('Marque introuvable'), { statusCode: 404 });
  }
  return active;
}

export async function upsertPrimaryBrandProfile(
  organizationId: string,
  data: {
    brandName: string;
    websiteUrl: string;
    sector?: string | null;
    competitorName?: string | null;
    competitorUrl?: string | null;
    brandKeywords: string[];
    editorialTone: string;
    articlesPerWeek: number;
    onboardingDone?: boolean;
  },
): Promise<BrandProfile> {
  const existing = await getActiveBrandProfile(organizationId);
  if (existing) {
    return prisma.brandProfile.update({
      where: { id: existing.id },
      data: {
        brandName: data.brandName,
        websiteUrl: data.websiteUrl,
        sector: data.sector ?? null,
        competitorName: data.competitorName ?? null,
        competitorUrl: data.competitorUrl ?? null,
        brandKeywords: data.brandKeywords,
        editorialTone: data.editorialTone,
        articlesPerWeek: data.articlesPerWeek,
        onboardingDone: data.onboardingDone ?? undefined,
      },
    });
  }
  return prisma.brandProfile.create({
    data: {
      organizationId,
      slug: 'primary',
      isPrimary: true,
      brandName: data.brandName,
      websiteUrl: data.websiteUrl,
      sector: data.sector ?? null,
      competitorName: data.competitorName ?? null,
      competitorUrl: data.competitorUrl ?? null,
      brandKeywords: data.brandKeywords,
      editorialTone: data.editorialTone,
      articlesPerWeek: data.articlesPerWeek,
      onboardingDone: data.onboardingDone ?? false,
    },
  });
}
