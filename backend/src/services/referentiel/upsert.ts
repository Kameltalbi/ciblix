import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import {
  assertNoForbiddenReferentielFields,
  onlyGenericEmail,
  onlyStandardPhone,
  type FieldProvenanceEntry,
  type ReferentielSource,
  type ReferentielUpsertInput,
} from './types.js';
import {
  extractDomain,
  nameSimilarity,
  normalizeCompanyName,
  SOURCE_TRUST,
} from './normalize.js';

export type UpsertReferentielResult = {
  id: string;
  created: boolean;
  merged: boolean;
  reviewQueued?: boolean;
};

function provenanceFrom(
  input: ReferentielUpsertInput,
  source: ReferentielSource
): Record<string, FieldProvenanceEntry> {
  const trust = SOURCE_TRUST[source.type_source] ?? 0.4;
  const out: Record<string, FieldProvenanceEntry> = {};
  const put = (champ: string, valeur: unknown) => {
    if (valeur == null || valeur === '') return;
    out[champ] = { valeur, source, confiance: trust };
  };
  put('nomLegal', input.nomLegal);
  put('identifiantNational', input.identifiantNational);
  put('secteur', input.secteur);
  put('adresseSiege', input.adresseSiege);
  put('zoneGeographique', input.zoneGeographique);
  put('siteWeb', input.siteWeb);
  put('telephoneStandard', onlyStandardPhone(input.telephoneStandard));
  put('emailGenerique', onlyGenericEmail(input.emailGenerique));
  put('tailleEstimee', input.tailleEstimee);
  put('anneeCreation', input.anneeCreation);
  return out;
}

/**
 * Upsert dans le référentiel avec dédup en cascade.
 * Ne jamais y pousser de données personnelles / intelligence tenant.
 */
export async function upsertEntrepriseReferentiel(
  raw: ReferentielUpsertInput
): Promise<UpsertReferentielResult> {
  assertNoForbiddenReferentielFields(raw as unknown as Record<string, unknown>);

  const nomLegal = raw.nomLegal.trim();
  if (!nomLegal) throw new Error('nomLegal_required');

  const nomNormalise = normalizeCompanyName(nomLegal);
  const siteWebDomain = extractDomain(raw.siteWeb);
  const emailGenerique = onlyGenericEmail(raw.emailGenerique);
  const telephoneStandard = onlyStandardPhone(raw.telephoneStandard);
  const source = raw.source;
  const prov = provenanceFrom(raw, source);

  // Niveau 1 — identifiant national
  if (raw.identifiantNational?.trim() && raw.paysImmatriculation?.trim()) {
    const hit = await prisma.entrepriseReferentiel.findFirst({
      where: {
        identifiantNational: raw.identifiantNational.trim(),
        paysImmatriculation: raw.paysImmatriculation.trim(),
      },
    });
    if (hit) {
      await mergeInto(hit.id, raw, siteWebDomain, emailGenerique, telephoneStandard, nomNormalise, prov, source);
      return { id: hit.id, created: false, merged: true };
    }
  }

  // Niveau 2 — domaine web
  if (siteWebDomain) {
    const hit = await prisma.entrepriseReferentiel.findFirst({
      where: { siteWebDomain },
    });
    if (hit) {
      await mergeInto(hit.id, raw, siteWebDomain, emailGenerique, telephoneStandard, nomNormalise, prov, source);
      return { id: hit.id, created: false, merged: true };
    }
  }

  // Niveau 3 — nom normalisé + ville/zone
  if (nomNormalise && raw.zoneGeographique?.trim()) {
    const hit = await prisma.entrepriseReferentiel.findFirst({
      where: {
        nomNormalise,
        zoneGeographique: { equals: raw.zoneGeographique.trim(), mode: 'insensitive' },
      },
    });
    if (hit) {
      await mergeInto(hit.id, raw, siteWebDomain, emailGenerique, telephoneStandard, nomNormalise, prov, source);
      return { id: hit.id, created: false, merged: true };
    }
  }

  // Niveau 4 — similarité floue → file de revue (ne pas fusionner auto)
  let fuzzyCandidate: { id: string; sim: number } | null = null;
  if (nomNormalise) {
    const candidates = await prisma.entrepriseReferentiel.findMany({
      where: {
        OR: [
          { nomNormalise: { startsWith: nomNormalise.slice(0, Math.min(8, nomNormalise.length)) } },
          ...(raw.secteur
            ? [{ secteur: { equals: raw.secteur, mode: 'insensitive' as const } }]
            : []),
        ],
      },
      take: 15,
      select: { id: true, nomLegal: true, zoneGeographique: true },
    });
    for (const c of candidates) {
      const sim = nameSimilarity(nomLegal, c.nomLegal);
      const sameZone =
        raw.zoneGeographique &&
        c.zoneGeographique &&
        normalizeCompanyName(raw.zoneGeographique) === normalizeCompanyName(c.zoneGeographique);
      if (sim >= 0.72 && (sameZone || sim >= 0.88)) {
        fuzzyCandidate = { id: c.id, sim };
        break;
      }
    }
  }

  const created = await prisma.entrepriseReferentiel.create({
    data: {
      identifiantNational: raw.identifiantNational?.trim() || null,
      paysImmatriculation: raw.paysImmatriculation?.trim() || null,
      nomLegal,
      nomsAlternatifs: raw.nomsAlternatifs || [],
      secteur: raw.secteur || null,
      codeActivite: raw.codeActivite || null,
      adresseSiege: raw.adresseSiege || null,
      zoneGeographique: raw.zoneGeographique || null,
      siteWeb: raw.siteWeb || null,
      siteWebDomain,
      presenceDigitale: (raw.presenceDigitale as Prisma.InputJsonValue) ?? undefined,
      telephoneStandard,
      emailGenerique,
      tailleEstimee: raw.tailleEstimee || null,
      anneeCreation: raw.anneeCreation ?? null,
      statutActivite: raw.statutActivite || 'INCONNUE',
      sources: [source] as unknown as Prisma.InputJsonValue,
      fieldProvenance: prov as unknown as Prisma.InputJsonValue,
      dateDerniereVerification: new Date(),
      scoreFraicheur: 80,
      scoreConfianceGlobal: Math.round((SOURCE_TRUST[source.type_source] || 0.4) * 100),
      nomNormalise,
    },
  });

  if (fuzzyCandidate) {
    await prisma.referentielDedupReview
      .create({
        data: {
          entrepriseAId: fuzzyCandidate.id,
          entrepriseBId: created.id,
          scoreSimilarite: fuzzyCandidate.sim,
          motif: `similarité ${fuzzyCandidate.sim.toFixed(2)} — revue manuelle (pas de fusion auto)`,
          statut: 'PENDING',
        },
      })
      .catch(() => null);
  }

  return { id: created.id, created: true, merged: false, reviewQueued: Boolean(fuzzyCandidate) };
}

