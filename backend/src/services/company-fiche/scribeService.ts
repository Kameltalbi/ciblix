/**
 * Scribe — supprimer la saisie CRM.
 * Entrée : note libre / WhatsApp / email / vocal (déjà transcript).
 * Sortie : champs exclusifs Scribe uniquement.
 */

import { prisma } from '../../db/prisma.js';
import { persistAgentWrite, ficheEtatFromDb, parseFicheData } from './ficheService.js';
import { checkScribeExit } from './exitConditions.js';
import type { FicheAgent, FicheEntrepriseData, FicheEtat, InteractionEntry } from './types.js';
import { enqueueAgentTask } from '../agent-team/agentTaskService.js';
import { reactToFicheStateChange } from '../agent-team/stateReaction.js';

export type ScribeIngestInput = {
  organizationId: string;
  contactId: string;
  userId: string;
  canal: InteractionEntry['canal'];
  texteBrut: string;
};

export type ScribeStructured = {
  resume: string;
  statut_deal: string | null;
  prochaine_action: string | null;
  date_relance: string | null;
  objections_detectees: string[];
  montant_potentiel: number | null;
  uncertain: boolean;
  options_prochaine_action?: [string, string] | null;
};

async function structureWithLlm(texte: string, canal: string): Promise<ScribeStructured | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const system = `Tu es le Scribe Ciblix. Tu structures une note commerciale en JSON.
RÈGLES :
- Ne jamais inventer engagement, montant, date ou objection non exprimés.
- Si doute : uncertain=true et laisse null plutôt que d’affirmer.
- prochaine_action = verbe + objet (ex: "Envoyer devis PDF").
- date_relance = ISO date si explicite, sinon null.
- montant_potentiel = nombre uniquement si cité explicitement.
JSON strict :
{"resume":"...","statut_deal":"...|null","prochaine_action":"...|null","date_relance":"...|null","objections_detectees":[],"montant_potentiel":null,"uncertain":false,"options_prochaine_action":null}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Canal: ${canal}\n\nNote:\n${texte.slice(0, 4000)}` },
      ],
      max_tokens: 500,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ScribeStructured;
  } catch {
    return null;
  }
}

function structureLocal(texte: string): ScribeStructured {
  const t = texte.trim();
  const money = t.match(/(\d+[\d\s.,]*)\s*(DT|TND|€|EUR|dinars?)/i);
  const montant = money ? Number(money[1].replace(/\s/g, '').replace(',', '.')) : null;
  const uncertain =
    t.length < 20 || !/\b(relanc|devis|rdv|appel|envoyer|gagne|perdu|refus)/i.test(t);

  return {
    resume: t.slice(0, 280),
    statut_deal: uncertain
      ? null
      : /gagne|sign[ée]/i.test(t)
        ? 'gagnee'
        : /refus|perdu/i.test(t)
          ? 'perdue'
          : 'en_discussion',
    prochaine_action: uncertain
      ? null
      : /devis/i.test(t)
        ? 'Envoyer devis'
        : /relanc/i.test(t)
          ? 'Relancer le contact'
          : 'Faire un suivi',
    date_relance: null,
    objections_detectees: /prix|cher|budget/i.test(t) ? ['Objection prix'] : [],
    montant_potentiel: Number.isFinite(montant) ? montant : null,
    uncertain,
    options_prochaine_action: uncertain
      ? (['Relancer sous 48h', 'Envoyer une proposition'] as [string, string])
      : null,
  };
}

export async function ingestScribeInteraction(input: ScribeIngestInput) {
  const contact = await prisma.contact.findFirst({
    where: {
      id: input.contactId,
      organizationId: input.organizationId,
      erasedAt: null,
    },
  });
  if (!contact) throw new Error('Contact introuvable');

  let etat = ficheEtatFromDb(contact.ficheEtat);
  if (!etat || etat === 'decouverte' || etat === 'qualifiee') {
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        ficheEtat: 'CONTACTEE',
        ficheEtatAt: new Date(),
        ficheData: parseFicheData(contact.ficheData) as object,
      },
    });
    etat = 'contactee';
  }

  if (etat === 'archivee' || etat === 'gagnee' || etat === 'perdue') {
    throw new Error(`Fiche en état terminal « ${etat} » — Scribe non applicable`);
  }

  const structured =
    (await structureWithLlm(input.texteBrut, input.canal)) || structureLocal(input.texteBrut);

  const entry: InteractionEntry = {
    at: new Date().toISOString(),
    canal: input.canal,
    resume: structured.resume || input.texteBrut.slice(0, 200),
    uncertain: structured.uncertain,
  };

  const patch: Partial<FicheEntrepriseData> = {
    historique_interactions: [entry],
    statut_deal: structured.statut_deal,
    prochaine_action: structured.prochaine_action,
    date_relance: structured.date_relance,
    objections_detectees: structured.objections_detectees || [],
    montant_potentiel: structured.montant_potentiel,
  };

  const exit = checkScribeExit({
    statut_deal: patch.statut_deal,
    prochaine_action: patch.prochaine_action,
  });

  const onStateChange = async (args: {
    etatNouveau: FicheEtat;
    prochainAgent: FicheAgent | null;
  }) => {
    await reactToFicheStateChange({
      organizationId: input.organizationId,
      contactId: input.contactId,
      etatNouveau: args.etatNouveau,
      prochainAgent: args.prochainAgent,
    });
  };

  if (!exit.ok || !exit.etatCible) {
    const applied = await persistAgentWrite({
      organizationId: input.organizationId,
      contactId: input.contactId,
      agent: 'scribe',
      patch: {
        ...patch,
        block_reason: exit.raison,
        prochaine_action: structured.options_prochaine_action
          ? `Choisir : ${structured.options_prochaine_action.join(' OU ')}`
          : patch.prochaine_action || 'À clarifier',
        statut_deal: patch.statut_deal || 'a_clarifier',
      },
      etatCible: 'bloquee_humain',
      raison: exit.raison,
      conditionSortieRemplie: false,
      onStateChange,
    });
    return {
      ...applied,
      needsHumanChoice: true,
      options: structured.options_prochaine_action || null,
      structured,
    };
  }

  const applied = await persistAgentWrite({
    organizationId: input.organizationId,
    contactId: input.contactId,
    agent: 'scribe',
    patch,
    etatCible: exit.etatCible,
    raison: exit.raison,
    conditionSortieRemplie: true,
    onStateChange,
  });

  return {
    ...applied,
    needsHumanChoice: false,
    options: null as [string, string] | null,
    structured,
  };
}

export async function enqueueScribeIngest(opts: {
  organizationId: string;
  contactId: string;
  canal: InteractionEntry['canal'];
  texteBrut: string;
  priority?: number;
}) {
  return enqueueAgentTask({
    organizationId: opts.organizationId,
    assignee: 'SCRIBE',
    kind: 'PROCESS_INTERACTION',
    priority: opts.priority ?? 80,
    contactId: opts.contactId,
    dedupeKey: `scribe:${opts.contactId}:${Date.now()}`,
    payload: {
      canal: opts.canal,
      texteBrut: opts.texteBrut,
    },
  });
}
