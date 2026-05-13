/**
 * Architecture future : synchronisation des échanges commerciaux (Gmail / Outlook).
 * Les implémentations réelles restent dans le backend (`routes/gmail.ts`, services).
 */

export type EmailProviderId = 'gmail' | 'outlook';

export interface EmailProviderDefinition {
  id: EmailProviderId;
  displayName: string;
  /** OAuth2 ou Graph — à brancher côté API */
  authKind: 'oauth2';
  /** Capacités prévues pour l’analyse IA des fils */
  plannedCapabilities: readonly ('read_threads' | 'sync_contacts' | 'draft_reply')[];
}

export const PLANNED_EMAIL_PROVIDERS: EmailProviderDefinition[] = [
  {
    id: 'gmail',
    displayName: 'Google Gmail',
    authKind: 'oauth2',
    plannedCapabilities: ['read_threads', 'sync_contacts', 'draft_reply'],
  },
  {
    id: 'outlook',
    displayName: 'Microsoft Outlook',
    authKind: 'oauth2',
    plannedCapabilities: ['read_threads', 'sync_contacts', 'draft_reply'],
  },
];

export function describeEmailSyncRoadmap(): string {
  return PLANNED_EMAIL_PROVIDERS.map((p) => `${p.displayName} (${p.plannedCapabilities.join(', ')})`).join(' · ');
}
