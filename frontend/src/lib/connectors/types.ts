export type ConnectorCategory =
  | 'communication'
  | 'professional'
  | 'calendar'
  | 'enterprise'
  | 'public';

export type ConnectorAuthType = 'oauth' | 'api_key' | 'webhook' | 'manual';

export type ConnectorStatus = 'connected' | 'disconnected' | 'expired' | 'coming_soon';

export type ConnectorStat = {
  label: string;
  value: string;
};

export type ConnectorDefinition = {
  id: string;
  name: string;
  category: ConnectorCategory;
  description: string;
  capabilities: string[];
  authType: ConnectorAuthType;
  /** Brand accent for icon tile */
  accent: string;
  comingSoon?: boolean;
  /** Permissions shown in the connect wizard */
  permissions: string[];
  configureHref?: string;
  /** Lien externe (ex. Softfacture) ouvert à la connexion / config */
  externalUrl?: string;
};

export type ConnectorRuntime = ConnectorDefinition & {
  status: ConnectorStatus;
  lastSyncAt?: string | null;
  stats?: ConnectorStat[];
  accountLabel?: string | null;
};

export const CONNECTOR_CATEGORY_ORDER: ConnectorCategory[] = [
  'communication',
  'professional',
  'calendar',
  'enterprise',
  'public',
];

export const CONNECTOR_CATEGORY_LABELS: Record<ConnectorCategory, string> = {
  communication: 'Communication',
  professional: 'Réseaux professionnels',
  calendar: 'Agenda',
  enterprise: 'Données entreprise',
  public: 'Sources publiques',
};
