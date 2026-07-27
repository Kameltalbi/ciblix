/** Types partagés Connect AI / Copilote Commercial — couche Core. */

export type ConnectChannelSlug =
  | 'LINKEDIN' | 'GMAIL' | 'OUTLOOK' | 'WHATSAPP' | 'FACEBOOK'
  | 'INSTAGRAM' | 'TWITTER' | 'CRM' | 'HUBSPOT' | 'SALESFORCE';

export type ConnectMessageStrategy =
  | 'CONNECTION' | 'FIRST_MESSAGE' | 'FOLLOW_UP' | 'POST_MEETING'
  | 'INTRODUCTION' | 'DEMO_INVITE' | 'MEETING_REQUEST' | 'CUSTOM';

export type ConnectProductChoice = string; // slug dynamique depuis le catalogue

export type ConnectProspectObjective =
  | 'GET_MEETING'
  | 'PRESENT_CARBOSCAN'
  | 'PRESENT_SOFTFACTURE'
  | 'RE_ENGAGE'
  | 'INVITE_DEMO'
  | 'FIRST_CONTACT'
  | 'FOLLOW_UP'
  | 'CUSTOM';

export type ConnectTone = 'professionnel' | 'amical' | 'premium';

export interface ScoreFactor {
  label: string;
  impact: number;
  polarity: 'positive' | 'negative';
}

/** Profil enrichi extrait du canal (LinkedIn complet). */
export interface ProspectProfile {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  company?: string;
  jobTitle?: string;
  country?: string;
  sector?: string;
  profileUrl?: string;
  headline?: string;
  description?: string;
  connectionCount?: number;
  companySize?: string;
  companyDescription?: string;
  experience?: Array<{ title?: string; company?: string; duration?: string; text?: string }>;
  education?: Array<{ school?: string; degree?: string; text?: string }>;
  skills?: string[];
  recentActivity?: string[];
  publications?: string[];
  raw?: Record<string, unknown>;
}

/** Qualification commerciale complète — le cœur du copilote. */
export interface ProspectQualification {
  score: number;
  scoreLabel: string;
  stars: number;
  scoreFactors: ScoreFactor[];

  isDecisionMaker: boolean;
  probableBudget: 'low' | 'medium' | 'high' | 'unknown';
  esgMaturity: 'low' | 'medium' | 'high' | 'unknown';
  responseProbability: number;
  meetingProbability: number;

  sector?: string;
  companySize?: string;
  decisionLevel?: string;
  language?: string;

  summary: string;
  contextualInsight: string;
  timingSignal?: string;

  bestAngles: string[];
  avoidTopics: string[];
  recommendedSubject: string;

  recommendedProductSlug: string;
  recommendedProductName: string;
  productReason: string;

  risks: string;
  opportunitiesBullets?: string[];
}

export interface CommercialProduct {
  slug: string;
  name: string;
  description?: string | null;
  icp?: string | null;
  arguments: string[];
  objections: string[];
  cta?: string | null;
}

export interface UserMemory {
  preferredTone: ConnectTone;
  messageLength: string;
  avoidPhrases: string[];
  styleNotes: string[];
}

export interface ProspectMemorySummary {
  prospectId: string;
  fullName?: string | null;
  company?: string | null;
  lastContactAt?: string | null;
  lastContactType?: string | null;
  lastResponseSentiment?: 'positive' | 'neutral' | 'negative' | null;
  lastMeetingAt?: string | null;
  lastProductSlug?: string | null;
  lastProductName?: string | null;
  lastMessagePreview?: string | null;
  objective?: string | null;
  pipelineStage?: string | null;
  events: Array<{ type: string; content?: string | null; createdAt: string }>;
}

export interface GenerateMessageInput {
  organizationId: string;
  userId: string;
  channelSlug: ConnectChannelSlug;
  strategy: ConnectMessageStrategy;
  objective?: ConnectProspectObjective;
  productSlug?: string;
  profile: ProspectProfile;
  qualification?: ProspectQualification;
  history?: string[];
  context?: string;
  customPrompt?: string;
  userMemory?: UserMemory;
  tone?: ConnectTone;
}

export interface GeneratedMessageResult {
  content: string;
  productSlug: string;
  strategy: ConnectMessageStrategy;
  promptVersionId?: string;
  aiModel?: string;
  generationMs: number;
  source: 'openai' | 'template';
}

export const OBJECTIVE_LABELS: Record<ConnectProspectObjective, string> = {
  GET_MEETING: 'Obtenir un rendez-vous',
  PRESENT_CARBOSCAN: 'Présenter CarboScan',
  PRESENT_SOFTFACTURE: 'Présenter SoftFacture',
  RE_ENGAGE: 'Reprendre contact',
  INVITE_DEMO: 'Inviter à une démo',
  FIRST_CONTACT: 'Premier contact',
  FOLLOW_UP: 'Relancer',
  CUSTOM: 'Objectif libre',
};

export interface ConnectSettings {
  language: string;
  tone: ConnectTone;
  style: string;
  length: string;
  favoriteProducts: string[];
  signature?: string | null;
  customPrompt?: string | null;
}

export const TONE_LABELS: Record<ConnectTone, string> = {
  professionnel: 'Professionnel',
  amical: 'Amical',
  premium: 'Premium',
};

/** @deprecated Utiliser ProspectQualification */
export type ProspectAnalysis = ProspectQualification;
