/** Phases 4-7 — fonctionnalités livrées ou en cours. */
export const BRAND_PULSE_ROADMAP = [
  { phase: 2, title: 'Canaux social & avis', status: 'live', items: ['Détection réseaux sociaux', 'Google Places avis', 'Alertes score & notifications'] },
  { phase: 3, title: 'Publication CMS', status: 'live', items: ['WordPress REST', 'Ghost Admin API', 'Workflow SCHEDULED → PUBLISHED', 'Cron impact SEO'] },
  { phase: 4, title: 'CMS additionnels', status: 'live', items: ['Webflow', 'Shopify Blog', 'Wix', 'Audit articles existants'] },
  { phase: 5, title: 'IA avancée', status: 'live', items: ['Score presse (Google CSE)', 'Score LLM (OpenAI/Claude)', 'Provider Claude optionnel'] },
  { phase: 6, title: 'Concurrents', status: 'live', items: ['Benchmark concurrent', 'Historique snapshots', 'Recommandations par canal'] },
  { phase: 7, title: 'SaaS complet', status: 'live', items: ['Multi-marques (jusqu\'à 5)', 'Rapport mensuel HTML/PDF', 'API publique par clé'] },
] as const;
