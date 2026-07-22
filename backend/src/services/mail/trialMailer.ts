import nodemailer from 'nodemailer';

type TrialEmailKind = 'welcome' | 'reminder' | 'expired' | 'extended';

type SendTrialEmailInput = {
  kind: TrialEmailKind;
  toEmail: string;
  orgName?: string | null;
  trialEndsAt?: Date;
  additionalDays?: number;
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

function contentFor(input: SendTrialEmailInput): { subject: string; text: string; html: string } {
  const name = input.orgName?.trim() || 'votre organisation';
  const billingUrl = `${FRONTEND_URL}/settings?tab=billing`;
  const end =
    input.trialEndsAt?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) || '';

  switch (input.kind) {
    case 'welcome':
      return {
        subject: 'Bienvenue sur Ciblix — votre essai de 7 jours a démarré',
        text: `Bonjour,\n\nL'essai gratuit de ${name} est actif pendant 7 jours. Aucune carte bancaire n'est requise.\n\nBon démarrage sur Ciblix.`,
        html: `<p>Bonjour,</p><p>L'essai gratuit de <strong>${name}</strong> est actif pendant <strong>7 jours</strong>. Aucune carte bancaire n'est requise.</p><p>Bon démarrage sur Ciblix.</p>`,
      };
    case 'reminder':
      return {
        subject: 'Votre essai Ciblix se termine dans 2 jours',
        text: `Bonjour,\n\nL'essai de ${name} se termine le ${end}. Ajoutez un moyen de paiement pour continuer : ${billingUrl}`,
        html: `<p>Bonjour,</p><p>L'essai de <strong>${name}</strong> se termine le <strong>${end}</strong>.</p><p><a href="${billingUrl}">Ajouter un moyen de paiement</a> pour continuer.</p>`,
      };
    case 'expired':
      return {
        subject: 'Votre essai Ciblix est terminé',
        text: `Bonjour,\n\nL'essai de ${name} est terminé. Accès en lecture seule. Ajoutez un paiement : ${billingUrl}`,
        html: `<p>Bonjour,</p><p>L'essai de <strong>${name}</strong> est terminé. Accès en <strong>lecture seule</strong>.</p><p><a href="${billingUrl}">Ajouter un moyen de paiement</a> pour continuer.</p>`,
      };
    case 'extended':
      return {
        subject: `Votre essai Ciblix a été prolongé de ${input.additionalDays} jour(s)`,
        text: `Bonjour,\n\nL'essai de ${name} a été prolongé de ${input.additionalDays} jour(s). Nouvelle fin : ${end}.`,
        html: `<p>Bonjour,</p><p>L'essai de <strong>${name}</strong> a été prolongé de <strong>${input.additionalDays}</strong> jour(s).</p><p>Nouvelle fin : <strong>${end}</strong>.</p>`,
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
