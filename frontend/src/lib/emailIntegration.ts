/**
 * Intégration e-mail : Gmail IA est actif (lecture + brouillons).
 * Outlook reste planifié.
 */

export type EmailProviderId = 'gmail' | 'outlook';

export interface EmailProviderDefinition {
  id: EmailProviderId;
  displayName: string;
  authKind: 'oauth2';
  plannedCapabilities: readonly ('read_threads' | 'sync_contacts' | 'draft_reply')[];
  status: 'live' | 'planned';
}

export const PLANNED_EMAIL_PROVIDERS: EmailProviderDefinition[] = [
  {
    id: 'gmail',
    displayName: 'Google Gmail',
    authKind: 'oauth2',
    plannedCapabilities: ['read_threads', 'draft_reply'],
    status: 'live',
  },
  {
    id: 'outlook',
    displayName: 'Microsoft Outlook',
    authKind: 'oauth2',
    plannedCapabilities: ['read_threads', 'sync_contacts', 'draft_reply'],
    status: 'planned',
  },
];

export function describeEmailSyncRoadmap(): string {
  return PLANNED_EMAIL_PROVIDERS.map(
    (p) => `${p.displayName} [${p.status}] (${p.plannedCapabilities.join(', ')})`
  ).join(' · ');
}
