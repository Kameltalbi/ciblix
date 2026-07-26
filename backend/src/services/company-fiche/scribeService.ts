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

  const today = new Date().toISOString().slice(0, 10);
  const system = `Tu es le Scribe Ciblix. Tu structures une note commerciale en JSON.
RÈGLES ABSOLUES :
- N'extraire QUE ce qui est explicitement dit. Ne jamais inventer.
- Si doute : uncertain=true et null plutôt qu'affirmer.
- prochaine_action = verbe + objet concret (ex: "Envoyer devis PDF") ou null.
- date_relance = YYYY-MM-DD si une date/période est évoquée, sinon null.
  Aujourd'hui = ${today}. Convertir les dates vagues :
  "septembre" / "à la rentrée" → premier jour ouvrable de septembre (année en cours ou suivante).
  "dans 15 jours" → ${today} + 15 jours.
  Tenir compte du calendrier local TN (Ramadan, Aïd, congés août).
- montant_potentiel = nombre UNIQUEMENT si un chiffre est cité explicitement.
- objections_detectees : uniquement parmi budget | timing | concurrent | besoin | decideur_absent | autre
- statut_deal : interesse | pas_interesse | a_recontacter | sans_reponse | gagne | perdu | null
JSON strict :
{"resume":"2 phrases max, passé composé","statut_deal":null,"prochaine_action":null,"date_relance":null,"objections_detectees":[],"montant_potentiel":null,"uncertain":false,"options_prochaine_action":null}`;

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
      max_tokens: 600,
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

/** Heuristique locale si LLM indisponible — dates vagues TN + objections. */
function inferRelanceDate(texte: string): string | null {
  const t = texte.toLowerCase();
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based

  if (/septembre|a\s+la\s+rentr[ée]e|rentree/i.test(t)) {
    const target = new Date(y, 8, 1); // 1er sept
    if (m > 8 || (m === 8 && now.getDate() > 1)) target.setFullYear(y + 1);
    return target.toISOString().slice(0, 10);
  }
  const inDays = t.match(/dans\s+(\d+)\s+jours?/i);
  if (inDays) {
    const d = new Date(now);
    d.setDate(d.getDate() + Number(inDays[1]));
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function structureLocal(texte: string): ScribeStructured {
  const t = texte.trim();
  const money = t.match(/(\d+[\d\s.,]*)\s*(DT|TND|€|EUR|dinars?)/i);
  const montant = money ? Number(money[1].replace(/\s/g, '').replace(',', '.')) : null;
  const hasSignal = /\b(relanc|devis|rdv|appel|envoyer|gagn[ée]|perdu|refus|int[ée]ress|budget|septembre)/i.test(
    t
  );
  const uncertain = t.length < 20 || !hasSignal;

  const objections: string[] = [];
  if (/prix|cher|budget/i.test(t)) objections.push('budget');
  if (/pas\s+maintenant|plus\s+tard|septembre|timing|rentr/i.test(t)) objections.push('timing');
  if (/concurrent|ailleurs|autre\s+offre/i.test(t)) objections.push('concurrent');

  let statut: string | null = null;
  if (/gagn[ée]|sign[ée]/i.test(t)) statut = 'gagne';
  else if (/refus|perdu|pas\s+int[ée]ress/i.test(t)) statut = 'pas_interesse';
  else if (/rappeler|relanc|septembre|recontact/i.test(t)) statut = 'a_recontacter';
  else if (/int[ée]ress/i.test(t)) statut = 'interesse';
  else if (!uncertain) statut = 'en_discussion';

  let action: string | null = null;
  if (/devis/i.test(t)) action = 'Envoyer devis';
  else if (/septembre|rentr/i.test(t)) action = 'Relancer à la rentrée';
  else if (/relanc/i.test(t)) action = 'Relancer le contact';
  else if (!uncertain) action = 'Faire un suivi';

  return {
    resume: t.slice(0, 280),
    statut_deal: statut,
    prochaine_action: action,
    date_relance: inferRelanceDate(t),
    objections_detectees: objections,
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
