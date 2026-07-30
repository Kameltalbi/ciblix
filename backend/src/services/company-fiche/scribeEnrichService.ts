/**
 * Scribe continu — revisite les sources publiques d’un dossier,
 * enrichit sans jamais effacer, historise même si rien n’a changé.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { enrichWebsiteFromUrl } from '../prospecting/websiteEnrichment.js';
import { persistAgentWrite, persistVeilleurSignal, ficheEtatFromDb, parseFicheData } from './ficheService.js';
import type { FicheEntrepriseData, FicheEtat, InteractionEntry, SignalExterne } from './types.js';

const INTERVAL_H = Math.max(1, Number(process.env.SCRIBE_ENRICH_INTERVAL_H) || 24);
const BATCH_PER_ORG = Math.max(1, Number(process.env.SCRIBE_ENRICH_BATCH_PER_ORG) || 3);
const MAX_ORGS = Math.max(1, Number(process.env.SCRIBE_ENRICH_MAX_ORGS_PER_TICK) || 10);

const ACTIVE_ETATS = ['DECOUVERTE', 'QUALIFIEE', 'CONTACTEE', 'EN_DISCUSSION', 'BLOQUEE_HUMAIN'] as const;

export type ScribeEnrichResult = {
  contactId: string;
  changed: boolean;
  champsEcrits: string[];
  signalsAdded: number;
  raison: string;
};

function dayBucket(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function isStrongerString(next: string | null | undefined, prev: string | null | undefined): boolean {
  const n = next?.trim() || '';
  if (!n) return false;
  const p = prev?.trim() || '';
  if (!p) return true;
  if (normalizeText(n) === normalizeText(p)) return false;
  // Ne jamais raccourcir / vider une info existante
  return n.length >= p.length * 0.6;
}

async function persistScribeNoop(opts: {
  organizationId: string;
  contactId: string;
  etat: FicheEtat | null;
  raison: string;
  payload?: Record<string, unknown>;
}) {
  await prisma.ficheTransition.create({
    data: {
      organizationId: opts.organizationId,
      contactId: opts.contactId,
      etatPrecedent: opts.etat,
      etatNouveau: opts.etat || 'decouverte',
      agentEmetteur: 'scribe',
      champsEcrits: [],
      conditionOk: true,
      raison: opts.raison,
      prochainAgent: null,
      payload: (opts.payload || { kind: 'noop' }) as Prisma.InputJsonValue,
    },
  });
}

type ProposedEnrich = {
  signals: Array<{ titre: string; source_url?: string | null }>;
  resume: string;
  prochaine_action?: string | null;
  besoin_hint?: string | null;
};

async function proposeEnrichWithLlm(input: {
  companyName: string;
  known: string;
  webSnippet: string;
}): Promise<ProposedEnrich | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const system = `Tu es le Scribe Ciblix (intelligence commerciale continue).
Tu compares des sources publiques avec le dossier existant.
RÈGLES :
- N'invente JAMAIS. Seulement des faits explicitement présents dans les sources.
- Si rien de nouveau : signals=[] et resume="Aucune modification détectée."
- signals : max 3 titres courts (nouveauté réelle : produit, recrutement, certification, partenaire, actualité).
- prochaine_action : seulement si un timing commercial est clair, sinon null.
JSON strict : {"signals":[{"titre":"...","source_url":null}],"resume":"...","prochaine_action":null}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `Entreprise: ${input.companyName}\n\nDossier connu:\n${input.known.slice(0, 2500)}\n\nSources (site):\n${input.webSnippet.slice(0, 3500)}`,
        },
      ],
      max_tokens: 500,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProposedEnrich;
  } catch {
    return null;
  }
}

function proposeEnrichLocal(input: {
  companyName: string;
  data: FicheEntrepriseData;
  web: { title?: string | null; description?: string | null; emails?: string[] };
}): ProposedEnrich {
  const signals: ProposedEnrich['signals'] = [];
  const knownTitles = new Set(
    (input.data.signaux_externes || []).map((s) => normalizeText(s.titre || ''))
  );
  const desc = input.web.description?.trim();
  if (desc && desc.length > 40) {
    const titre = desc.slice(0, 120);
    if (!knownTitles.has(normalizeText(titre))) {
      // Ne pousse un signal local que si le titre web apporte un motif clair
      if (/certif|iso|recrut|partenaire|lancement|nouveau|salon|formation/i.test(desc)) {
        signals.push({ titre: titre.charAt(0).toUpperCase() + titre.slice(1), source_url: null });
      }
    }
  }
  return {
    signals,
    resume:
      signals.length > 0
        ? `${signals.length} signal(aux) détecté(s) sur le site de ${input.companyName}.`
        : 'Analyse terminée. Aucune modification détectée.',
    prochaine_action: null,
  };
}

function buildKnownBlob(data: FicheEntrepriseData, companyName: string): string {
  const parts = [
    companyName,
    data.secteur_declare,
    data.zone_geographique,
    data.besoin_detecte,
    data.decideur?.nom,
    data.decideur?.fonction,
    data.prochaine_action,
    ...(data.signaux_externes || []).slice(-5).map((s) => s.titre),
  ];
  return parts.filter(Boolean).join('\n');
}

/**
 * Contacts dus pour une ré-analyse Scribe (intervalle écoulé ou jamais analysés).
 */
