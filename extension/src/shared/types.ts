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
}

export interface ScoreFactor {
  label: string;
  impact: number;
  polarity: 'positive' | 'negative';
}

export interface ProspectQualification {
  score: number;
  scoreLabel: string;
  stars: number;
  scoreFactors: ScoreFactor[];
  isDecisionMaker: boolean;
  probableBudget: string;
  esgMaturity: string;
  responseProbability: number;
  meetingProbability: number;
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

export type ProspectAnalysis = ProspectQualification;

export interface ProspectMemory {
  prospectId: string;
  fullName?: string | null;
  company?: string | null;
  lastContactAt?: string | null;
  lastContactType?: string | null;
  lastResponseSentiment?: string | null;
  lastMeetingAt?: string | null;
  lastProductSlug?: string | null;
  lastProductName?: string | null;
  lastMessagePreview?: string | null;
  events: Array<{ type: string; content?: string | null; createdAt: string }>;
}

export interface ConversationEvent {
  id: string;
  eventType: string;
  content?: string | null;
  createdAt: string;
}

export type ConnectProspectObjective =
  | 'GET_MEETING' | 'PRESENT_CARBOSCAN' | 'PRESENT_SOFTFACTURE' | 'RE_ENGAGE' | 'INVITE_DEMO'
  | 'FIRST_CONTACT' | 'FOLLOW_UP' | 'CUSTOM';

export type ConnectTone = 'professionnel' | 'amical' | 'premium';

export const OBJECTIVES: { value: ConnectProspectObjective; label: string }[] = [
  { value: 'GET_MEETING', label: 'Obtenir un RDV' },
  { value: 'PRESENT_CARBOSCAN', label: 'Présenter CarboScan' },
  { value: 'PRESENT_SOFTFACTURE', label: 'Présenter SoftFacture' },
  { value: 'RE_ENGAGE', label: 'Reprendre contact' },
  { value: 'INVITE_DEMO', label: 'Invitation démo' },
  { value: 'FIRST_CONTACT', label: 'Premier contact' },
  { value: 'FOLLOW_UP', label: 'Relancer' },
];

export const TONES: { value: ConnectTone; label: string }[] = [
  { value: 'professionnel', label: 'Professionnel' },
  { value: 'amical', label: 'Amical' },
  { value: 'premium', label: 'Premium' },
];

export const MSG = {
  PROFILE_EXTRACTED: 'PROFILE_EXTRACTED',
  INSERT_MESSAGE: 'INSERT_MESSAGE',
  MESSAGE_INSERTED: 'MESSAGE_INSERTED',
  GET_AUTH_TOKEN: 'GET_AUTH_TOKEN',
  AUTH_TOKEN: 'AUTH_TOKEN',
  AUTH_CHANGED: 'AUTH_CHANGED',
} as const;
