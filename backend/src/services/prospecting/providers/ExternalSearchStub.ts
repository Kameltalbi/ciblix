import type { CompanySearchCriteria, CompanySearchHit, CompanySearchPort, ProspectingSearchProviderId } from '../types.js';

/**
 * Stub pour futurs connecteurs (Apollo, Hunter, Google Places, Clearbit).
 * Retourne [] tant que les clés / SDK ne sont pas branchés — évite tout hardcode métier.
 */
export class ExternalSearchStub implements CompanySearchPort {
  constructor(public readonly id: Exclude<ProspectingSearchProviderId, 'mock'>) {}

  async searchCompanies(_criteria: CompanySearchCriteria): Promise<CompanySearchHit[]> {
    return [];
  }
}