export async function pickContactsDueForScribeEnrich(opts: {
  organizationId: string;
  take?: number;
}): Promise<Array<{ id: string; companyName: string | null }>> {
  const take = opts.take ?? BATCH_PER_ORG;
  const cutoff = new Date(Date.now() - INTERVAL_H * 3600_000);

  const candidates = await prisma.contact.findMany({
    where: {
      organizationId: opts.organizationId,
      erasedAt: null,
      ficheEtat: { in: [...ACTIVE_ETATS] },
      OR: [{ companyName: { not: null } }, { name: { not: null } }],
    },
    orderBy: { ficheEtatAt: 'asc' },
    take: take * 4,
    select: { id: true, companyName: true, name: true },
  });

  if (!candidates.length) return [];

  const recentAny = await prisma.ficheTransition.groupBy({
    by: ['contactId'],
    where: {
      organizationId: opts.organizationId,
      contactId: { in: candidates.map((c) => c.id) },
      agentEmetteur: 'scribe',
      createdAt: { gte: cutoff },
    },
    _max: { createdAt: true },
  });
  const recentlyEnriched = new Set(recentAny.map((r) => r.contactId));

  return candidates
    .filter((c) => !recentlyEnriched.has(c.id))
    .slice(0, take)
    .map((c) => ({ id: c.id, companyName: c.companyName || c.name }));
}

/**
 * Enrichit un dossier : sources → diff → écriture non destructive → journal (toujours).
 */
