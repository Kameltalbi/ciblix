import { describe, expect, it } from 'vitest';
import type { OrgTargetingProfile } from '@prisma/client';
import { criteriaFromTargeting, criteriaHasSearchableFields } from './missionCriteria.js';

function baseProfile(overrides: Partial<OrgTargetingProfile> = {}): OrgTargetingProfile {
  return {
    id: 't1',
    organizationId: 'o1',
    missionStatus: 'ACTIVE',
    missionStep: 7,
    missionCompletedAt: new Date(),
    missionSummary: null,
    companyBrief: 'Test',
    extractedInsights: null,
    activity: null,
    productsServices: [],
    markets: [],
    countries: ['Tunisie'],
    regions: [],
    cities: ['Tunis'],
    targetClients: ['Industriels'],
    idealProfiles: [
      {
        id: 'icp1',
        name: 'PME BTP',
        description: '',
        importance: 5,
        sector: 'BTP',
        companySize: '11-50',
      },
    ],
    sectors: ['Construction'],
    keywords: ['architecture', 'décarbonation'],
    detectSignals: [],
    commercialPriorities: null,
    excludeCompanies: [],
    excludeClients: [],
    excludeCompetitors: [],
    excludePartners: [],
    excludeSectors: [],
    excludeCountries: [],
    orchestratorEnabled: true,
    orchestratorIntervalH: 1,
    lastOrchestratorAt: null,
    minScoutScoreToHandoff: 55,
    identitySourceType: null,
    identitySourceUrl: null,
    identitySourceLabel: null,
    referenceClients: [],
    geoZonePresets: [],
    extractedTenantProfile: null,
    inverseIcp: null,
    inverseIcpText: null,
    offerSheet: null,
    offerValidatedAt: null,
    offerValidatedBy: null,
    learnedPrefs: null,
    ttfrlStartedAt: null,
    ttfrlFirstLeadAt: null,
    onboardingEvents: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('missionCriteria', () => {
  it('construit des critères Prospecteur depuis la Mission / ICP', () => {
    const c = criteriaFromTargeting(baseProfile());
    expect(c.country).toContain('Tunisie');
    expect(c.city).toContain('Tunis');
    expect(c.sector).toMatch(/BTP|Construction/);
    expect(c.companySize).toBe('11-50');
    expect(c.keywords).toMatch(/architecture|Industriels|PME BTP/);
    expect(criteriaHasSearchableFields(c)).toBe(true);
  });

  it('détecte critères vides', () => {
    expect(
      criteriaHasSearchableFields(
        criteriaFromTargeting(
          baseProfile({
            countries: [],
            cities: [],
            sectors: [],
            keywords: [],
            targetClients: [],
            markets: [],
            idealProfiles: [],
          })
        )
      )
    ).toBe(false);
  });
});
