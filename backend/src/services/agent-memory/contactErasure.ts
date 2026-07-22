import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../lib/audit.js';
import { deleteRawContent } from './s3RawContent.js';
import { ERASED_PLACEHOLDER } from './constants.js';

/**
 * Effacement RGPD — anonymise le contact et tous ses AgentEvent.
 * Ne pas confondre avec delete technique (merge) ni SetNull seul.
 */
export async function eraseContactData(opts: {
  organizationId: string;
  contactId: string;
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const contact = await prisma.contact.findFirst({
    where: { id: opts.contactId, organizationId: opts.organizationId, erasedAt: null },
  });
  if (!contact) throw new Error('Contact introuvable ou déjà effacé');

  const events = await prisma.agentEvent.findMany({
    where: { organizationId: opts.organizationId, contactId: opts.contactId },
    select: { id: true, contenuBrutRef: true },
  });

  for (const event of events) {
    if (event.contenuBrutRef) {
      await deleteRawContent(event.contenuBrutRef);
    }
  }

  await prisma.$transaction([
    prisma.agentEvent.updateMany({
      where: { organizationId: opts.organizationId, contactId: opts.contactId },
      data: {
        contactId: null,
        contenuBrutRef: null,
        contenuBrutExpiresAt: null,
        resume: ERASED_PLACEHOLDER,
        score: null,
        actionsSuggerees: [],
        consentConfirmedBy: null,
        consentConfirmedAt: null,
        sourceRef: null,
      },
    }),
    prisma.contact.update({
      where: { id: opts.contactId },
      data: {
        name: null,
        companyName: null,
        phone: null,
        email: null,
        whatsappId: null,
        phoneNormalized: null,
        emailNormalized: null,
        whatsappNormalized: null,
        aliases: [],
        erasedAt: new Date(),
      },
    }),
  ]);

  await logAudit({
    organizationId: opts.organizationId,
    userId: opts.actorUserId,
    action: 'DELETE',
    entityType: 'Contact',
    entityId: opts.contactId,
    newValues: { reason: 'gdpr_erase', eventsAnonymized: events.length },
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
  });
}
