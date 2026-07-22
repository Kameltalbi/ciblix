import type { BillingTier } from '@prisma/client';
import {
  DEFAULT_DISCOVERY_AGENT,
  TRIAL_AGENT_LABELS,
  TRIAL_AGENTS,
  TRIAL_DURATION_DAYS,
  isTrialAgentSlug,
  type TrialAgentSlug,
} from '../../config/trial.js';
import { TIER_LABELS } from '../../config/billingTiers.js';

type TrialEmailKind = 'welcome' | 'reminder' | 'expired' | 'extended';

type SendTrialEmailInput = {
  kind: TrialEmailKind;
  toEmail: string;
  orgName?: string | null;
  trialEndsAt?: Date;
  additionalDays?: number;
  tier?: BillingTier;
  selectedDiscoveryAgent?: string | null;
  hasPaymentMethod?: boolean;
  remainingAgents?: string[];
  usedDiscoveryFallback?: boolean;
};

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  if (!host || !user || !pass || !from) return null;
  return { host, port, secure: port === 465, auth: { user, pass }, from };
}

const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://ciblix.com').replace(/\/$/, '');

function agentListText(): string {
  return TRIAL_AGENTS.map((s) => TRIAL_AGENT_LABELS[s]).join(', ');
}

function remainingLabel(slugs: string[]): string {
  return slugs
    .map((s) => (isTrialAgentSlug(s) ? TRIAL_AGENT_LABELS[s] : s))
    .join(', ');
}

