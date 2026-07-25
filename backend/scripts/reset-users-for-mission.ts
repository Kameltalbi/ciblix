/**
 * Remet toutes les orgs en état « première connexion Mission IA » :
 * - conserve comptes utilisateurs + organisations + facturation
 * - efface les données métier (contacts, prospects, CRM, agents, etc.)
 * - réinitialise OrgTargetingProfile → missionStatus NONE
 * - invalide les sessions (refresh tokens) pour forcer une reconnexion
 *
 * Usage :
 *   CONFIRM=YES npx tsx scripts/reset-users-for-mission.ts
 *   DRY_RUN=1 npx tsx scripts/reset-users-for-mission.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const confirmed = process.env.CONFIRM === 'YES';

async function countWhere(model: { count: (args: { where: { organizationId: string } }) => Promise<number> }, organizationId: string) {
  return model.count({ where: { organizationId } });
}

async function wipeOrganization(organizationId: string) {
  const counts: Record<string, number> = {};
  const del = async (label: string, result: { count: number }) => {
    counts[label] = result.count;
  };

  // Ordre respectant les FK (enfants avant parents)
  await del('supportTicketMessage', await prisma.supportTicketMessage.deleteMany({ where: { organizationId } }));
  await del('supportTicket', await prisma.supportTicket.deleteMany({ where: { organizationId } }));
  await del('suggestion', await prisma.suggestion.deleteMany({ where: { organizationId } }));
  await del('copilotMessage', await prisma.copilotMessage.deleteMany({ where: { organizationId } }));
  await del('webhookDeliveryLog', await prisma.webhookDeliveryLog.deleteMany({ where: { organizationId } }));
  await del('agentEvent', await prisma.agentEvent.deleteMany({ where: { organizationId } }));
  await del('contactDedupConflict', await prisma.contactDedupConflict.deleteMany({ where: { organizationId } }));
  await del('whatsappSessionBuffer', await prisma.whatsappSessionBuffer.deleteMany({ where: { organizationId } }));
  await del('contact', await prisma.contact.deleteMany({ where: { organizationId } }));
  await del('agentTask', await prisma.agentTask.deleteMany({ where: { organizationId } }));

  await del('aiProspectActivity', await prisma.aiProspectActivity.deleteMany({ where: { organizationId } }));
  await del('aiProspect', await prisma.aiProspect.deleteMany({ where: { organizationId } }));
  await del('prospectingAutomation', await prisma.prospectingAutomation.deleteMany({ where: { organizationId } }));

  await del('scoutOpportunity', await prisma.scoutOpportunity.deleteMany({ where: { organizationId } }));
  await del('scoutProfile', await prisma.scoutProfile.deleteMany({ where: { organizationId } }));

  await del('leadActivite', await prisma.leadActivite.deleteMany({ where: { organizationId } }));
  await del('activite', await prisma.activite.deleteMany({ where: { organizationId } }));
  await del('calendarEvent', await prisma.calendarEvent.deleteMany({ where: { organizationId } }));
  await del('expense', await prisma.expense.deleteMany({ where: { organizationId } }));
  await del('email', await prisma.email.deleteMany({ where: { organizationId } }));
  await del('affaire', await prisma.affaire.deleteMany({ where: { organizationId } }));
  await del('lead', await prisma.lead.deleteMany({ where: { organizationId } }));
  await del('client', await prisma.client.deleteMany({ where: { organizationId } }));
  await del('product', await prisma.product.deleteMany({ where: { organizationId } }));
  await del('customCategory', await prisma.customCategory.deleteMany({ where: { organizationId } }));
  await del('previsionMois', await prisma.previsionMois.deleteMany({ where: { organizationId } }));
  await del('salesObjective', await prisma.salesObjective.deleteMany({ where: { organizationId } }));
  await del('commissionConfig', await prisma.commissionConfig.deleteMany({ where: { organizationId } }));
  await del('emailTemplate', await prisma.emailTemplate.deleteMany({ where: { organizationId } }));
  await del('notification', await prisma.notification.deleteMany({ where: { organizationId } }));
  await del('auditLog', await prisma.auditLog.deleteMany({ where: { organizationId } }));

  await del('gmailAiProcessedMessage', await prisma.gmailAiProcessedMessage.deleteMany({ where: { organizationId } }));
  await del('gmailAiSyncState', await prisma.gmailAiSyncState.deleteMany({ where: { organizationId } }));
  await del('gmailToken', await prisma.gmailToken.deleteMany({ where: { organizationId } }));

  await del('brandScoreSnapshot', await prisma.brandScoreSnapshot.deleteMany({ where: { organizationId } }));
  await del('brandArticle', await prisma.brandArticle.deleteMany({ where: { organizationId } }));
  await del('brandRecommendation', await prisma.brandRecommendation.deleteMany({ where: { organizationId } }));
  await del('brandAlert', await prisma.brandAlert.deleteMany({ where: { organizationId } }));
  await del('brandCmsConnection', await prisma.brandCmsConnection.deleteMany({ where: { organizationId } }));
  await del('brandChannelConnection', await prisma.brandChannelConnection.deleteMany({ where: { organizationId } }));
  await del('brandCompetitorSnapshot', await prisma.brandCompetitorSnapshot.deleteMany({ where: { organizationId } }));
  await del('brandApiKey', await prisma.brandApiKey.deleteMany({ where: { organizationId } }));
  await del('brandProfile', await prisma.brandProfile.deleteMany({ where: { organizationId } }));

  await del('outboundWebhookConfig', await prisma.outboundWebhookConfig.deleteMany({ where: { organizationId } }));
  await del('copilotOrgConfig', await prisma.copilotOrgConfig.deleteMany({ where: { organizationId } }));
  await del('agentUsageMonthly', await prisma.agentUsageMonthly.deleteMany({ where: { organizationId } }));
  await del('llmUsageLog', await prisma.llmUsageLog.deleteMany({ where: { organizationId } }));

  // Mission IA → état vierge
  await del('orgTargetingProfile', await prisma.orgTargetingProfile.deleteMany({ where: { organizationId } }));

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      onboardingCompletedAt: null,
      onboardingSector: null,
    },
  });

  return counts;
}

async function main() {
  console.log(dryRun ? '=== DRY RUN (aucune écriture) ===' : '=== RESET USERS → MISSION IA ===');

  if (!dryRun && !confirmed) {
    console.error('Refuse d’exécuter sans CONFIRM=YES (ou lancez avec DRY_RUN=1).');
    process.exit(1);
  }

  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      users: { select: { id: true, role: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Organisations trouvées : ${orgs.length}`);

  let wiped = 0;
  let skipped = 0;

  for (const org of orgs) {
    const hasTenantUser = org.users.some((u) => u.role !== 'SUPERADMIN');
    if (!hasTenantUser) {
      console.log(`— skip platform org "${org.name}" (${org.id})`);
      skipped += 1;
      continue;
    }

    const userIds = org.users.filter((u) => u.role !== 'SUPERADMIN').map((u) => u.id);
    console.log(`→ ${org.name} (${org.id}) — ${userIds.length} user(s)`);

    if (dryRun) {
      const contacts = await countWhere(prisma.contact, org.id);
      const tasks = await countWhere(prisma.agentTask, org.id);
      const prospects = await countWhere(prisma.aiProspect, org.id);
      const mission = await prisma.orgTargetingProfile.findUnique({
        where: { organizationId: org.id },
        select: { missionStatus: true },
      });
      console.log(
        `  dry: contacts=${contacts} tasks=${tasks} prospects=${prospects} mission=${mission?.missionStatus ?? 'NONE'}`
      );
      wiped += 1;
      continue;
    }

    const counts = await wipeOrganization(org.id);
    if (userIds.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    }
    const deletedRows = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`  ok — ${deletedRows} lignes métier effacées, mission réinitialisée`);

    wiped += 1;
  }

  // Caches globaux de prospection (non scopés org)
  if (!dryRun) {
    const sc = await prisma.prospectingSearchCache.deleteMany({});
    const wc = await prisma.prospectingWebsiteCache.deleteMany({});
    console.log(`Caches prospection : search=${sc.count} website=${wc.count}`);
  }

  console.log(`Terminé. orgs traitées=${wiped} skip=${skipped}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
