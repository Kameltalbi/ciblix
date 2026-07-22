import type { ScoringCriterion } from '../copilot/orgConfig.js';

export type SectorTemplate = {
  id: string;
  label: string;
  sector: string;
  businessLexicon: string;
  scoringGrid: ScoringCriterion[];
};

export const SECTOR_TEMPLATES: SectorTemplate[] = [
  {
    id: 'generic',
    label: 'Générique B2B',
    sector: 'B2B généraliste',
    businessLexicon:
      'Prospection, devis, relance, négociation, signature, livraison, SAV, renouvellement.',
    scoringGrid: [
      { key: 'budget', label: 'Budget ou enveloppe évoquée', weight: 25 },
      { key: 'deadline', label: 'Échéance ou urgence', weight: 20 },
      { key: 'decisionMaker', label: 'Décideur identifié', weight: 20 },
      { key: 'needClarity', label: 'Besoin clairement exprimé', weight: 20 },
      { key: 'engagement', label: 'Engagement / prochaine étape', weight: 15 },
    ],
  },
  {
    id: 'btp',
    label: 'BTP / Construction',
    sector: 'BTP',
    businessLexicon:
      'Chantier, devis travaux, métré, planning, sous-traitance, réception, garantie décennale, appel d\'offres.',
    scoringGrid: [
      { key: 'projectSize', label: 'Taille du projet / budget chantier', weight: 30 },
      { key: 'timeline', label: 'Date de démarrage souhaitée', weight: 20 },
      { key: 'decisionMaker', label: 'Maître d\'ouvrage / décideur', weight: 20 },
      { key: 'location', label: 'Localisation et faisabilité', weight: 15 },
      { key: 'competition', label: 'Concurrence / autres devis', weight: 15 },
    ],
  },
  {
    id: 'assurance',
    label: 'Assurance',
    sector: 'Assurance',
    businessLexicon:
      'Police, prime, sinistre, garantie, souscription, renouvellement, comparateur, risque, couverture.',
    scoringGrid: [
      { key: 'coverageNeed', label: 'Besoin de couverture identifié', weight: 25 },
      { key: 'budget', label: 'Budget prime annuelle', weight: 20 },
      { key: 'urgency', label: 'Urgence (échéance contrat)', weight: 20 },
      { key: 'profile', label: 'Profil risque qualifié', weight: 20 },
      { key: 'documents', label: 'Documents disponibles', weight: 15 },
    ],
  },
  {
    id: 'saas',
    label: 'SaaS / Tech',
    sector: 'SaaS B2B',
    businessLexicon:
      'Démo, POC, intégration API, onboarding, MRR, churn, upsell, support, SLA, sécurité.',
    scoringGrid: [
      { key: 'pain', label: 'Douleur métier claire', weight: 25 },
      { key: 'budget', label: 'Budget IT / enveloppe', weight: 20 },
      { key: 'timeline', label: 'Timeline de décision', weight: 20 },
      { key: 'champion', label: 'Champion interne', weight: 20 },
      { key: 'fit', label: 'Fit produit / use case', weight: 15 },
    ],
  },
];

export function getSectorTemplate(id: string): SectorTemplate | undefined {
  return SECTOR_TEMPLATES.find((t) => t.id === id);
}
