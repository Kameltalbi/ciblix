import type { AgentTask, ContactCreatedVia, OrgTargetingProfile, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { getIntegrationUserId } from '../integrations/orgIntegrationUser.js';
import { createAgentEvent } from '../agent-memory/agentEventService.js';
import { findOrCreateContact } from '../agent-memory/contactService.js';
import { enqueueAgentTask } from './agentTaskService.js';
import { criteriaFromTargeting, criteriaHasSearchableFields } from './missionCriteria.js';
import { isPastDatedContent, isPastScoutOpportunity } from '../scout/scoutFreshness.js';
import { resolveCompanyNameForContact, looksLikeCompanyName } from '../scout/companyNameGuard.js';

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Corrige les \\n littéraux (souvent renvoyés par le modèle) → vrais sauts de ligne. */
function normalizeOutreachDraft(text: string): string {
  let t = text.trim();
  if (/\\[nrt]/.test(t)) {
    t = t
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t/g, '\t');
  }
  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

/** URL publique propre (https://…), sans slash final. */
function formatPublicWebsite(raw: string | null | undefined): string | null {
  const s = (raw || '').trim().replace(/\s+/g, '');
  if (!s) return null;
  let u = s.replace(/[.,;:]+$/, '');
  if (!/^https?:\/\//i.test(u)) u = `https://${u.replace(/^\/+/, '')}`;
  try {
    const url = new URL(u);
    if (!url.hostname) return null;
    return `${url.protocol}//${url.host}${url.pathname === '/' ? '' : url.pathname}`.replace(/\/$/, '');
  } catch {
    return s.startsWith('http') ? s : `https://${s}`;
  }
}

function normalizeCompany(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isExcluded(companyName: string, exclude: string[]): boolean {
  const n = normalizeCompany(companyName);
  return exclude.some((e) => {
    const x = normalizeCompany(e);
    return x && (n.includes(x) || x.includes(n));
  });
}

async function upsertCompanyContact(opts: {
  organizationId: string;
  companyName: string;
  phone: string | null;
  email: string | null;
  createdVia: ContactCreatedVia;
}) {
  if (opts.phone || opts.email) {
    try {
      return await findOrCreateContact({
        organizationId: opts.organizationId,
        name: opts.companyName,
        companyName: opts.companyName,
        phone: opts.phone,
        email: opts.email,
        createdVia: opts.createdVia,
        skipRescan: true,
      });
    } catch {
      /* fallback company match */
    }
  }

  const existing = await prisma.contact.findFirst({
    where: {
      organizationId: opts.organizationId,
      erasedAt: null,
      companyName: { equals: opts.companyName, mode: 'insensitive' },
    },
  });
  if (existing) return existing;

  return prisma.contact.create({
    data: {
      organizationId: opts.organizationId,
      name: opts.companyName,
      companyName: opts.companyName,
      phone: opts.phone,
      email: opts.email,
      createdVia: opts.createdVia,
    },
  });
}

/**
 * Prospecteur (cœur métier) : recherche d’entreprises clientes depuis la Mission / ICP,
 * puis file d’enrichissement + analyse.
 */
export async function handleFindCompanies(task: AgentTask): Promise<Record<string, unknown>> {
  const targeting = await prisma.orgTargetingProfile.findUnique({
    where: { organizationId: task.organizationId },
  });
  if (!targeting) {
    return { skipped: true, reason: 'no_targeting' };
  }

  const criteria = criteriaFromTargeting(targeting);
  if (!criteriaHasSearchableFields(criteria)) {
    return { skipped: true, reason: 'empty_criteria' };
  }

  const payload = asRecord(task.payload);
  const importMax =
    typeof payload.importMax === 'number' && payload.importMax > 0
      ? Math.min(60, Math.floor(payload.importMax))
      : 40;

  // Collecte externe STRICTEMENT org-scopée.
  // Isolation absolue : aucun écriture / seed via le référentiel mutualisé.
  let contactsCreated = 0;
  let imp = {
    count: 0,
    skippedExisting: 0,
    rawHits: 0,
    providerUsed: 'none' as string,
    fromCache: false,
  };
  let qualified = 0;

  {
    const { importProspectsFromSearch } = await import('../prospecting/importProspectsFromSearch.js');
    const { qualifyFoundBatchForOrganization } = await import(
      '../prospecting/qualifyFoundBatchOrg.js'
    );

    imp = await importProspectsFromSearch(task.organizationId, criteria, {
      refresh: payload.refresh === true,
      importMax,
    });

    if (imp.count > 0) {
      const q = await qualifyFoundBatchForOrganization(
        task.organizationId,
        Math.min(80, Math.max(10, importMax))
      );
      qualified = q.qualifiedCount;
    }

    // AiProspect → Contact pour CE tenant uniquement (jamais de catalogue partagé).
    const freshProspects = await prisma.aiProspect.findMany({
      where: { organizationId: task.organizationId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(40, importMax),
      select: {
        companyName: true,
        phone: true,
        email: true,
      },
    });
    for (const p of freshProspects) {
      if (!p.companyName?.trim()) continue;
      try {
        const before = await prisma.contact.findFirst({
          where: {
            organizationId: task.organizationId,
            erasedAt: null,
            companyName: { equals: p.companyName, mode: 'insensitive' },
          },
          select: { id: true },
        });
        await upsertCompanyContact({
          organizationId: task.organizationId,
          companyName: p.companyName.trim(),
          phone: p.phone?.trim() || null,
          email: p.email?.trim() || null,
          createdVia: 'HUNT',
        });
        if (!before) contactsCreated++;
      } catch {
        /* ignore */
      }
    }
  }

  const prospects = await prisma.aiProspect.findMany({
    where: {
      organizationId: task.organizationId,
      deletedAt: null,
      companyName: { not: '' },
    },
    orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }],
    take: 25,
    select: {
      id: true,
      companyName: true,
      website: true,
      phone: true,
      email: true,
      city: true,
      country: true,
      score: true,
      aiSummary: true,
    },
  });

  const exclude = targeting.excludeCompanies ?? [];
  let handedToEnrich = 0;
  for (const p of prospects) {
    if (!looksLikeCompanyName(p.companyName)) continue;
    if (isExcluded(p.companyName, exclude)) continue;

    await enqueueAgentTask({
      organizationId: task.organizationId,
      assignee: 'HUNT',
      kind: 'ENRICH_COMPANY',
      priority: 75,
      parentTaskId: task.id,
      dedupeKey: `enrich:hunt:${p.id}`,
      payload: {
        companyName: p.companyName,
        signalUrl: p.website,
        aiSummary: p.aiSummary,
        relevanceScore: p.score,
        prospectId: p.id,
        triggeredBy: 'find_companies',
      },
    });
    handedToEnrich += 1;
  }

  if (contactsCreated > 0) {
    const ficheContacts = await prisma.contact.findMany({
      where: {
        organizationId: task.organizationId,
        erasedAt: null,
        createdVia: 'HUNT',
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: { id: true, companyName: true },
    });
    for (const c of ficheContacts) {
      if (!c.companyName) continue;
      await enqueueAgentTask({
        organizationId: task.organizationId,
        assignee: 'ANALYSTE',
        kind: 'ANALYZE_FIT',
        priority: 70,
        contactId: c.id,
        dedupeKey: `analyze:hunt:${c.id}`,
        payload: {
          contactId: c.id,
          companyName: c.companyName,
          triggeredBy: 'find_companies',
        },
      });
    }
  }

  return {
    criteria,
    contactsCreated,
    fromReferentiel: 0,
    referentielHits: 0,
    usedExternalCollecte: true,
    coverageWithoutExternal: false,
    imported: imp.count,
    fromCache: imp.fromCache,
    providerUsed: imp.providerUsed,
    qualified,
    handedToEnrich,
  };
}

/** Veilleur (secondaire) : signaux AO/actu — ne remplace pas la recherche d’entreprises. */
export async function handleWatchSignals(task: AgentTask): Promise<Record<string, unknown>> {
  const { executeScoutScanAll } = await import('../../routes/scout-ai.js');
  const targeting = await prisma.orgTargetingProfile.findUnique({
    where: { organizationId: task.organizationId },
  });

  let profile = await prisma.scoutProfile.findUnique({
    where: { organizationId: task.organizationId },
  });

  if (!profile && targeting) {
    profile = await prisma.scoutProfile.create({
      data: {
        organizationId: task.organizationId,
        keywords: targeting.keywords,
        sectors: targeting.sectors,
        geoZones: [...targeting.countries, ...targeting.cities, ...targeting.markets],
        autoScanEnabled: true,
        scanIntervalH: Math.max(1, targeting.orchestratorIntervalH),
      },
    });
  }

  if (!profile) {
    return { skipped: true, reason: 'no_scout_profile' };
  }

  const userId = await getIntegrationUserId(task.organizationId);
  const result = await executeScoutScanAll(task.organizationId, { userId });
  const { handoffScoutSignalsToHunt } = await import('./scoutHandoff.js');
  const handedOff = await handoffScoutSignalsToHunt(task.organizationId, result.newOpportunities);

  return {
    newSignals: result.newOpportunities.length,
    handedOffToHunt: handedOff,
    categories: result.categories,
    totalRaw: result.totalRaw,
  };
}

/** Prospecteur : enrichit une entreprise / signal → tâche Analyste. */
export async function handleEnrichCompany(task: AgentTask): Promise<Record<string, unknown>> {
  const payload = asRecord(task.payload);
  const signalTitle = str(payload.signalTitle);
  let extractedName = str(payload.companyName);
  // Jamais le titre d’article / AO comme nom d’entreprise
  if (extractedName && signalTitle && extractedName.toLowerCase() === signalTitle.toLowerCase()) {
    extractedName = null;
  }

  const targeting = await prisma.orgTargetingProfile.findUnique({
    where: { organizationId: task.organizationId },
  });

  const userId = await getIntegrationUserId(task.organizationId);
  const scoutOppId = str(payload.scoutOpportunityId);
  let phone: string | null = null;
  let email: string | null = null;
  let website: string | null = str(payload.signalUrl);
  let city: string | null = targeting?.cities[0] ?? null;
  let summary = str(payload.aiSummary);
  let placesCompanyName: string | null = null;

  if (scoutOppId) {
    const opp = await prisma.scoutOpportunity.findFirst({
      where: { id: scoutOppId, organizationId: task.organizationId },
    });
    if (opp) {
      if (
        isPastScoutOpportunity({
          category: opp.category,
          title: opp.title,
          snippet: opp.snippet,
          aiSummary: opp.aiSummary,
          deadline: opp.deadline,
        })
      ) {
        if (opp.status === 'NEW') {
          await prisma.scoutOpportunity.update({
            where: { id: opp.id },
            data: { status: 'DISMISSED' },
          });
        }
        return { skipped: true, reason: 'past_event' };
      }
      const raw = asRecord(opp.rawData);
      email = str(raw.contactEmail) || email;
      phone = str(raw.contactPhone) || phone;
      summary = opp.aiSummary || summary;
      website = opp.url || website;
      if (!extractedName) extractedName = str(raw.companyName);
    }
  }

  const signalBlob = [signalTitle, summary, str(payload.aiSummary)].filter(Boolean).join('\n');
  if (isPastDatedContent(signalBlob)) {
    return { skipped: true, reason: 'past_event' };
  }

  const searchHint = extractedName || signalTitle;
  // Enrichissement Places si clé dispo
  if (
    searchHint &&
    (process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.PLACES_API_KEY)
  ) {
    try {
      const { resolveProspectingSearchProvider } = await import('../prospecting/getSearchProvider.js');
      const provider = resolveProspectingSearchProvider();
      const hits = await provider.searchCompanies({
        keywords: searchHint,
        sector: targeting?.sectors[0],
        city: targeting?.cities[0],
        country: targeting?.countries[0],
      });
      const hit = hits[0];
      if (hit) {
        placesCompanyName = hit.companyName || null;
        website = hit.website || website;
        city = hit.city || city;
        phone = (hit as { phone?: string | null }).phone || phone;
      }
    } catch (err) {
      console.warn('[agent-team] enrich places', err);
    }
  }

  const companyName = resolveCompanyNameForContact({
    extractedCompanyName: extractedName,
    placesCompanyName,
    signalTitle,
  });
  if (!companyName) {
    return { skipped: true, reason: 'not_a_company' };
  }

  if (targeting && isExcluded(companyName, targeting.excludeCompanies)) {
    return { skipped: true, reason: 'excluded' };
  }

  const contact = await upsertCompanyContact({
    organizationId: task.organizationId,
    companyName,
    phone,
    email,
    createdVia: scoutOppId ? 'SCOUT' : 'HUNT',
  });

  await createAgentEvent({
    organizationId: task.organizationId,
    userId,
    contactId: contact.id,
    source: 'HUNT',
    type: 'NOTE',
    resume:
      summary ||
      `Entreprise découverte : ${companyName}.`,
    score: typeof payload.relevanceScore === 'number' ? Number(payload.relevanceScore) : null,
    sourceRef: scoutOppId ? `scout:${scoutOppId}` : undefined,
    analysisJson: {
      companyName,
      website,
      city,
      phone,
      email,
      signalUrl: website,
      enrichedBy: 'prospecteur',
    },
  });

  // Contrat fiche : Prospecteur écrit UNIQUEMENT ses champs → état decouverte
  const { persistAgentWrite } = await import('../company-fiche/ficheService.js');
  const { checkProspecteurExit } = await import('../company-fiche/exitConditions.js');
  const { reactToFicheStateChange } = await import('./stateReaction.js');
  const { ficheEtatFromDb } = await import('../company-fiche/ficheService.js');

  if (!ficheEtatFromDb(contact.ficheEtat)) {
    const patch = {
      identite_entreprise: { nom_legal: companyName },
      source_decouverte: {
        source: scoutOppId ? 'veilleur' : 'prospecteur',
        url: website,
        at: new Date().toISOString(),
      },
      secteur_declare: targeting?.sectors?.[0] ?? null,
      zone_geographique: city || targeting?.cities?.[0] || null,
      taille_estimee: null as string | null,
      critere_de_match: [
        targeting?.sectors?.[0],
        targeting?.keywords?.[0],
        city,
      ]
        .filter(Boolean)
        .join(' · ') || 'match ICP',
    };
    const exit = checkProspecteurExit(patch);
    if (exit.ok && exit.etatCible) {
      await persistAgentWrite({
        organizationId: task.organizationId,
        contactId: contact.id,
        agent: 'prospecteur',
        patch,
        etatCible: 'decouverte',
        raison: exit.raison,
        conditionSortieRemplie: true,
        onStateChange: async ({ etatNouveau, prochainAgent }) => {
          await reactToFicheStateChange({
            organizationId: task.organizationId,
            contactId: contact.id,
            etatNouveau,
            prochainAgent,
          });
        },
      });
    }
  } else {
    // Déjà dans la chaîne — Analyste via réaction d’état / dédup tâche
    await enqueueAgentTask({
      organizationId: task.organizationId,
      assignee: 'ANALYSTE',
      kind: 'ANALYZE_FIT',
      parentTaskId: task.id,
      contactId: contact.id,
      priority: 60,
      dedupeKey: `analyze:contact:${contact.id}`,
      payload: {
        contactId: contact.id,
        companyName,
        website,
        city,
        phone,
        email,
        signalSummary: summary,
      },
    });
  }

  return {
    contactId: contact.id,
    companyName,
    website,
    phone,
    email,
  };
}

function heuristicScore(
  companyName: string,
  targeting: OrgTargetingProfile | null,
  signalSummary: string | null
): { score: number; decision: 'IGNORE' | 'WATCH' | 'PRIORITY'; reasons: string[] } {
  let score = 40;
  const reasons: string[] = [];
  const blob = `${companyName} ${signalSummary || ''}`.toLowerCase();

  for (const kw of targeting?.keywords ?? []) {
    if (kw && blob.includes(kw.toLowerCase())) {
      score += 8;
      reasons.push(`Mot-clé « ${kw} » détecté`);
    }
  }
  for (const s of targeting?.sectors ?? []) {
    if (s && blob.includes(s.toLowerCase())) {
      score += 10;
      reasons.push(`Secteur « ${s} » aligné`);
    }
  }
  for (const c of targeting?.cities ?? []) {
    if (c && blob.includes(c.toLowerCase())) {
      score += 6;
      reasons.push(`Ville cible « ${c} »`);
    }
  }
  for (const t of targeting?.targetClients ?? []) {
    if (t && blob.includes(t.toLowerCase())) {
      score += 12;
      reasons.push(`Client cible « ${t} »`);
    }
  }

  score = Math.min(98, Math.max(5, score));
  const decision = score >= 75 ? 'PRIORITY' : score >= 50 ? 'WATCH' : 'IGNORE';
  if (reasons.length === 0) reasons.push('Peu de signaux d’adéquation ICP — score de base');
  return { score, decision, reasons };
}

/** Analyste : score ICP → tâche Assistant si pertinent. */
export async function handleAnalyzeFit(task: AgentTask): Promise<Record<string, unknown>> {
  const payload = asRecord(task.payload);
  const companyName = str(payload.companyName) || 'Entreprise';
  const contactId = str(payload.contactId) || task.contactId;
  const targeting = await prisma.orgTargetingProfile.findUnique({
    where: { organizationId: task.organizationId },
  });

  let scoreResult = heuristicScore(companyName, targeting, str(payload.signalSummary));

  if (process.env.OPENAI_API_KEY) {
    try {
      const system = `Tu es l'Analyste Ciblix. Évalue l'adéquation ICP. JSON uniquement:
{"score":0-100,"decision":"IGNORE"|"WATCH"|"PRIORITY","reasons":["..."],"urgency":"low|medium|high","maturity":"low|medium|high"}`;
      const user = [
        `Entreprise: ${companyName}`,
        payload.website ? `Site: ${payload.website}` : null,
        targeting?.activity ? `Notre activité: ${targeting.activity}` : null,
        targeting?.productsServices?.length
          ? `Nos offres: ${targeting.productsServices.join(', ')}`
          : null,
        targeting?.targetClients?.length
          ? `Clients cibles: ${targeting.targetClients.join(', ')}`
          : null,
        targeting?.sectors?.length ? `Secteurs: ${targeting.sectors.join(', ')}` : null,
        targeting?.keywords?.length ? `Mots-clés: ${targeting.keywords.join(', ')}` : null,
        payload.signalSummary ? `Signal: ${payload.signalSummary}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          temperature: 0.2,
          max_tokens: 600,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const raw = data.choices?.[0]?.message?.content?.trim() || '';
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        const parsed = JSON.parse(cleaned) as {
          score?: number;
          decision?: 'IGNORE' | 'WATCH' | 'PRIORITY';
          reasons?: string[];
        };
        if (typeof parsed.score === 'number') {
          scoreResult = {
            score: Math.min(100, Math.max(0, Math.round(parsed.score))),
            decision:
              parsed.decision === 'IGNORE' || parsed.decision === 'WATCH' || parsed.decision === 'PRIORITY'
                ? parsed.decision
                : scoreResult.decision,
            reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String) : scoreResult.reasons,
          };
        }
      }
    } catch (err) {
      console.warn('[agent-team] analyze openai', err);
    }
  }

  const userId = await getIntegrationUserId(task.organizationId);
  if (contactId) {
    await createAgentEvent({
      organizationId: task.organizationId,
      userId,
      contactId,
      source: 'ANALYSTE',
      type: 'NOTE',
      resume: `Score ${scoreResult.score}/100 — ${scoreResult.decision}. ${scoreResult.reasons.slice(0, 2).join(' · ')}`,
      score: scoreResult.score,
      analysisJson: scoreResult as unknown as Prisma.InputJsonValue,
    });

    if (scoreResult.decision === 'PRIORITY') {
      await prisma.contact.updateMany({
        where: { id: contactId, organizationId: task.organizationId },
        data: {
          pipelineStatus: 'CHAUD',
          pipelineStatusScore: scoreResult.score,
          pipelineStatusAt: new Date(),
        },
      });
    } else if (scoreResult.decision === 'WATCH') {
      await prisma.contact.updateMany({
        where: { id: contactId, organizationId: task.organizationId },
        data: {
          pipelineStatus: 'TIEDE',
          pipelineStatusScore: scoreResult.score,
          pipelineStatusAt: new Date(),
        },
      });
    }
  }

  if (scoreResult.decision !== 'IGNORE') {
    await enqueueAgentTask({
      organizationId: task.organizationId,
      assignee: 'COPILOT',
      kind: 'PREPARE_OUTREACH',
      parentTaskId: task.id,
      contactId,
      priority: scoreResult.decision === 'PRIORITY' ? 90 : 55,
      dedupeKey: contactId ? `prepare:contact:${contactId}` : undefined,
      payload: {
        contactId,
        companyName,
        website: payload.website,
        score: scoreResult.score,
        decision: scoreResult.decision,
        reasons: scoreResult.reasons,
        signalSummary: payload.signalSummary,
      },
    });
  }

  return scoreResult;
}

/** Assistant / Rédacteur : prépare messages + notifie l’utilisateur. */
export async function handlePrepareOutreach(task: AgentTask): Promise<Record<string, unknown>> {
  const payload = asRecord(task.payload);
  const companyName = str(payload.companyName) || 'Entreprise';
  const contactId = str(payload.contactId) || task.contactId;
  const targeting = await prisma.orgTargetingProfile.findUnique({
    where: { organizationId: task.organizationId },
  });
  const userId = await getIntegrationUserId(task.organizationId);

  const { assertRedacteurMayGenerate, parseOfferSheet, validatedServiceLabels } = await import(
    '../tenant-onboarding/index.js'
  );
  const gate = assertRedacteurMayGenerate({
    offerSheet: parseOfferSheet(targeting?.offerSheet),
    productsServices: targeting?.productsServices,
  });
  if (!gate.ok) {
    return {
      skipped: true,
      reason: gate.code || 'OFFER_SHEET_REQUIRED',
      message: gate.message,
    };
  }

  const offerSheet = parseOfferSheet(targeting?.offerSheet);
  const offerLabels = validatedServiceLabels(offerSheet);
  const ourOffers = [...new Set([...(targeting?.productsServices || []), ...offerLabels].map((s) => s.trim()).filter(Boolean))];
  const valueProposition =
    offerSheet?.proposition_de_valeur?.trim() ||
    targeting?.companyBrief?.trim() ||
    targeting?.missionSummary?.trim() ||
    null;
  const commercialPriority = targeting?.commercialPriorities?.trim() || null;

  const ourWebsite = formatPublicWebsite(
    targeting?.identitySourceUrl?.trim() ||
      (targeting?.identitySourceType === 'website' ? targeting?.identitySourceLabel?.trim() : null) ||
      null
  );

  const [senderUser, orgRow] = await Promise.all([
    userId
      ? prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
      : Promise.resolve(null),
    prisma.organization.findUnique({
      where: { id: task.organizationId },
      select: { name: true },
    }),
  ]);
  const senderName = senderUser?.name?.trim() || null;
  const orgName = orgRow?.name?.trim() || null;
  const signatureBlock = [
    'Cordialement,',
    '',
    ...(senderName ? [senderName] : []),
    ...(orgName ? [orgName] : []),
    ...(ourWebsite ? [ourWebsite] : []),
  ].join('\n');

  let emailDraft = `Bonjour,\n\nNous accompagnons des organisations comme ${companyName} sur ${
    targeting?.activity || 'leur développement commercial'
  }. Seriez-vous ouvert à un court échange de 15 minutes ?\n\n${signatureBlock}`;
  let linkedinDraft = `Bonjour, j’ai repéré ${companyName} et croisé un signal pertinent pour ${
    ourOffers[0] || 'notre offre'
  }. Ouvert à échanger 15 min ?`;
  let angle = (payload.reasons as string[] | undefined)?.[0] || 'Adéquation ICP détectée';
  let nextActions = ['Valider le message', 'Envoyer via WhatsApp ou email', 'Planifier un suivi'];

  const isUsableDraft = (text: string | null | undefined): boolean => {
    const t = normalizeOutreachDraft(text || '');
    if (t.length < 60) return false;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return false; // juste une adresse email
    if (!/bonjour|hello|bonsoir|مرحبا/i.test(t) && t.split(/\s+/).length < 12) return false;
    return true;
  };

  // Contexte fiche pour un message plus pertinent
  let ficheContext = '';
  if (contactId) {
    const row = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: task.organizationId, erasedAt: null },
      select: { ficheData: true, name: true, email: true, phone: true },
    });
    const fd =
      row?.ficheData && typeof row.ficheData === 'object' && !Array.isArray(row.ficheData)
        ? (row.ficheData as Record<string, unknown>)
        : {};
    ficheContext = [
      row?.name ? `Interlocuteur: ${row.name}` : null,
      typeof fd.besoin_detecte === 'string' ? `Besoin détecté: ${fd.besoin_detecte}` : null,
      typeof fd.raison_du_score === 'string' ? `Raison score: ${fd.raison_du_score}` : null,
      fd.decideur && typeof fd.decideur === 'object'
        ? `Décideur: ${str((fd.decideur as Record<string, unknown>).nom) || ''} ${str((fd.decideur as Record<string, unknown>).fonction) || ''}`.trim()
        : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const system = `Tu es l'Assistant commercial Ciblix. JSON uniquement:
{"companySummary":"...","needsSummary":"...","arguments":["..."],"approachAngle":"...","email":"...","linkedin":"...","nextActions":["..."]}
RÈGLES :
- "email" = message commercial COMPLET (salutations + 2-4 courts paragraphes + signature). Minimum 80 caractères.
- Dans "email", utilise de VRAIS sauts de ligne JSON (\\n), jamais le texte littéral "\\n" affiché à l'écran.
- Signature EXACTEMENT dans cet ordre, sur des lignes séparées :
  Cordialement,
  <prénom/nom si fourni>
  <nom entreprise si fourni>
  <URL https://… si fournie>
- INTERDIT : « L'équipe … », signature générique, URL sans https://, www. seul sur une ligne ambiguë.
- INTERDIT de répondre avec seulement une adresse email, un nom, ou une signature seule.
- Citer UNIQUEMENT les produits/services de « Nos offres ». Ne pas inventer d'autres métiers.
- Si « Priorité commerciale » ou une offre mentionne une formation, session, date ou promo : l'email DOIT la présenter clairement (dates, lieu, bénéfice).
- Tutoyer ou vouvoyer selon le contexte B2B (vouvoiement par défaut).`;
      const user = [
        `Entreprise cible: ${companyName}`,
        `Score: ${payload.score}`,
        `Décision: ${payload.decision}`,
        targeting?.activity ? `Notre activité: ${targeting.activity}` : null,
        valueProposition ? `Notre proposition de valeur: ${valueProposition}` : null,
        ourOffers.length ? `Nos offres (à citer en priorité): ${ourOffers.join(' | ')}` : null,
        commercialPriority ? `Priorité commerciale actuelle (à mettre en avant): ${commercialPriority}` : null,
        senderName ? `Expéditeur (signature): ${senderName}` : null,
        orgName ? `Entreprise expéditrice (signature): ${orgName}` : null,
        ourWebsite ? `Site web à mettre en signature (URL exacte): ${ourWebsite}` : null,
        Array.isArray(payload.reasons) ? `Raisons: ${(payload.reasons as string[]).join('; ')}` : null,
        payload.signalSummary ? `Signal: ${payload.signalSummary}` : null,
        ficheContext || null,
      ]
        .filter(Boolean)
        .join('\n');

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          temperature: 0.4,
          max_tokens: 900,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const raw = data.choices?.[0]?.message?.content?.trim() || '';
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        const parsed = JSON.parse(cleaned) as Record<string, unknown>;
        const aiEmail = str(parsed.email) ? normalizeOutreachDraft(str(parsed.email)!) : null;
        const aiLinkedin = str(parsed.linkedin) ? normalizeOutreachDraft(str(parsed.linkedin)!) : null;
        if (isUsableDraft(aiEmail)) emailDraft = aiEmail!;
        if (isUsableDraft(aiLinkedin)) linkedinDraft = aiLinkedin!;
        if (str(parsed.approachAngle)) angle = str(parsed.approachAngle)!;
        if (Array.isArray(parsed.nextActions)) nextActions = parsed.nextActions.map(String).slice(0, 5);
      }
    } catch (err) {
      console.warn('[agent-team] prepare openai', err);
    }
  }

  emailDraft = normalizeOutreachDraft(emailDraft);
  linkedinDraft = normalizeOutreachDraft(linkedinDraft);

  // Sécurité finale : ne jamais persister un « message » invalide
  if (!isUsableDraft(emailDraft)) {
    emailDraft = `Bonjour,\n\nNous accompagnons des organisations comme ${companyName} sur ${
      targeting?.activity || 'leur développement commercial'
    }${
      ourOffers[0] ? ` — notamment : ${ourOffers[0]}` : ''
    }. Seriez-vous ouvert à un court échange de 15 minutes ?\n\n${signatureBlock}`;
  } else if (ourWebsite && !emailDraft.toLowerCase().includes(ourWebsite.replace(/^https?:\/\//i, '').toLowerCase())) {
    emailDraft = `${emailDraft.trimEnd()}\n${ourWebsite}`;
  }

  // Remplacer une signature « L'équipe … » trop générique si on a mieux
  if (/l['’]équipe\s+/i.test(emailDraft) && (senderName || orgName)) {
    emailDraft = emailDraft.replace(/\n*cordialement,?\s*\n+l['’]équipe[^\n]*/gi, `\n\n${signatureBlock}`);
  }

  const pack = {
    companySummary: `${companyName} — opportunité préparée par l’équipe IA`,
    needsSummary: str(payload.signalSummary) || 'Besoin commercial détecté via signal de veille',
    approachAngle: angle,
    email: emailDraft,
    linkedin: linkedinDraft,
    nextActions,
    score: typeof payload.score === 'number' ? payload.score : null,
    decision: typeof payload.decision === 'string' ? payload.decision : null,
  };

  if (contactId) {
    await createAgentEvent({
      organizationId: task.organizationId,
      userId,
      contactId,
      source: 'COPILOT',
      type: 'OPPORTUNITE',
      resume: `Opportunité prête — ${companyName} (score ${payload.score ?? 'n/a'})`,
      score: typeof payload.score === 'number' ? Number(payload.score) : null,
      actionsSuggerees: nextActions,
      analysisJson: pack as Prisma.InputJsonValue,
    });

    await prisma.suggestion.create({
      data: {
        organizationId: task.organizationId,
        contactId,
        type: 'ENVOYER_MESSAGE',
        message: emailDraft.slice(0, 4000),
        targetAgent: 'COPILOT',
        status: 'PENDING',
      },
    });

    // Persister le brouillon sur la fiche (sinon l’UI « Message recommandé » reste vide)
    try {
      const { persistAgentWrite, ficheEtatFromDb } = await import('../company-fiche/index.js');
      const contactRow = await prisma.contact.findFirst({
        where: { id: contactId, organizationId: task.organizationId, erasedAt: null },
        select: { ficheEtat: true },
      });
      const etat = ficheEtatFromDb(contactRow?.ficheEtat) || 'decouverte';
      await persistAgentWrite({
        organizationId: task.organizationId,
        contactId,
        agent: 'redacteur',
        patch: {
          message_brouillon: emailDraft,
          message_canal: 'email',
          message_langue: 'fr',
          validation_separation: { erreur_detectee: false, details: undefined },
          validation_qualite: { conforme: true, problemes: [] },
        },
        etatCible: etat,
        raison: 'Message recommandé généré pour envoi humain',
        conditionSortieRemplie: true,
      });
    } catch (ficheErr) {
      console.warn('[agent-team] prepare outreach fiche write', ficheErr);
    }
  }

  const owners = await prisma.user.findMany({
    where: { organizationId: task.organizationId, role: { in: ['OWNER', 'SUPERADMIN'] } },
    select: { id: true },
    take: 10,
  });
  if (owners.length) {
    await prisma.notification.createMany({
      data: owners.map((u) => ({
        organizationId: task.organizationId,
        userId: u.id,
        type: 'AGENT_OPPORTUNITY_READY' as const,
        title: `Opportunité prête : ${companyName}`,
        content: `Score ${payload.score ?? '—'} · ${angle}`,
        link: contactId ? `/contacts/${contactId}` : '/dashboard',
      })),
    });
  }

  return pack;
}
