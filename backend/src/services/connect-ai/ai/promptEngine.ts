import type { ConnectMessageStrategy } from '../core/types.js';
import { prisma } from '../../../db/prisma.js';

export interface ResolvedPrompt {
  systemPrompt: string;
  userPrompt: string;
  promptVersionId?: string;
  templateSlug: string;
}

const DEFAULT_PROMPTS: Record<
  ConnectMessageStrategy,
  { system: string; user: string }
> = {
  CONNECTION: {
    system:
      'Tu es un assistant commercial Ciblix. Rédige une demande de connexion LinkedIn courte, personnalisée, sans jargon. Jamais de ton agressif. Ne jamais mentionner que tu es une IA.',
    user: `Profil: {{fullName}} — {{jobTitle}} chez {{company}} ({{country}}).
Secteur: {{sector}}. Résumé: {{summary}}. Angle: {{angle}}.
Produit à mettre en avant: {{product}}.
Rédige une note de connexion (max 280 caractères).`,
  },
  FIRST_MESSAGE: {
    system:
      'Tu rédiges un premier message de prospection LinkedIn pour Ciblix. Ton professionnel, humain, une seule question ouverte. Pas de pitch long.',
    user: `Destinataire: {{fullName}}, {{jobTitle}} @ {{company}}.
Contexte: {{summary}}. Opportunités: {{opportunities}}. Produit: {{product}}.
Historique: {{history}}. Signature: {{signature}}.`,
  },
  FOLLOW_UP: {
    system: 'Tu rédiges une relance courte et respectueuse après un premier contact sans réponse.',
    user: `Relance pour {{fullName}} @ {{company}}. Contexte: {{context}}. Produit: {{product}}.`,
  },
  POST_MEETING: {
    system: 'Tu rédiges un message de suivi après une réunion.',
    user: `Suite à réunion avec {{fullName}} @ {{company}}. Points: {{context}}. Prochaine étape suggérée.`,
  },
  INTRODUCTION: {
    system: 'Tu rédiges une présentation concise de Ciblix adaptée au profil.',
    user: `Présentation pour {{fullName}} — {{sector}} — {{product}}.`,
  },
  DEMO_INVITE: {
    system: 'Tu invites à une démo produit, ton léger et concret.',
    user: `Invitation démo {{product}} pour {{fullName}} @ {{company}}. Angle: {{angle}}.`,
  },
  MEETING_REQUEST: {
    system: 'Tu proposes un créneau d\'échange court (15 min).',
    user: `Demande RDV avec {{fullName}} @ {{company}}. Contexte: {{summary}}.`,
  },
  CUSTOM: {
    system: 'Tu rédiges un message commercial sur mesure selon les instructions.',
    user: `{{customPrompt}}\n\nProfil: {{fullName}} @ {{company}}.`,
  },
};

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

export async function resolvePrompt(
  strategy: ConnectMessageStrategy,
  organizationId: string,
  vars: Record<string, string>
): Promise<ResolvedPrompt> {
  const template = await prisma.connectPromptTemplate.findFirst({
    where: {
      strategy,
      active: true,
      OR: [{ organizationId }, { organizationId: null }],
    },
    orderBy: [{ organizationId: 'desc' }, { updatedAt: 'desc' }],
    include: {
      versions: { orderBy: { version: 'desc' }, take: 1 },
    },
  });

  if (template?.versions[0]) {
    const v = template.versions[0];
    return {
      systemPrompt: interpolate(v.systemPrompt, vars),
      userPrompt: interpolate(v.userPrompt, vars),
      promptVersionId: v.id,
      templateSlug: template.slug,
    };
  }

  const fallback = DEFAULT_PROMPTS[strategy];
  return {
    systemPrompt: interpolate(fallback.system, vars),
    userPrompt: interpolate(fallback.user, vars),
    templateSlug: `default-${strategy.toLowerCase()}`,
  };
}
