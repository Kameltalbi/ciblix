import type { FicheEntrepriseEtat, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { applyAgentWrite, applyVeilleurSignal } from './applyWrite.js';
import type {
  FicheAgent,
  FicheEntrepriseData,
  FicheEtat,
  SignalExterne,
} from './types.js';
import { nextAgentAfterTransition } from './stateMachine.js';

const ETAT_TO_DB: Record<FicheEtat, FicheEntrepriseEtat> = {
  decouverte: 'DECOUVERTE',
  qualifiee: 'QUALIFIEE',
  contactee: 'CONTACTEE',
  en_discussion: 'EN_DISCUSSION',
  gagnee: 'GAGNEE',
  perdue: 'PERDUE',
  archivee: 'ARCHIVEE',
  bloquee_humain: 'BLOQUEE_HUMAIN',
};

const DB_TO_ETAT: Record<FicheEntrepriseEtat, FicheEtat> = {
  DECOUVERTE: 'decouverte',
  QUALIFIEE: 'qualifiee',
  CONTACTEE: 'contactee',
  EN_DISCUSSION: 'en_discussion',
  GAGNEE: 'gagnee',
  PERDUE: 'perdue',
  ARCHIVEE: 'archivee',
  BLOQUEE_HUMAIN: 'bloquee_humain',
};

export function ficheEtatFromDb(e: FicheEntrepriseEtat | null | undefined): FicheEtat | null {
  return e ? DB_TO_ETAT[e] : null;
}

export function ficheEtatToDb(e: FicheEtat): FicheEntrepriseEtat {
  return ETAT_TO_DB[e];
}

export function parseFicheData(raw: unknown): FicheEntrepriseData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as FicheEntrepriseData;
}

/**
 * Persiste une écriture agent sous contrat + journalise la transition.
 * Déclenche ensuite l’enqueue de l’agent suivant (réaction d’état — pas d’appel agent→agent).
 */
export async function persistAgentWrite(opts: {
  organizationId: string;
  contactId: string;
  agent: Exclude<FicheAgent, 'humain' | 'veilleur'>;
  patch: Partial<FicheEntrepriseData>;
  etatCible: FicheEtat;
  raison: string;
  conditionSortieRemplie: boolean;
  onStateChange?: (args: {
    etatNouveau: FicheEtat;
    prochainAgent: FicheAgent | null;
  }) => Promise<void>;
}) {
  const contact = await prisma.contact.findFirst({
    where: { id: opts.contactId, organizationId: opts.organizationId, erasedAt: null },
  });
  if (!contact) throw new Error('Contact introuvable');

  const etatActuel = ficheEtatFromDb(contact.ficheEtat);
  const dataActuelle = parseFicheData(contact.ficheData);

  const applied = applyAgentWrite({
    tenantId: opts.organizationId,
    ficheId: opts.contactId,
    agent: opts.agent,
    etatActuel,
    dataActuelle,
    patch: opts.patch,
    etatCible: opts.etatCible,
    raison: opts.raison,
    conditionSortieRemplie: opts.conditionSortieRemplie,
  });

  await prisma.$transaction([
    prisma.contact.update({
      where: { id: opts.contactId },
      data: {
        ficheEtat: ficheEtatToDb(applied.etat),
        ficheEtatAt: new Date(),
        ficheData: applied.data as Prisma.InputJsonValue,
        ficheBlockReason:
          applied.etat === 'bloquee_humain'
            ? applied.data.block_reason || opts.raison
            : applied.etat === 'archivee'
              ? applied.data.archive_reason || opts.raison
              : null,
        companyName:
          applied.data.identite_entreprise?.nom_legal?.trim() || contact.companyName,
      },
    }),
    prisma.ficheTransition.create({
      data: {
        organizationId: opts.organizationId,
        contactId: opts.contactId,
        etatPrecedent: applied.transition.etat_precedent,
        etatNouveau: applied.transition.etat_nouveau,
        agentEmetteur: applied.transition.agent_emetteur,
        champsEcrits: applied.transition.champs_ecrits,
        conditionOk: applied.transition.condition_sortie_remplie,
        raison: applied.transition.raison,
        prochainAgent: applied.transition.prochain_agent,
        payload: applied.transition as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);

  const prochain = nextAgentAfterTransition(applied.etat);
  if (opts.onStateChange && etatActuel !== applied.etat) {
    await opts.onStateChange({ etatNouveau: applied.etat, prochainAgent: prochain });
  }

  return applied;
}

export async function persistVeilleurSignal(opts: {
  organizationId: string;
  contactId: string;
  signal: SignalExterne;
}) {
  const contact = await prisma.contact.findFirst({
    where: { id: opts.contactId, organizationId: opts.organizationId, erasedAt: null },
  });
  if (!contact) throw new Error('Contact introuvable');
  const next = applyVeilleurSignal(parseFicheData(contact.ficheData), opts.signal);
  await prisma.contact.update({
    where: { id: opts.contactId },
    data: { ficheData: next as Prisma.InputJsonValue },
  });
  await prisma.ficheTransition.create({
    data: {
      organizationId: opts.organizationId,
      contactId: opts.contactId,
      etatPrecedent: ficheEtatFromDb(contact.ficheEtat),
      etatNouveau: ficheEtatFromDb(contact.ficheEtat) || 'decouverte',
      agentEmetteur: 'veilleur',
      champsEcrits: ['signaux_externes'],
      conditionOk: true,
      raison: `Signal : ${opts.signal.titre}`,
      prochainAgent: opts.signal.destination || null,
      payload: opts.signal as unknown as Prisma.InputJsonValue,
    },
  });
  return next;
}

export async function listBloqueesHumain(organizationId: string, take = 50) {
  return prisma.contact.findMany({
    where: {
      organizationId,
      erasedAt: null,
      ficheEtat: 'BLOQUEE_HUMAIN',
    },
    orderBy: { ficheEtatAt: 'desc' },
    take,
    select: {
      id: true,
      companyName: true,
      name: true,
      ficheEtat: true,
      ficheBlockReason: true,
      ficheEtatAt: true,
      ficheData: true,
    },
  });
}

export async function listFicheJournal(organizationId: string, contactId: string, take = 40) {
  return prisma.ficheTransition.findMany({
    where: { organizationId, contactId },
    orderBy: { createdAt: 'desc' },
    take,
  });
}
