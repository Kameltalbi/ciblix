import { prisma } from '../../db/prisma.js';
import type { BrandProfile } from '@prisma/client';

export async function getPrimaryBrandProfile(organizationId: string): Promise<BrandProfile | null> {
  return prisma.brandProfile.findFirst({
    where: { organizationId, isPrimary: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getBrandProfileBySlug(organizationId: string, slug: string): Promise<BrandProfile | null> {
  return prisma.brandProfile.findUnique({
    where: { organizationId_slug: { organizationId, slug } },
  });
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
  const existing = await getPrimaryBrandProfile(organizationId);
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
