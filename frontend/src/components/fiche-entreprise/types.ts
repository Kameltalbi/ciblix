/** Vue lecture seule de ficheData — miroir du contrat backend (sans score affiché). */

export type FicheEntrepriseDataView = {
  identite_entreprise?: { nom_legal?: string | null } | null;
  secteur_declare?: string | null;
  taille_estimee?: string | null;
  zone_geographique?: string | null;
  decideur?: {
    nom?: string | null;
    fonction?: string | null;
    canal_prefere?: 'email' | 'whatsapp' | 'linkedin' | 'telephone' | null;
  } | null;
  besoin_detecte?: string | null;
  score_fit?: number | null;
  raison_du_score?: string | null;
  message_brouillon?: string | null;
  message_canal?: string | null;
  historique_interactions?: Array<{ at: string; canal: string; resume: string }> | null;
  prochaine_action?: string | null;
  date_relance?: string | null;
  objections_detectees?: string[] | null;
  signaux_externes?: Array<{ at: string; titre: string; source_url?: string | null }> | null;
};
