import type { Organization } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { normalizePlan, syncAgentsForPlan } from '../config/agentPlans.js';

/**
 * Templates e-mail initiaux + abonnement d’essai : inchangés par rapport au flux `/auth/register`.
 */
export async function seedDefaultEmailTemplates(organizationId: string): Promise<void> {
  await prisma.emailTemplate.createMany({
    data: [
      {
        organizationId,
        name: 'Suivi de devis',
        subject: 'Votre devis de {montant} DT pour {titre}',
        body: `Bonjour {client},

Nous avons le plaisir de vous envoyer votre devis de {montant} DT concernant : {titre}.

Détails de l'affaire :
- Montant : {montant} DT
- Probabilité : {probabilite}
- Statut : {statut}
- Date : {date}

N'hésitez pas à nous contacter pour toute question.

Cordialement`,
        variables: JSON.stringify(['client', 'montant', 'titre', 'probabilite', 'statut', 'date']),
        isActive: true,
      },
      {
        organizationId,
        name: 'Relance client',
        subject: 'Relance : Votre affaire {titre}',
        body: `Bonjour {client},

Nous faisons suite à notre dernière échange concernant votre affaire : {titre}.

Statut actuel : {statut}
Montant : {montant} DT

Nous restons à votre disposition pour avancer sur ce dossier.

Cordialement`,
        variables: JSON.stringify(['client', 'titre', 'statut', 'montant']),
        isActive: true,
      },
      {
        organizationId,
        name: 'Confirmation de commande',
        subject: 'Confirmation de votre commande - {titre}',
        body: `Bonjour {client},

Nous avons bien reçu votre commande pour : {titre}.

Montant : {montant} DT
Date : {date}

Votre commande est maintenant en cours de traitement. Nous vous tiendrons informé de son évolution.

Merci pour votre confiance.

Cordialement`,
        variables: JSON.stringify(['client', 'titre', 'montant', 'date']),
        isActive: true,
      },
    ],
  });
}

export async function seedTrialSubscriptionForOrganization(organization: Organization): Promise<void> {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);

  const tier = normalizePlan(organization.plan);
  const trialPrice =
    tier === 'ENTERPRISE'
      ? 2100
      : tier === 'BUSINESS'
        ? 980
        : tier === 'BASIC'
          ? 480
          : 0;

  await prisma.subscription.create({
    data: {
      organizationId: organization.id,
      plan: tier,
      price: trialPrice,
      billingPeriod: 'YEARLY',
      paymentMethod: 'VIREMENT',
      paymentStatus: 'PENDING',
      startDate,
      endDate,
    },
  });
}

export async function bootstrapOrganizationAgents(organization: Organization): Promise<void> {
  await syncAgentsForPlan(organization.id, normalizePlan(organization.plan));
}

