import type { AgentTask, ContactCreatedVia, OrgTargetingProfile, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { getIntegrationUserId } from '../integrations/orgIntegrationUser.js';
import { createAgentEvent } from '../agent-memory/agentEventService.js';
import { findOrCreateContact } from '../agent-memory/contactService.js';
import { enqueueAgentTask } from './agentTaskService.js';
import { isPastDatedContent, isPastScoutOpportunity } from '../scout/scoutFreshness.js';
import { resolveCompanyNameForContact } from '../scout/companyNameGuard.js';

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
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

/** Veilleur : scan signaux → tâches Prospecteur. */
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
      `Entreprise enrichie automatiquement à partir du signal « ${str(payload.signalTitle) || companyName} ».`,
    score: typeof payload.relevanceScore === 'number' ? Number(payload.relevanceScore) : null,
    sourceRef: scoutOppId ? `scout:${scoutOppId}` : undefined,
    analysisJson: {
      companyName,
      website,
      city,
      phone,
      email,
      signalUrl: website,
      enrichedBy: 'agent-team',
    },
  });

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
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          pipelineStatus: 'CHAUD',
          pipelineStatusScore: scoreResult.score,
          pipelineStatusAt: new Date(),
        },
      });
    } else if (scoreResult.decision === 'WATCH') {
      await prisma.contact.update({
        where: { id: contactId },
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

/** Assistant : prépare messages + notifie l’utilisateur. */
export async function handlePrepareOutreach(task: AgentTask): Promise<Record<string, unknown>> {
  const payload = asRecord(task.payload);
  const companyName = str(payload.companyName) || 'Entreprise';
  const contactId = str(payload.contactId) || task.contactId;
  const targeting = await prisma.orgTargetingProfile.findUnique({
    where: { organizationId: task.organizationId },
  });
  const userId = await getIntegrationUserId(task.organizationId);

  let emailDraft = `Bonjour,\n\nNous accompagnons des organisations comme ${companyName} sur ${
    targeting?.activity || 'leur développement commercial'
  }. Seriez-vous ouvert à un court échange ?\n\nCordialement`;
  let linkedinDraft = `Bonjour, j’ai repéré ${companyName} et croisé un signal pertinent pour ${
    targeting?.productsServices?.[0] || 'notre offre'
  }. Ouvert à échanger 15 min ?`;
  let angle = (payload.reasons as string[] | undefined)?.[0] || 'Adéquation ICP détectée';
  let nextActions = ['Valider le message', 'Envoyer via Gmail', 'Planifier un suivi'];

  if (process.env.OPENAI_API_KEY) {
    try {
      const system = `Tu es l'Assistant commercial Ciblix. JSON uniquement:
{"companySummary":"...","needsSummary":"...","arguments":["..."],"approachAngle":"...","email":"...","linkedin":"...","nextActions":["..."]}`;
      const user = [
        `Entreprise: ${companyName}`,
        `Score: ${payload.score}`,
        `Décision: ${payload.decision}`,
        targeting?.activity ? `Notre activité: ${targeting.activity}` : null,
        targeting?.productsServices?.length
          ? `Offres: ${targeting.productsServices.join(', ')}`
          : null,
        Array.isArray(payload.reasons) ? `Raisons: ${(payload.reasons as string[]).join('; ')}` : null,
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
        if (str(parsed.email)) emailDraft = str(parsed.email)!;
        if (str(parsed.linkedin)) linkedinDraft = str(parsed.linkedin)!;
        if (str(parsed.approachAngle)) angle = str(parsed.approachAngle)!;
        if (Array.isArray(parsed.nextActions)) nextActions = parsed.nextActions.map(String).slice(0, 5);
      }
    } catch (err) {
      console.warn('[agent-team] prepare openai', err);
    }
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
