import type { ConnectorDefinition } from './types';

/**
 * Catalogue des connecteurs — source unique pour le rendu dynamique.
 * Ajouter un connecteur ici suffit pour qu’il apparaisse sur la page.
 */
export const CONNECTOR_CATALOG: ConnectorDefinition[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'communication',
    description:
      'Les agents IA analysent les échanges, détectent les opportunités et préparent les réponses.',
    capabilities: [
      'Analyse des emails',
      'Détection d’opportunités',
      'Préparation des réponses',
      'Résumé automatique',
    ],
    authType: 'oauth',
    accent: '#EA4335',
    permissions: [
      'Lire les nouveaux messages',
      'Créer des brouillons (sans envoi automatique)',
      'Accéder à l’adresse du compte',
    ],
    configureHref: '/agents/gmail-ai',
  },
  {
    id: 'outlook',
    name: 'Outlook',
    category: 'communication',
    description:
      'Synchronisez Microsoft Outlook pour que les agents suivent les emails professionnels.',
    capabilities: [
      'Analyse des emails',
      'Détection d’opportunités',
      'Préparation des réponses',
      'Résumé automatique',
    ],
    authType: 'oauth',
    accent: '#0078D4',
    comingSoon: true,
    permissions: ['Lire la messagerie', 'Créer des brouillons', 'Accéder au calendrier associé'],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    category: 'communication',
    description:
      'Les agents analysent les conversations, détectent les intentions et préparent les relances.',
    capabilities: [
      'Analyse des conversations',
      'Relances intelligentes',
      'Résumé des échanges',
      'Détection des intentions',
    ],
    authType: 'webhook',
    accent: '#25D366',
    permissions: [
      'Recevoir les messages entrants (webhook Meta)',
      'Contexte des sessions actives',
      'Consentement contact requis',
    ],
    configureHref: '/settings?tab=organization&orgTab=integrations',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    category: 'professional',
    description:
      'Identifiez les décideurs, préparez les messages et suivez les signaux entreprise.',
    capabilities: [
      'Analyse des profils',
      'Identification des décideurs',
      'Préparation des messages',
      'Veille entreprise',
    ],
    authType: 'oauth',
    accent: '#0A66C2',
    comingSoon: true,
    permissions: ['Lire le profil public', 'Suggestions de messages', 'Veille pages entreprise'],
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    category: 'calendar',
    description:
      'Les agents voient vos créneaux pour proposer des rendez-vous au bon moment.',
    capabilities: [
      'Lecture des disponibilités',
      'Proposition de créneaux',
      'Rappels intelligents',
      'Contexte des réunions',
    ],
    authType: 'oauth',
    accent: '#4285F4',
    comingSoon: true,
    permissions: ['Lire les événements', 'Voir les disponibilités'],
  },
  {
    id: 'microsoft-365',
    name: 'Microsoft 365',
    category: 'calendar',
    description:
      'Agenda Outlook / Microsoft 365 pour orchestrer les rendez-vous avec les agents.',
    capabilities: [
      'Lecture des disponibilités',
      'Proposition de créneaux',
      'Rappels intelligents',
      'Contexte des réunions',
    ],
    authType: 'oauth',
    accent: '#D83B01',
    comingSoon: true,
    permissions: ['Lire le calendrier', 'Voir les disponibilités'],
  },
  {
    id: 'website',
    name: 'Site Web',
    category: 'enterprise',
    description:
      'Connectez votre site pour enrichir le contexte métier des agents (pages, offre, actualités).',
    capabilities: [
      'Indexation des pages clés',
      'Contexte produit / offre',
      'Détection des actualités',
      'Alignement messaging',
    ],
    authType: 'api_key',
    accent: '#016AEB',
    comingSoon: true,
    permissions: ['URL publique du site', 'Lecture des pages indexables'],
  },
  {
    id: 'crm',
    name: 'CRM externe',
    category: 'enterprise',
    description:
      'Poussez les événements Ciblix vers votre CRM via webhook sécurisé (HMAC).',
    capabilities: [
      'Webhook sortant signé',
      'Événements pipeline',
      'Emails & notes',
      'Opportunités',
    ],
    authType: 'webhook',
    accent: '#6366F1',
    permissions: ['URL de webhook', 'Secret HMAC', 'Sélection des événements'],
    configureHref: '/settings?tab=organization&orgTab=integrations',
  },
  {
    id: 'softfacture',
    name: 'Softfacture',
    category: 'enterprise',
    description:
      'Facturation Softfacture (service externe) — plan gratuit Softfacture disponible, puis offres payantes sur softfacture.com.',
    capabilities: [
      'Création de devis',
      'Création de factures',
      'PDF documents',
      'Lien clients / opportunités',
    ],
    authType: 'api_key',
    accent: '#0B5FFF',
    permissions: [
      'Compte Softfacture (plan gratuit ou payant)',
      'Clé API Softfacture',
      'URL API Softfacture',
    ],
    externalUrl: 'https://www.softfacture.com',
  },
  {
    id: 'erp',
    name: 'ERP',
    category: 'enterprise',
    description:
      'Reliez votre ERP pour croiser commandes, facturation et pipeline commercial.',
    capabilities: [
      'Sync clients / commandes',
      'Contexte facturation',
      'Alertes stock / délai',
      'Enrichissement contacts',
    ],
    authType: 'api_key',
    accent: '#0F766E',
    comingSoon: true,
    permissions: ['Clé API', 'Endpoint sécurisé'],
  },
  {
    id: 'rne',
    name: 'RNE',
    category: 'public',
    description:
      'Registre National des Entreprises — enrichissement légal et données société (Tunisie).',
    capabilities: ['Fiche entreprise', 'Dirigeants', 'Statut juridique', 'Enrichissement leads'],
    authType: 'api_key',
    accent: '#B45309',
    comingSoon: true,
    permissions: ['Accès API publique / partenaire'],
  },
  {
    id: 'tuneps',
    name: 'TUNEPS',
    category: 'public',
    description:
      'Marchés publics tunisiens — source pour le Veilleur IA et la détection d’appels d’offres.',
    capabilities: [
      'Veille appels d’offres',
      'Alertes pertinence',
      'Enrichissement opportunités',
      'Histor historique',
    ],
    authType: 'api_key',
    accent: '#1D4ED8',
    comingSoon: true,
    permissions: ['Accès sources publiques'],
  },
];
