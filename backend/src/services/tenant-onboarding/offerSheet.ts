import type { ExtractedTenantProfile, OfferSheet, OfferServiceItem } from './types.js';

export function buildOfferSheetDraft(extracted: ExtractedTenantProfile | null): OfferSheet {
  const services = extracted?.services_et_produits.value || [];
  const source = extracted?.services_et_produits.source || null;
  const items: OfferServiceItem[] = services.map((libelle) => ({
    libelle,
    description_courte: '',
    cible_typique: '',
    valide_par_tenant: true,
    source_extraction: source,
  }));

  return {
    services_valides: items,
    proposition_de_valeur: extracted?.proposition_de_valeur.value || '',
    validee_le: null,
    validee_par: null,
  };
}

export function isOfferSheetValidated(sheet: OfferSheet | null | undefined): boolean {
  if (!sheet?.validee_le) return false;
  const ok = (sheet.services_valides || []).filter((s) => s.valide_par_tenant && s.libelle.trim());
  return ok.length > 0;
}

export function validatedServiceLabels(sheet: OfferSheet | null | undefined): string[] {
  if (!isOfferSheetValidated(sheet)) return [];
  return (sheet!.services_valides || [])
    .filter((s) => s.valide_par_tenant && s.libelle.trim())
    .map((s) => s.libelle.trim());
}

/** Verrou technique Rédacteur — recherche autorisée, messages interdits. */
export function assertRedacteurMayGenerate(opts: {
  offerSheet: OfferSheet | null | undefined;
  productsServices?: string[] | null;
}): { ok: boolean; code?: string; message?: string } {
  if (isOfferSheetValidated(opts.offerSheet)) return { ok: true };
  // Compat : produits/services Mission renseignés (même si offerSheet brouillon non validé)
  if ((opts.productsServices || []).filter(Boolean).length > 0) {
    return { ok: true };
  }
  return {
    ok: false,
    code: 'OFFER_SHEET_REQUIRED',
    message:
      'Indiquez vos services / produits dans la Mission avant de générer un message. La recherche d’entreprises reste disponible.',
  };
}
