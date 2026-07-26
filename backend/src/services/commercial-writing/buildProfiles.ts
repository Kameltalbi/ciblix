import type { BrandTone, TargetProfile, TenantProfile } from './types.js';
import { mapToneToBrand } from './prompts.js';

type TargetingSlice = {
  companyBrief?: string | null;
  activity?: string | null;
  missionSummary?: string | null;
  productsServices?: string[] | null;
  sectors?: string[] | null;
  commercialPriorities?: string | null;
};

type CatalogProduct = { name: string; description?: string | null; price?: unknown };

/**
 * Construit le tenant_profile UNIQUEMENT depuis des fiches validées
 * (Mission + catalogue Product) — jamais depuis le nom d’entreprise seul.
 */
export function buildTenantProfile(opts: {
  organizationName: string;
  targeting: TargetingSlice | null;
  catalogProducts?: CatalogProduct[];
  catalogProductNames?: string[];
  senderName?: string | null;
  ton?: string | null;
}): TenantProfile {
  const catalogNames = [
    ...(opts.catalogProductNames || []),
    ...(opts.catalogProducts || []).map((p) => p.name),
  ]
    .map((p) => p.trim())
    .filter(Boolean);
  const missionProducts = (opts.targeting?.productsServices || [])
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const services_offerts: string[] = [];
  for (const s of [...missionProducts, ...catalogNames]) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    services_offerts.push(s);
  }

  const value =
    opts.targeting?.companyBrief?.trim() ||
    opts.targeting?.activity?.trim() ||
    opts.targeting?.missionSummary?.trim() ||
    opts.targeting?.commercialPriorities?.trim() ||
    '';

  const secteur = (opts.targeting?.sectors || []).filter(Boolean).slice(0, 4).join(', ');

  const signature = [opts.senderName?.trim(), opts.organizationName.trim()]
    .filter(Boolean)
    .join('\n');

  return {
    nom_entreprise: opts.organizationName.trim() || 'Notre entreprise',
    secteur_activite: secteur,
    services_offerts,
    value_proposition: value,
    ton_de_marque: mapToneToBrand(opts.ton) as BrandTone,
    signature: signature || opts.organizationName.trim() || 'Notre équipe',
  };
}

export function buildTargetProfile(opts: {
  companyName: string;
  industry?: string | null;
  decideur?: string | null;
  besoin?: string | null;
  historique?: string | null;
  city?: string | null;
  country?: string | null;
}): TargetProfile {
  const geo = [opts.city, opts.country].filter(Boolean).join(', ');
  const secteur = [opts.industry?.trim(), geo || null].filter(Boolean).join(' — ');
  return {
    nom_entreprise: opts.companyName.trim() || 'Prospect',
    secteur_activite: secteur,
    besoin_detecte: opts.besoin?.trim() || '',
    decideur: opts.decideur?.trim() || '',
    contexte_derniere_interaction: opts.historique?.trim() || '',
  };
}