export async function enrichScribeContact(opts: {
  organizationId: string;
  contactId: string;
  triggeredBy?: string;
}): Promise<ScribeEnrichResult> {
  const contact = await prisma.contact.findFirst({
    where: { id: opts.contactId, organizationId: opts.organizationId, erasedAt: null },
    include: {
      entrepriseReferentiel: {
        select: { siteWeb: true, nomLegal: true, secteur: true },
      },
    },
  });
  if (!contact) throw new Error('Contact introuvable');

  const etat = ficheEtatFromDb(contact.ficheEtat);
  if (!etat || ['gagnee', 'perdue', 'archivee'].includes(etat)) {
    await persistScribeNoop({
      organizationId: opts.organizationId,
      contactId: opts.contactId,
      etat,
      raison: 'Scribe continu — dossier terminal, analyse ignorée',
      payload: { skipped: true, reason: 'terminal' },
    });
    return {
      contactId: opts.contactId,
      changed: false,
      champsEcrits: [],
      signalsAdded: 0,
      raison: 'dossier terminal',
    };
  }

  const data = parseFicheData(contact.ficheData);
  const companyName =
    data.identite_entreprise?.nom_legal ||
    contact.entrepriseReferentiel?.nomLegal ||
    contact.companyName ||
    contact.name ||
    'Entreprise';

  const siteWeb = contact.entrepriseReferentiel?.siteWeb || null;
  let webSnippet = '';
  let webMeta: { title?: string | null; description?: string | null; emails?: string[] } = {};
  if (siteWeb) {
    try {
      const web = await enrichWebsiteFromUrl(siteWeb);
      webMeta = {
        title: web.websiteTitle,
        description: web.websiteDescription,
        emails: web.detectedEmails,
      };
      webSnippet = [
        web.websiteTitle,
        web.websiteDescription,
        (web.detectedEmails || []).join(', '),
        (web.productsServices || []).join(', '),
        (web.technologiesDetected || []).slice(0, 8).join(', '),
      ]
        .filter(Boolean)
        .join('\n');
    } catch {
      webSnippet = '';
    }
  }

  // Signaux déjà en file (AgentEvent récents) — contexte texte
  const events = await prisma.agentEvent.findMany({
    where: { organizationId: opts.organizationId, contactId: opts.contactId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { resume: true, createdAt: true },
  });
  const eventBlob = events
    .map((e) => e.resume)
    .filter(Boolean)
    .join('\n');

  const known = buildKnownBlob(data, companyName);
  const proposed =
    (await proposeEnrichWithLlm({
      companyName,
      known: `${known}\n${eventBlob}`,
      webSnippet: webSnippet || '(pas de site web accessible)',
    })) || proposeEnrichLocal({ companyName, data, web: webMeta });

  const knownSignalTitles = new Set(
    (data.signaux_externes || []).map((s) => normalizeText(s.titre || ''))
  );
  const newSignals = (proposed.signals || [])
    .map((s) => ({
      titre: (s.titre || '').trim().slice(0, 200),
      source_url: s.source_url || siteWeb,
    }))
    .filter((s) => s.titre && !knownSignalTitles.has(normalizeText(s.titre)))
    .slice(0, 3);

  let signalsAdded = 0;
  for (const s of newSignals) {
    const signal: SignalExterne = {
      at: new Date().toISOString(),
      titre: s.titre,
      source_url: s.source_url,
      source_ref: `scribe-enrich:${opts.contactId}:${Date.now()}`,
      destination: 'scribe',
    };
    await persistVeilleurSignal({
      organizationId: opts.organizationId,
      contactId: opts.contactId,
      signal,
    });
    signalsAdded += 1;
  }

  const patch: Partial<FicheEntrepriseData> = {};
  const champs: string[] = [];

  const histoEntry: InteractionEntry = {
    at: new Date().toISOString(),
    canal: 'note',
    resume: (proposed.resume || 'Ré-analyse Scribe automatique.').slice(0, 400),
  };
  // Toujours historiser la passe Scribe dans le dossier (append-only)
  patch.historique_interactions = [histoEntry];
  champs.push('historique_interactions');

  if (isStrongerString(proposed.prochaine_action, data.prochaine_action)) {
    patch.prochaine_action = proposed.prochaine_action!.trim();
    champs.push('prochaine_action');
  }

  const changedBeyondHisto = signalsAdded > 0 || champs.includes('prochaine_action');
  const onlyNoopNarrative = /aucune modification/i.test(proposed.resume || '');

  if (!changedBeyondHisto && onlyNoopNarrative) {
    // Historise quand même la passe + transition « aucune modification »
    await persistAgentWrite({
      organizationId: opts.organizationId,
      contactId: opts.contactId,
      agent: 'scribe',
      patch: { historique_interactions: [histoEntry] },
      etatCible: etat,
      raison: 'Analyse terminée. Aucune modification détectée.',
      conditionSortieRemplie: true,
    });
    return {
      contactId: opts.contactId,
      changed: false,
      champsEcrits: ['historique_interactions'],
      signalsAdded: 0,
      raison: 'Analyse terminée. Aucune modification détectée.',
    };
  }

  const raisonParts = [
    'Scribe continu',
    signalsAdded ? `${signalsAdded} nouveau(x) signal(aux)` : null,
    champs.includes('prochaine_action') ? 'prochaine action affinée' : null,
  ].filter(Boolean);

  const applied = await persistAgentWrite({
    organizationId: opts.organizationId,
    contactId: opts.contactId,
    agent: 'scribe',
    patch,
    etatCible: etat,
    raison: raisonParts.join(' — ') || 'Scribe continu — dossier enrichi',
    conditionSortieRemplie: true,
  });

  return {
    contactId: opts.contactId,
    changed: changedBeyondHisto || signalsAdded > 0,
    champsEcrits: applied.champsEcrits,
    signalsAdded,
    raison: applied.transition.raison,
  };
}

/**
 * Enfile des tâches SCRIBE_ENRICH pour les orgs actives (appelé par l’orchestrateur).
 */
export async function scheduleScribeEnrichJobs(): Promise<number> {
  if (process.env.SCRIBE_ENRICH_DISABLED === '1') return 0;

  const profiles = await prisma.orgTargetingProfile.findMany({
    where: {
      orchestratorEnabled: true,
      missionStatus: 'ACTIVE',
      missionCompletedAt: { not: null },
      organization: { suspended: false },
    },
    take: MAX_ORGS,
    select: { organizationId: true },
  });

  const { enqueueAgentTask } = await import('../agent-team/agentTaskService.js');
  let enqueued = 0;
  const bucket = dayBucket();

  for (const p of profiles) {
    const due = await pickContactsDueForScribeEnrich({
      organizationId: p.organizationId,
      take: BATCH_PER_ORG,
    });
    for (const c of due) {
      const task = await enqueueAgentTask({
        organizationId: p.organizationId,
        assignee: 'SCRIBE',
        kind: 'SCRIBE_ENRICH',
        priority: 40,
        contactId: c.id,
        dedupeKey: `scribe-enrich:${c.id}:${bucket}`,
        payload: { triggeredBy: 'orchestrator', companyName: c.companyName },
      });
      if (task) enqueued += 1;
    }
  }
  return enqueued;
}

export { INTERVAL_H as SCRIBE_ENRICH_INTERVAL_H, BATCH_PER_ORG as SCRIBE_ENRICH_BATCH_PER_ORG };
