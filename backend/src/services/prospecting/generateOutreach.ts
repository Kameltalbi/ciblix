import type { CompanySearchHit, OutreachMessageType } from './types.js';
import {
  buildTargetProfile,
  buildTenantProfile,
  runCommercialWritingPipeline,
  type CommercialChannel,
  type MessageObjective,
} from '../commercial-writing/index.js';
import {
  validateGeneratedMessage,
  validateOfferFidelity,
  ourOfferTokens,
} from '../commercial-writing/offerFidelity.js';

export type OutreachTone = 'doux' | 'commercial' | 'ferme';

export type OutreachSenderContext = {
  organizationName: string;
  organizationSector?: string | null;
  organizationBrief?: string | null;
  productsServices?: string[];
  commercialPriorities?: string | null;
  senderName?: string | null;
  /** Produits catalogue Product (fiche validée). */
  catalogProductNames?: string[];
};

export type OutreachProspectContext = CompanySearchHit & {
  probableBusinessProblem?: string | null;
  commercialAngle?: string | null;
  suggestedPitch?: string | null;
  aiSummary?: string | null;
  decideur?: string | null;
};

export { validateGeneratedMessage, validateOfferFidelity, ourOfferTokens };

function mapChannel(type: OutreachMessageType): CommercialChannel {
  if (type === 'WHATSAPP') return 'whatsapp';
  if (type === 'LINKEDIN') return 'linkedin';
  return 'email';
}

function mapObjective(type: OutreachMessageType): MessageObjective {
  if (type === 'FOLLOW_UP') return 'relance';
  if (type === 'VALUE_PROPOSITION') return 'proposition_valeur';
  return 'premier_contact';
}

/**
 * Génère un message de prospection via le pipeline commercial-writing
 * (tenant/target séparés + audits indépendants + 1 retry max).
 */
export async function generateOutreachMessage(
  hit: OutreachProspectContext,
  type: OutreachMessageType,
  tone: OutreachTone = 'commercial',
  sender?: OutreachSenderContext
): Promise<{
  body: string;
  source: 'openai' | 'template';
  signatureWarning: boolean;
  needsHumanReview?: boolean;
  roleAudit?: unknown;
  qualityAudit?: unknown;
}> {
  const senderCtx: OutreachSenderContext = {
    organizationName: sender?.organizationName?.trim() || 'Notre entreprise',
    organizationSector: sender?.organizationSector ?? null,
    organizationBrief: sender?.organizationBrief ?? null,
    productsServices: sender?.productsServices ?? [],
    commercialPriorities: sender?.commercialPriorities ?? null,
    senderName: sender?.senderName?.trim() || null,
    catalogProductNames: sender?.catalogProductNames ?? [],
  };

  const tenant = buildTenantProfile({
    organizationName: senderCtx.organizationName,
    targeting: {
      companyBrief: senderCtx.organizationBrief,
      activity: senderCtx.organizationBrief,
      missionSummary: null,
      productsServices: senderCtx.productsServices || [],
      sectors: senderCtx.organizationSector
        ? senderCtx.organizationSector.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      commercialPriorities: senderCtx.commercialPriorities,
    },
    catalogProductNames: senderCtx.catalogProductNames || [],
    senderName: senderCtx.senderName,
    ton: tone,
  });

  const target = buildTargetProfile({
    companyName: hit.companyName,
    industry: hit.industry,
    decideur: hit.decideur,
    besoin: [hit.probableBusinessProblem, hit.commercialAngle, hit.aiSummary]
      .filter(Boolean)
      .join(' — '),
    city: hit.city,
    country: hit.country,
  });

  const result = await runCommercialWritingPipeline(tenant, target, {
    canal: mapChannel(type),
    langue: 'français',
    objectif: mapObjective(type),
  });

  const idCheck = validateGeneratedMessage(
    result.body,
    hit.companyName,
    senderCtx.organizationName
  );

  return {
    body: result.body,
    source: result.source,
    signatureWarning: !idCheck.ok || result.needsHumanReview,
    needsHumanReview: result.needsHumanReview,
    roleAudit: result.roleAudit,
    qualityAudit: result.qualityAudit,
  };
}
