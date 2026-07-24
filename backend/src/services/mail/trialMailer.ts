import type { BillingTier } from '@prisma/client';
import { TRIAL_AGENT_LABELS, TRIAL_AGENTS, TRIAL_DURATION_DAYS } from '../../config/trial.js';
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

function contentFor(input: SendTrialEmailInput): { subject: string; text: string; html: string } {
  const name = input.orgName?.trim() || 'votre organisation';
  const billingUrl = `${FRONTEND_URL}/settings?tab=organization&orgTab=billing`;
  const end =
    input.trialEndsAt?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) || '';
  const tierLabel = input.tier ? TIER_LABELS[input.tier] : '';
  const agents = agentListText();

  switch (input.kind) {
    case 'welcome':
      return {
        subject: `Bienvenue sur Ciblix — essai ${TRIAL_DURATION_DAYS} jours démarré`,
        text: `Bonjour,\n\nL'essai gratuit de ${name} est actif pendant ${TRIAL_DURATION_DAYS} jours. Aucune carte bancaire n'est requise.\n\nVous disposez de la solution complète : ${agents}.\nLes agents partagent la mémoire contacts — c'est l'effet réseau Ciblix.\n\nBon démarrage : ${FRONTEND_URL}/dashboard`,
        html: `<p>Bonjour,</p><p>L'essai gratuit de <strong>${name}</strong> est actif pendant <strong>${TRIAL_DURATION_DAYS} jours</strong>. Aucune carte bancaire n'est requise.</p><p>Vous disposez de la <strong>solution complète</strong> : <strong>${agents}</strong>.</p><p>Les agents partagent la mémoire contacts — c'est l'effet réseau Ciblix.</p><p><a href="${FRONTEND_URL}/dashboard">Ouvrir le tableau de bord</a></p>`,
      };
    case 'reminder':
      return {
        subject: `Votre essai Ciblix se termine dans 2 jours — palier ${tierLabel || 'souscrit'}`,
        text: `Bonjour,\n\nL'essai de ${name} se termine le ${end}.\nVous testez la solution complète : ${agents}.\nPassez au palier ${tierLabel || 'choisi'} pour continuer avec le quota adapté à votre usage.\nAjouter un moyen de paiement : ${billingUrl}`,
        html: `<p>Bonjour,</p><p>L'essai de <strong>${name}</strong> se termine le <strong>${end}</strong>.</p><p>Vous testez la <strong>solution complète</strong> : <strong>${agents}</strong>.</p><p>Passez au palier <strong>${tierLabel}</strong> pour continuer avec le quota adapté à votre usage.</p><p><a href="${billingUrl}">Ajouter un moyen de paiement</a></p>`,
      };
    case 'expired': {
      if (input.hasPaymentMethod) {
        return {
          subject: 'Votre essai Ciblix est terminé — abonnement actif',
          text: `Bonjour,\n\nL'essai de ${name} est terminé. Votre abonnement ${tierLabel || ''} est actif.\nLa solution complète reste disponible ; votre quota d'actions IA s'applique désormais.\n\nFacturation : ${billingUrl}`,
          html: `<p>Bonjour,</p><p>L'essai de <strong>${name}</strong> est terminé. Votre abonnement <strong>${tierLabel}</strong> est <strong>actif</strong>.</p><p>La solution complète reste disponible ; votre <strong>quota d'actions IA</strong> s'applique désormais.</p><p><a href="${billingUrl}">Voir la facturation</a></p>`,
        };
      }
      return {
        subject: 'Votre essai Ciblix est terminé',
        text: `Bonjour,\n\nL'essai de ${name} est terminé. Accès en lecture seule.\nAjoutez un paiement pour continuer avec la solution complète : ${billingUrl}`,
        html: `<p>Bonjour,</p><p>L'essai de <strong>${name}</strong> est terminé. Accès en <strong>lecture seule</strong>.</p><p><a href="${billingUrl}">Ajouter un moyen de paiement</a> pour continuer avec la solution complète.</p>`,
      };
    }
    case 'extended':
      return {
        subject: `Votre essai Ciblix a été prolongé de ${input.additionalDays || ''} jours`,
        text: `Bonjour,\n\nL'essai de ${name} a été prolongé. Nouvelle fin : ${end}.\nVous conservez la solution complète : ${agents}.\n\nTableau de bord : ${FRONTEND_URL}/dashboard`,
        html: `<p>Bonjour,</p><p>L'essai de <strong>${name}</strong> a été prolongé. Nouvelle fin : <strong>${end}</strong>.</p><p>Vous conservez la <strong>solution complète</strong> : <strong>${agents}</strong>.</p><p><a href="${FRONTEND_URL}/dashboard">Ouvrir le tableau de bord</a></p>`,
      };
    default:
      return { subject: 'Ciblix', text: '', html: '' };
  }
}

export async function sendTrialEmail(input: SendTrialEmailInput): Promise<void> {
  const smtp = getSmtpConfig();
  if (!smtp) {
    console.warn('[trialMailer] SMTP non configuré — email ignoré', input.kind, input.toEmail);
    return;
  }
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport(smtp);
    const { subject, text, html } = contentFor(input);
    await transporter.sendMail({ from: smtp.from, to: input.toEmail, subject, text, html });
  } catch (err) {
    console.warn('[trialMailer] envoi échoué', err);
  }
}
