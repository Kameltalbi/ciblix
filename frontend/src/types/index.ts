export type AffaireType = string;
export type StatutAffaire = 'PROSPECT' | 'QUALIFIE' | 'PROPOSITION' | 'NEGOCIATION' | 'GAGNE' | 'PERDU';
export type ActiviteType = 'NOTE' | 'APPEL' | 'EMAIL_ENVOYE' | 'EMAIL_RECU' | 'RDV' | 'CHANGEMENT_STATUT' | 'DEVIS_CREE' | 'FACTURE_CREEE' | 'AUTRE';
export type UserRole = 'OWNER' | 'PARTNER' | 'COMMERCIAL' | 'SUPERADMIN';
export type ProductType = 'SERVICE' | 'PRODUCT';
export type NotificationType =
  | 'AFFAIRE_SANS_ACTIVITE'
  | 'TASK_OVERDUE'
  | 'AFFAIRE_PERDUE'
  | 'AFFAIRE_GAGNEE'
  | 'DEVIS_CREE'
  | 'FACTURE_CREEE'
  | 'RAPPEL'
  | 'SUPPORT_TICKET_NEW'
  | 'SUPPORT_TICKET_REPLY';

export interface Organization {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tva: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  organizationId: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  type: ProductType;
  categoryId: string | null;
  category?: { id: string; name: string; type: string } | null;
  active: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  matricule?: string | null;
  qualificatif?: string | null;
  notes?: string | null;
  organizationId: string;
  _count?: { affaires: number };
}

export interface Affaire {
  id: string;
  clientId: string;
  productId: string | null;
  type: AffaireType;
  title: string;
  description: string | null;
  montantHT: number;
  statut: StatutAffaire;
  probabilite: number;
  score: number;
  moisPrevu: number;
  anneePrevue: number;
  dateClotureReelle: string | null;
  prochaineAction: string | null;
  dateProchaineAction: string | null;
  viaPartenaire: boolean;
  tauxCommission: number;
  assignedToId: string | null;
  assignedTo?: User;
  devisId: string | null;
  devisNumero: string | null;
  devisPdfUrl: string | null;
  factureId: string | null;
  factureNumero: string | null;
  facturePdfUrl: string | null;
  notes: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  product?: Product;
  activites?: Activite[];
  _count?: { activites: number };
}

export interface Activite {
  id: string;
  affaireId: string;
  type: ActiviteType;
  title: string;
  content?: string | null;
  organizationId: string;
  createdAt: string;
}

export interface SmartForecast {
  forecast: number;
  lowerBound: number;
  upperBound: number;
  confidenceScore: number;
  conversionRates: {
    overall: number;
    prospectToPipeline: number;
    pipelineToRealise: number;
  };
  breakdown: {
    realise: number;
    adjustedPipeline: number;
    adjustedProspect: number;
  };
}

export interface KPIs {
  annee: number;
  caRealise: number;
  caPipeline: number;
  caProspection: number;
  caTotal: number;
  caTotalAll: number; // All statuses except PERDU
  caPondere: number;
  commissionPartenaireDue: number;
  netRealise: number;
  parType: Record<string, number>;
  counts: { gagne: number; enCours: number; prospect: number; perdu: number };
  parMois: Record<number, { realise: number; pipeline: number; prospect: number }>;
  smartForecast?: SmartForecast;
}

export interface PrevisionMois {
  id: string;
  annee: number;
  mois: number;
  nbBilansPrevu: number;
  prixMoyenBilan: number;
  joursFormation: number;
  tarifJourFormation: number;
  estEte: boolean;
  tauxPartenaire: number;
  caBilansPrevu: number;
  caFormationsPrevu: number;
  caTotalPrevu: number;
  commissionEstimee: number;
  netEstime: number;
  caReelRealise: number;
  caPrevuMois: number;
  chargeJours: number;
  notes?: string | null;
}

export interface Previsionnel {
  annee: number;
  mois: PrevisionMois[];
  totaux: {
    caBrutHT: number;
    caBilansHT: number;
    caFormationsHT: number;
    commissionEstimee: number;
    tvaCollectee: number;
    netHT: number;
    caTTC: number;
    caReelRealise: number;
    caTotalAnnuel: number;
    caRealiseAnnuel: number;
    caPrevuAnnuel: number;
    moyenneMensuelle: number;
    caProjete: number;
    moisCourant: number;
    anneeCourante: number;
  };
  caParMois?: Record<number, { realise: number; previsionnel: number }>;
}

export interface Notification {
  id: string;
  userId: string;
  organizationId: string;
  type: NotificationType;
  title: string;
  content: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}
