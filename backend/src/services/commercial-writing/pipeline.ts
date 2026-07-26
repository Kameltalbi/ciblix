import type {
  CommercialDraftResult,
  CommercialMessageParams,
  QualityAudit,
  RoleSeparationAudit,
  TargetProfile,
  TenantProfile,
} from './types.js';
import {
  buildGenerationPrompts,
  buildQualityValidatorPrompt,
  buildRoleSeparationValidatorPrompt,
} from './prompts.js';
import { validateOfferFidelity } from './offerFidelity.js';

async function callChat(
  system: string,
  user: string,
  opts?: { temperature?: number; maxTokens?: number; json?: boolean }
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const body: Record<string, unknown> = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: opts?.temperature ?? 0.35,
    max_tokens: opts?.maxTokens ?? 600,
  };
  if (opts?.json) body.response_format = { type: 'json_object' };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() || null;
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : raw) as T;
  } catch {
    return null;
  }
}

const EMPTY_ROLE_OK: RoleSeparationAudit = {
  erreur_detectee: false,
  type_erreur: 'aucune',
  phrase_problematique: '',
  details: '',
};

const EMPTY_QUALITY_OK: QualityAudit = {
  conforme: true,
  problemes: [],
  suggestion_correction: '',
};

function templateFallback(
  tenant: TenantProfile,
  target: TargetProfile,
  params: CommercialMessageParams
): string {
  const offer =
    tenant.services_offerts.slice(0, 4).join(', ') ||
    tenant.value_proposition.slice(0, 200) ||
    'nos solutions pour PME';
  const need = target.besoin_detecte || target.secteur_activite || 'votre activité';
  const sign = tenant.signature;

  if (params.canal === 'whatsapp') {
    return `Bonjour, je vous contacte de la part de ${tenant.nom_entreprise}. Nous proposons ${offer}. Au regard de ${need} chez ${target.nom_entreprise}, un échange court serait utile ?\n${sign}`;
  }
  if (params.canal === 'linkedin') {
    return `Bonjour — j’ai repéré ${target.nom_entreprise} (${need}). Chez ${tenant.nom_entreprise} : ${offer}. Ouvert à échanger 15 min ?`;
  }
  return `Objet: ${tenant.nom_entreprise} × ${target.nom_entreprise}

Bonjour${target.decideur ? ` ${target.decideur}` : ''},

Je me permets de vous écrire au sujet de ${target.nom_entreprise}${
    need ? `, dans un contexte de ${need}` : ''
  }.

Chez ${tenant.nom_entreprise}, nous proposons ${offer}.

Seriez-vous disponible pour un échange de 15 minutes ?

Cordialement,
${sign}`;
}

async function auditRoleSeparation(
  tenant: TenantProfile,
  target: TargetProfile,
  draft: string
): Promise<RoleSeparationAudit> {
  // Garde-fou local d’abord (pas de latence LLM)
  const local = validateOfferFidelity(draft, {
    organizationName: tenant.nom_entreprise,
    organizationBrief: tenant.value_proposition,
    productsServices: tenant.services_offerts,
    organizationSector: tenant.secteur_activite,
  });
  if (!local.ok) {
    return {
      erreur_detectee: true,
      type_erreur: 'confusion_services',
      phrase_problematique: '',
      details: local.reason || 'offre_inventee_ou_confondue',
    };
  }

  const { system, user } = buildRoleSeparationValidatorPrompt(tenant, target, draft);
  const raw = await callChat(system, user, { temperature: 0, maxTokens: 400, json: true });
  const parsed = parseJson<RoleSeparationAudit>(raw);
  if (!parsed || typeof parsed.erreur_detectee !== 'boolean') return EMPTY_ROLE_OK;
  return {
    erreur_detectee: Boolean(parsed.erreur_detectee),
    type_erreur: parsed.type_erreur || 'aucune',
    phrase_problematique: String(parsed.phrase_problematique || ''),
    details: String(parsed.details || ''),
  };
}

async function auditQuality(
  tenant: TenantProfile,
  params: CommercialMessageParams,
  draft: string
): Promise<QualityAudit> {
  const { system, user } = buildQualityValidatorPrompt(draft, tenant, params);
  const raw = await callChat(system, user, { temperature: 0, maxTokens: 400, json: true });
  const parsed = parseJson<QualityAudit>(raw);
  if (!parsed || typeof parsed.conforme !== 'boolean') return EMPTY_QUALITY_OK;
  return {
    conforme: Boolean(parsed.conforme),
    problemes: Array.isArray(parsed.problemes) ? parsed.problemes.map(String) : [],
    suggestion_correction: String(parsed.suggestion_correction || ''),
  };
}

async function generateOnce(
  tenant: TenantProfile,
  target: TargetProfile,
  params: CommercialMessageParams,
  retryFeedback?: string
): Promise<{ body: string; source: 'openai' | 'template' }> {
  const { system, user } = buildGenerationPrompts(tenant, target, params, retryFeedback);
  const ai = await callChat(system, user, { temperature: 0.35, maxTokens: 550 });
  if (ai) return { body: ai, source: 'openai' };
  return { body: templateFallback(tenant, target, params), source: 'template' };
}

/**
 * Pipeline rédaction commerciale :
 * 1) génération (tenant / target séparés)
 * 2) audits rôles + qualité en parallèle (juge indépendant — pas le prompt de gen)
 * 3) 1 seul retry max, sinon needsHumanReview
 */
export async function runCommercialWritingPipeline(
  tenant: TenantProfile,
  target: TargetProfile,
  params: CommercialMessageParams
): Promise<CommercialDraftResult> {
  let draft = await generateOnce(tenant, target, params);
  let retried = false;

  let [roleAudit, qualityAudit] = await Promise.all([
    auditRoleSeparation(tenant, target, draft.body),
    auditQuality(tenant, params, draft.body),
  ]);

  const failed = roleAudit.erreur_detectee || !qualityAudit.conforme;
  if (failed) {
    const feedback = [
      roleAudit.erreur_detectee
        ? `Confusion rôles (${roleAudit.type_erreur}): ${roleAudit.details || roleAudit.phrase_problematique}`
        : null,
      !qualityAudit.conforme
        ? `Qualité: ${(qualityAudit.problemes || []).join('; ') || qualityAudit.suggestion_correction}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');

    draft = await generateOnce(tenant, target, params, feedback);
    retried = true;
    [roleAudit, qualityAudit] = await Promise.all([
      auditRoleSeparation(tenant, target, draft.body),
      auditQuality(tenant, params, draft.body),
    ]);
  }

  // Si toujours confus → template fidèle (jamais un faux pitch)
  if (roleAudit.erreur_detectee) {
    draft = { body: templateFallback(tenant, target, params), source: 'template' };
    roleAudit = EMPTY_ROLE_OK;
  }

  const needsHumanReview =
    roleAudit.erreur_detectee ||
    !qualityAudit.conforme ||
    (retried && draft.source === 'template');

  console.log(
    '[commercial-writing]',
    JSON.stringify({
      tenant: tenant.nom_entreprise,
      target: target.nom_entreprise,
      roleAudit,
      qualityAudit,
      retried,
      source: draft.source,
      needsHumanReview,
    })
  );

  return {
    body: draft.body,
    source: draft.source,
    needsHumanReview,
    roleAudit,
    qualityAudit,
    retried,
  };
}
