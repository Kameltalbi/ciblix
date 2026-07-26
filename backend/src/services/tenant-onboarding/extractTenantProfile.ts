import { enrichWebsiteFromUrl } from '../prospecting/websiteEnrichment.js';
import {
  emptySourced,
  sourced,
  type ExtractedTenantProfile,
  type IdentitySourceType,
} from './types.js';

async function callOpenAiJson(system: string, user: string): Promise<Record<string, unknown> | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 1400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 20);
}

/**
 * Extraction multi-source avec traçabilité.
 * INTERDIT : remplir un champ par seule connaissance du modèle / nom d’entreprise.
 */
export async function extractTenantProfile(opts: {
  sourceType: IdentitySourceType;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  /** Nom + phrase libre (name_brief) ou texte PDF déjà extrait */
  freeText?: string | null;
}): Promise<{ profile: ExtractedTenantProfile; progress: string[] }> {
  const progress: string[] = [];
  const sourceRef =
    opts.sourceUrl?.trim() ||
    opts.sourceLabel?.trim() ||
    (opts.sourceType === 'name_brief' ? 'saisie_utilisateur' : null);

  let corpus = (opts.freeText || '').trim();
  let pageTitle: string | null = null;
  let emails: string[] = [];
  let phones: string[] = [];

  if (
    (opts.sourceType === 'website' ||
      opts.sourceType === 'facebook' ||
      opts.sourceType === 'linkedin') &&
    opts.sourceUrl?.trim()
  ) {
    progress.push('Analyse de la page fournie…');
    try {
      const enrich = await enrichWebsiteFromUrl(opts.sourceUrl.trim());
      corpus = [enrich.websiteTitle, enrich.websiteDescription, ...(enrich.productsServices || [])]
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 12000);
      // Enrichissement natif = peu de body text : on récupère aussi le HTML title/desc
      if (corpus.length < 80 && enrich.fetchedUrl) {
        corpus = [enrich.websiteTitle, enrich.websiteDescription, enrich.fetchedUrl]
          .filter(Boolean)
          .join('\n');
      }
      pageTitle = enrich.websiteTitle || null;
      emails = enrich.detectedEmails || [];
      phones = enrich.phoneFromPage ? [enrich.phoneFromPage] : [];
      progress.push(
        corpus.length > 40
          ? 'Contenu récupéré — extraction des services…'
          : 'Peu de texte trouvé — extraction limitée…'
      );
    } catch {
      progress.push('Impossible de lire la page — bascule sur le texte fourni.');
    }
  } else if (opts.sourceType === 'pdf') {
    progress.push('Analyse du document…');
  } else {
    progress.push('Analyse de votre description…');
  }

  const source = sourceRef || 'saisie_utilisateur';
  const baseEmpty = (): ExtractedTenantProfile => ({
    nom_legal: emptySourced(source),
    noms_commerciaux: emptySourced(source),
    secteur_activite: emptySourced(source),
    services_et_produits: emptySourced(source),
    proposition_de_valeur: emptySourced(source),
    zone_actuelle_d_activite: emptySourced(source),
    langues_utilisees: emptySourced(source),
    ton_editorial_apparent: emptySourced(source),
    email_public: emptySourced(source),
    telephone_public: emptySourced(source),
    adresse_publique: emptySourced(source),
    canaux_presents: emptySourced(source),
    raw_text_chars: corpus.length,
    extracted_at: new Date().toISOString(),
  });

  if (corpus.length < 40 && !pageTitle) {
    progress.push('Texte insuffisant — champs laissés vides (pas d’invention).');
    const p = baseEmpty();
    if (opts.freeText?.trim()) {
      // Uniquement ce qui est explicitement saisi
      const firstLine = opts.freeText.trim().split('\n')[0]?.slice(0, 120) || null;
      p.nom_legal = sourced(firstLine, source, 0.4);
      p.proposition_de_valeur = sourced(opts.freeText.trim().slice(0, 400), source, 0.35);
    }
    return { profile: p, progress };
  }

  progress.push('Structuration IA des faits présents dans le texte…');
  const system = `Tu extrais UNIQUEMENT des faits présents dans le TEXTE SOURCE fourni.
RÈGLE ABSOLUE : si une info n'apparaît pas clairement dans le texte, renvoie null / [] — 
NE JAMAIS inventer à partir du nom de l'entreprise ou de ta connaissance générale.
JSON :
{
  "nom_legal": string|null,
  "noms_commerciaux": string[],
  "secteur_activite": string|null,
  "services_et_produits": string[],
  "proposition_de_valeur": string|null,
  "zone_actuelle_d_activite": string|null,
  "langues_utilisees": string[],
  "ton_editorial_apparent": "formel"|"direct"|"chaleureux"|null,
  "adresse_publique": string|null,
  "canaux_presents": string[],
  "field_confidence": { "services_et_produits": 0.0-1.0, "secteur_activite": 0.0-1.0 }
}`;

  const parsed = await callOpenAiJson(
    system,
    `SOURCE: ${source}\nTITRE: ${pageTitle || '—'}\n\nTEXTE:\n${corpus.slice(0, 10000)}`
  );

  const conf = (parsed?.field_confidence || {}) as Record<string, number>;
  const profile = baseEmpty();

  if (parsed) {
    profile.nom_legal = sourced(
      typeof parsed.nom_legal === 'string' ? parsed.nom_legal : pageTitle,
      source,
      typeof parsed.nom_legal === 'string' ? 0.75 : pageTitle ? 0.5 : 0
    );
    profile.noms_commerciaux = sourced(asStringList(parsed.noms_commerciaux), source, 0.6);
    profile.secteur_activite = sourced(
      typeof parsed.secteur_activite === 'string' ? parsed.secteur_activite : null,
      source,
      Number(conf.secteur_activite) || 0.55
    );
    profile.services_et_produits = sourced(
      asStringList(parsed.services_et_produits),
      source,
      Number(conf.services_et_produits) || 0.7
    );
    profile.proposition_de_valeur = sourced(
      typeof parsed.proposition_de_valeur === 'string' ? parsed.proposition_de_valeur : null,
      source,
      0.6
    );
    profile.zone_actuelle_d_activite = sourced(
      typeof parsed.zone_actuelle_d_activite === 'string' ? parsed.zone_actuelle_d_activite : null,
      source,
      0.5
    );
    profile.langues_utilisees = sourced(asStringList(parsed.langues_utilisees), source, 0.55);
    profile.ton_editorial_apparent = sourced(
      typeof parsed.ton_editorial_apparent === 'string' ? parsed.ton_editorial_apparent : null,
      source,
      0.45
    );
    profile.adresse_publique = sourced(
      typeof parsed.adresse_publique === 'string' ? parsed.adresse_publique : null,
      source,
      0.5
    );
    profile.canaux_presents = sourced(asStringList(parsed.canaux_presents), source, 0.5);
  } else {
    // Heuristique locale : titres / meta uniquement, pas d’invention de services
    profile.nom_legal = sourced(pageTitle, source, 0.4);
    progress.push('IA indisponible — seuls titre / contacts publics retenus.');
  }

  profile.email_public = sourced(emails[0] || null, source, emails[0] ? 0.9 : 0);
  profile.telephone_public = sourced(phones[0] || null, source, phones[0] ? 0.85 : 0);
  if (emails.length || phones.length) {
    const canaux = [
      ...(profile.canaux_presents.value || []),
      ...(emails.length ? ['email'] : []),
      ...(phones.length ? ['telephone'] : []),
    ];
    profile.canaux_presents = sourced([...new Set(canaux)], source, 0.8);
  }

  progress.push('Extraction terminée.');
  return { profile, progress };
}

/** Vérifie qu’aucun service n’a été inventé sans source. */
export function assertNoUnsoursedServices(profile: ExtractedTenantProfile): {
  ok: boolean;
  reason?: string;
} {
  const services = profile.services_et_produits;
  if (!services.empty && services.value?.length && (!services.source || services.confidence < 0.2)) {
    return { ok: false, reason: 'services_without_source' };
  }
  return { ok: true };
}