function contentFor(input: SendTrialEmailInput): { subject: string; text: string; html: string } {
  const name = input.orgName?.trim() || 'votre organisation';
  const billingUrl = `${FRONTEND_URL}/settings?tab=organization&orgTab=billing`;
  const chooseAgentUrl = `${FRONTEND_URL}/settings/billing/choose-agent`;
  const end =
    input.trialEndsAt?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) || '';
  const tierLabel = input.tier ? TIER_LABELS[input.tier] : '';
  const agents = agentListText();

  switch (input.kind) {
    case 'welcome':
      return {
        subject: `Bienvenue sur Ciblix — essai ${TRIAL_DURATION_DAYS} jours démarré`,
        text: `Bonjour,\n\nL'essai gratuit de ${name} est actif pendant ${TRIAL_DURATION_DAYS} jours. Aucune carte bancaire n'est requise.\n\nPendant l'essai, 3 agents collaborent pour vous : ${agents}.\nIls partagent la mémoire contacts — c'est l'effet réseau Ciblix.\n\nBon démarrage : ${FRONTEND_URL}/dashboard`,
        html: `<p>Bonjour,</p><p>L'essai gratuit de <strong>${name}</strong> est actif pendant <strong>${TRIAL_DURATION_DAYS} jours</strong>. Aucune carte bancaire n'est requise.</p><p>Pendant l'essai, <strong>3 agents collaborent</strong> pour vous : <strong>${agents}</strong>.</p><p>Ils partagent la mémoire contacts — c'est l'effet réseau Ciblix.</p><p><a href="${FRONTEND_URL}/dashboard">Ouvrir le tableau de bord</a></p>`,
      };
    case 'reminder': {
      if (input.tier === 'DECOUVERTE') {
        const hasChoice = isTrialAgentSlug(input.selectedDiscoveryAgent || '');
        return {
          subject: 'Votre essai Ciblix se termine dans 2 jours — choisissez votre agent',
          text: `Bonjour,\n\nL'essai de ${name} (palier Découverte) se termine le ${end}.\nVous testez : ${agents}.\nLe palier Découverte inclut 1 agent. ${hasChoice ? `Vous avez choisi : ${TRIAL_AGENT_LABELS[input.selectedDiscoveryAgent as TrialAgentSlug]}.` : `Choisissez lequel garder : ${chooseAgentUrl}`}\n\nFacturation : ${billingUrl}`,
          html: `<p>Bonjour,</p><p>L'essai de <strong>${name}</strong> (palier <strong>Découverte</strong>) se termine le <strong>${end}</strong>.</p><p>Vous testez : <strong>${agents}</strong>.</p><p>Le palier Découverte inclut <strong>1 agent</strong>. ${hasChoice ? `Choix actuel : <strong>${TRIAL_AGENT_LABELS[input.selectedDiscoveryAgent as TrialAgentSlug]}</strong>.` : `<a href="${chooseAgentUrl}">Choisissez lequel garder</a> avant la fin de l'essai.`}</p><p><a href="${billingUrl}">Paramètres facturation</a></p>`,
        };
      }
      return {
        subject: `Votre essai Ciblix se termine dans 2 jours — palier ${tierLabel || 'souscrit'}`,
        text: `Bonjour,\n\nL'essai de ${name} se termine le ${end}.\nVous testez actuellement : ${agents}.\nPassez au palier ${tierLabel || 'choisi'} pour garder vos agents actifs sans interruption.\nAjouter un moyen de paiement : ${billingUrl}`,
        html: `<p>Bonjour,</p><p>L'essai de <strong>${name}</strong> se termine le <strong>${end}</strong>.</p><p>Vous testez actuellement : <strong>${agents}</strong>.</p><p>Passez au palier <strong>${tierLabel}</strong> pour garder vos agents actifs sans interruption.</p><p><a href="${billingUrl}">Ajouter un moyen de paiement</a></p>`,
      };
    }
    case 'expired': {
      const remaining = input.remainingAgents?.length
        ? remainingLabel(input.remainingAgents)
        : 'aucun (lecture seule)';
      const fallbackNote = input.usedDiscoveryFallback
        ? ` Aucun choix n'ayant été fait, l'Assistant IA a été appliqué par défaut (modifiable dans les paramètres).`
        : '';
      const discoveryLossNote =
        input.tier === 'DECOUVERTE'
          ? ` Pendant l'essai vous aviez accès à ${agents}. Le palier Découverte ne conserve qu'un seul agent (${remaining}) — les deux autres sont désactivés. Vous pouvez changer d'agent ou passer à Croissance/Pro à tout moment.`
          : '';
      if (input.hasPaymentMethod) {
        return {
          subject: 'Votre essai Ciblix est terminé — abonnement actif',
          text: `Bonjour,\n\nL'essai de ${name} est terminé. Votre abonnement est actif.\nAgents restants : ${remaining}.${fallbackNote}${discoveryLossNote}\n\nFacturation : ${billingUrl}`,
          html: `<p>Bonjour,</p><p>L'essai de <strong>${name}</strong> est terminé. Votre abonnement est <strong>actif</strong>.</p><p>Agents restants : <strong>${remaining}</strong>.${fallbackNote}</p>${discoveryLossNote ? `<p>${discoveryLossNote}</p>` : ''}<p><a href="${billingUrl}">Voir la facturation</a></p>`,
        };
      }
      return {
        subject: 'Votre essai Ciblix est terminé',
        text: `Bonjour,\n\nL'essai de ${name} est terminé. Accès en lecture seule.${fallbackNote}${discoveryLossNote}\nAjoutez un paiement pour continuer : ${billingUrl}`,
        html: `<p>Bonjour,</p><p>L'essai de <strong>${name}</strong> est terminé. Accès en <strong>lecture seule</strong>.${fallbackNote}</p>${discoveryLossNote ? `<p>${discoveryLossNote}</p>` : ''}<p><a href="${billingUrl}">Ajouter un moyen de paiement</a></p>`,
      };
    }
    case 'extended':
      return {
        subject: `Votre essai Ciblix a été prolongé de ${input.additionalDays} jour(s)`,
        text: `Bonjour,\n\nL'essai de ${name} a été prolongé de ${input.additionalDays} jour(s). Nouvelle fin : ${end}.\nAgents d'essai toujours actifs : ${agents}.`,
        html: `<p>Bonjour,</p><p>L'essai de <strong>${name}</strong> a été prolongé de <strong>${input.additionalDays}</strong> jour(s).</p><p>Nouvelle fin : <strong>${end}</strong>.</p><p>Agents d'essai actifs : <strong>${agents}</strong>.</p>`,
      };
  }
}

export async function sendTrialEmail(input: SendTrialEmailInput): Promise<boolean> {
  if (!input.toEmail) return false;
  const config = getSmtpConfig();
  if (!config) {
    console.warn('[trialMailer] SMTP non configuré — email non envoyé:', input.kind, input.toEmail);
    return false;
  }

  const nodemailer = await import('nodemailer');
  const { subject, text, html } = contentFor(input);
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  await transporter.sendMail({ from: config.from, to: input.toEmail, subject, text, html });
  return true;
}

export { DEFAULT_DISCOVERY_AGENT };
