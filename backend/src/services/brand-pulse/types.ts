export type BrandChannel = 'SEO' | 'SOCIAL' | 'REVIEWS' | 'PRESS' | 'LLM' | 'WEBSITE' | 'GLOBAL';

export const CHANNEL_WEIGHTS: Record<Exclude<BrandChannel, 'GLOBAL'>, number> = {
  SEO: 0.25,
  SOCIAL: 0.2,
  REVIEWS: 0.2,
  PRESS: 0.15,
  LLM: 0.1,
  WEBSITE: 0.1,
};

export type ArticleFormat = 'SEO' | 'LONGFORM' | 'FAQ' | 'COMPARATIVE';

export type ArticleStatus =
  | 'PROPOSED'
  | 'DRAFTING'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SCHEDULED'
  | 'PUBLISHED';

export interface SeoAuditResult {
  url: string;
  fetchedAt: string;
  responseMs: number;
  https: boolean;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  h1Text: string | null;
  hasCanonical: boolean;
  hasOgTitle: boolean;
  wordCountApprox: number;
  issues: string[];
  strengths: string[];
}

export interface ChannelScore {
  channel: BrandChannel;
  score: number;
  weight: number;
  details: Record<string, unknown>;
}

export interface ProposedTopic {
  title: string;
  format: ArticleFormat;
  targetKeywords: string[];
  reason: string;
  estimatedImpact: number;
  priority: number;
}
