import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../db/prisma.js';
import { createAgentEvent } from './agentEventService.js';
import { findOrCreateContact } from './contactService.js';
import { recordGmailInboundEmail } from './agentIntegrations.js';

const hasDb = Boolean(process.env.DATABASE_URL);

async function seedOrgUser() {
  const org = await prisma.organization.create({
    data: { name: `test-dedup-${Date.now()}`, paymentStatus: 'APPROVED' },
  });
  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `dedup-${Date.now()}@test.local`,
      passwordHash: 'test-hash',
      name: 'Test User',
    },
  });
  return { org, user };
}

async function cleanup(orgId: string) {
  await prisma.agentEvent.deleteMany({ where: { organizationId: orgId } });
  await prisma.contactDedupConflict.deleteMany({ where: { organizationId: orgId } });
  await prisma.contact.deleteMany({ where: { organizationId: orgId } });
  await prisma.user.deleteMany({ where: { organizationId: orgId } });
  await prisma.organization.delete({ where: { id: orgId } });
}

describe.skipIf(!hasDb)('contact dedup cross-agent', () => {
  let orgId = '';
  let userId = '';
  const gmailMessageId = `gmail-msg-${Date.now()}`;

  beforeAll(async () => {
    const { org, user } = await seedOrgUser();
    orgId = org.id;
    userId = user.id;
  });

  afterAll(async () => {
    if (orgId) await cleanup(orgId);
    await prisma.$disconnect();
  });

  it('scénario 1 — dédup réussie Gmail puis Hunt', async () => {
    await recordGmailInboundEmail({
      organizationId: orgId,
      userId,
      fromEmail: 'contact@exemple.tn',
      summary: 'Résumé email test',
      gmailMessageId,
    });

    const gmailContacts = await prisma.contact.findMany({
      where: { organizationId: orgId, emailNormalized: 'contact@exemple.tn' },
    });
    expect(gmailContacts).toHaveLength(1);

    const huntContact = await findOrCreateContact({
      organizationId: orgId,
      email: 'Contact@Exemple.tn',
      createdVia: 'HUNT',
      conflictSource: 'HUNT',
    });
    expect(huntContact.id).toBe(gmailContacts[0].id);

    await createAgentEvent({
      organizationId: orgId,
      userId,
      contactId: huntContact.id,
      source: 'HUNT',
      type: 'NOTE',
      resume: 'Prospect Hunt test',
      sourceRef: `hunt-test-${Date.now()}`,
    });

    const allContacts = await prisma.contact.count({ where: { organizationId: orgId } });
    const events = await prisma.agentEvent.findMany({
      where: { organizationId: orgId, contactId: huntContact.id },
    });
    expect(allContacts).toBe(1);
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.some((e) => e.source === 'GMAIL')).toBe(true);
    expect(events.some((e) => e.source === 'HUNT')).toBe(true);
  });

  it('scénario 2 — premier nom réel quand contact sans name', async () => {
    const contact = await findOrCreateContact({
      organizationId: orgId,
      email: `empty-name-${Date.now()}@exemple.tn`,
      createdVia: 'GMAIL',
    });
    expect(contact.name).toBeNull();

    const updated = await findOrCreateContact({
      organizationId: orgId,
      email: contact.email!,
      name: 'Ahmed Ben Ali',
      createdVia: 'HUNT',
      conflictSource: 'HUNT',
    });

    expect(updated.id).toBe(contact.id);
    expect(updated.name).toBe('Ahmed Ben Ali');
  });

  it('scénario 3 — conflit de nom, alias + ContactDedupConflict', async () => {
    const email = `conflict-${Date.now()}@exemple.tn`;
    await findOrCreateContact({
      organizationId: orgId,
      email,
      name: 'Sami',
      createdVia: 'GMAIL',
      conflictSource: 'GMAIL',
    });

    const afterConflict = await findOrCreateContact({
      organizationId: orgId,
      email,
      name: 'Ahmed',
      createdVia: 'HUNT',
      conflictSource: 'HUNT',
      conflictSourceRef: 'hunt-conflict-test',
    });

    expect(afterConflict.name).toBe('Sami');
    expect(afterConflict.aliases.map((a) => a.toLowerCase())).toContain('ahmed');

    const conflicts = await prisma.contactDedupConflict.findMany({
      where: {
        organizationId: orgId,
        existingContactId: afterConflict.id,
        attemptedName: 'Ahmed',
        source: 'HUNT',
      },
    });
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });
});
