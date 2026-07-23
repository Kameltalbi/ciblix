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

export async function seedTrialSubscriptionForOrganization(
  organization: Organization,
  options?: { tier?: import('@prisma/client').BillingTier; currency?: import('@prisma/client').BillingCurrency }
): Promise<void> {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);

  const billingTier =
    options?.tier ||
    (normalizePlan(organization.plan) === 'ENTERPRISE'
      ? 'ENTERPRISE'
      : normalizePlan(organization.plan) === 'BUSINESS'
        ? 'PRO'
        : normalizePlan(organization.plan) === 'BASIC'
          ? 'CROISSANCE'
          : 'DECOUVERTE');

  const trialPrice =
    billingTier === 'ENTERPRISE'
      ? 0
      : billingTier === 'PRO'
        ? 149
        : billingTier === 'CROISSANCE'
          ? 85
          : 29;

  await prisma.subscription.create({
    data: {
      organizationId: organization.id,
      plan: normalizePlan(organization.plan),
      price: trialPrice,
      billingPeriod: 'MONTHLY',
      paymentMethod: 'VIREMENT',
      paymentStatus: 'PENDING',
      startDate,
      endDate,
    },
  });

  const { startTrialSubscription } = await import('./billing/trialService.js');
  await startTrialSubscription({
    organizationId: organization.id,
    tier: billingTier as import('@prisma/client').BillingTier,
    currency: options?.currency || 'TND',
  });
}

export async function bootstrapOrganizationAgents(organization: Organization): Promise<void> {
  const billing = await prisma.billingSubscription.findUnique({ where: { organizationId: organization.id } });
  if (billing) {
    const { activateTrialAgents, activateTierAgents } = await import('./billing/trialService.js');
    if (billing.status === 'TRIALING') {
      await activateTrialAgents(organization.id);
    } else {
      await activateTierAgents(organization.id, billing.tier, {
        selectedDiscoveryAgent: billing.selectedDiscoveryAgent,
      });
    }
    return;
  }
  await syncAgentsForPlan(organization.id, normalizePlan(organization.plan));
}