async function mergeInto(
  id: string,
  raw: ReferentielUpsertInput,
  siteWebDomain: string | null,
  emailGenerique: string | null,
  telephoneStandard: string | null,
  nomNormalise: string,
  prov: Record<string, FieldProvenanceEntry>,
  source: ReferentielSource
) {
  const existing = await prisma.entrepriseReferentiel.findUniqueOrThrow({ where: { id } });
  const sources = Array.isArray(existing.sources) ? [...(existing.sources as object[])] : [];
  sources.push(source);
  const prevProv = (existing.fieldProvenance || {}) as Record<string, FieldProvenanceEntry>;
  const nextProv = { ...prevProv };
  for (const [k, v] of Object.entries(prov)) {
    const cur = nextProv[k];
    if (!cur || (v.confiance || 0) >= (cur.confiance || 0)) nextProv[k] = v;
  }

  const pick = <T>(newer: T | null | undefined, older: T | null | undefined): T | null | undefined =>
    newer != null && newer !== '' ? newer : older;

  await prisma.entrepriseReferentiel.update({
    where: { id },
    data: {
      nomLegal: existing.nomLegal,
      nomsAlternatifs: [
        ...new Set([
          ...existing.nomsAlternatifs,
          ...(raw.nomsAlternatifs || []),
          raw.nomLegal !== existing.nomLegal ? raw.nomLegal : '',
        ].filter(Boolean)),
      ].slice(0, 20),
      secteur: pick(raw.secteur, existing.secteur),
      adresseSiege: pick(raw.adresseSiege, existing.adresseSiege),
      zoneGeographique: pick(raw.zoneGeographique, existing.zoneGeographique),
      siteWeb: pick(raw.siteWeb, existing.siteWeb),
      siteWebDomain: pick(siteWebDomain, existing.siteWebDomain),
      telephoneStandard: pick(telephoneStandard, existing.telephoneStandard),
      emailGenerique: pick(emailGenerique, existing.emailGenerique),
      tailleEstimee: pick(raw.tailleEstimee, existing.tailleEstimee),
      anneeCreation: pick(raw.anneeCreation, existing.anneeCreation),
      identifiantNational: pick(raw.identifiantNational, existing.identifiantNational),
      paysImmatriculation: pick(raw.paysImmatriculation, existing.paysImmatriculation),
      nomNormalise: existing.nomNormalise || nomNormalise,
      sources: sources.slice(-40) as unknown as Prisma.InputJsonValue,
      fieldProvenance: nextProv as unknown as Prisma.InputJsonValue,
      dateDerniereVerification: new Date(),
      scoreFraicheur: Math.min(100, (existing.scoreFraicheur || 50) + 5),
    },
  });
}
