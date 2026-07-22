import type { AgentEventSource, Contact, ContactCreatedVia, ContactPipelineStatus, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { namesConflict, normalizeEmail, normalizeName, normalizePhone, normalizeWhatsapp } from './normalize.js';

export type FindOrCreateContactInput = {
  organizationId: string;
  createdVia: ContactCreatedVia;
  name?: string | null;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsappId?: string | null;
  /** Pour log ContactDedupConflict — source de l'event qui a déclenché la création */
  conflictSource?: AgentEventSource;
  conflictSourceRef?: string | null;
  /** Réservé scripts/admin — jamais exposé via API publique */
  allowManualImport?: boolean;
  /** Évite un rescan org par contact lors d'imports Hunt en lot */
  skipRescan?: boolean;
};

function assertWritableVia(createdVia: ContactCreatedVia, allowManualImport?: boolean): void {
  if (createdVia === 'MANUAL_IMPORT' && !allowManualImport) {
    throw new Error('MANUAL_IMPORT requires allowManualImport flag (admin/script only)');
  }
}

function hasIdentifier(input: {
  phoneNormalized: string | null;
  emailNormalized: string | null;
  whatsappNormalized: string | null;
}): boolean {
  return Boolean(input.phoneNormalized || input.emailNormalized || input.whatsappNormalized);
}

async function findExistingContact(
  organizationId: string,
  keys: {
    phoneNormalized: string | null;
    emailNormalized: string | null;
    whatsappNormalized: string | null;
  }
): Promise<Contact | null> {
  if (keys.phoneNormalized) {
    const c = await prisma.contact.findFirst({
      where: { organizationId, phoneNormalized: keys.phoneNormalized, erasedAt: null },
    });
    if (c) return c;
  }
  if (keys.emailNormalized) {
    const c = await prisma.contact.findFirst({
      where: { organizationId, emailNormalized: keys.emailNormalized, erasedAt: null },
    });
    if (c) return c;
  }
  if (keys.whatsappNormalized) {
    const c = await prisma.contact.findFirst({
      where: { organizationId, whatsappNormalized: keys.whatsappNormalized, erasedAt: null },
    });
    if (c) return c;
  }
  return null;
}

async function applyNameConflictHandling(
  existing: Contact,
  input: FindOrCreateContactInput,
  incomingName: string | null
): Promise<Contact> {
  const updates: Prisma.ContactUpdateInput = {};
  if (!existing.companyName && input.companyName?.trim()) {
    updates.companyName = input.companyName.trim();
  }

  if (!existing.name?.trim() && incomingName) {
    updates.name = incomingName;
    return prisma.contact.update({ where: { id: existing.id }, data: updates });
  }

  if (!incomingName || !namesConflict(existing.name, incomingName)) {
    if (Object.keys(updates).length === 0) return existing;
    return prisma.contact.update({ where: { id: existing.id }, data: updates });
  }

  const aliases = existing.aliases || [];
  const aliasLower = aliases.map((a) => a.toLowerCase());
  const needsAlias = !aliasLower.includes(incomingName.toLowerCase());

  if (input.conflictSource) {
    await prisma.contactDedupConflict.create({
      data: {
        organizationId: input.organizationId,
        existingContactId: existing.id,
        attemptedName: incomingName,
        attemptedPhone: input.phone || null,
        attemptedEmail: input.email || null,
        attemptedWhatsapp: input.whatsappId || null,
        source: input.conflictSource,
        sourceRef: input.conflictSourceRef || null,
      },
    });
  }

  if (!needsAlias) return existing;

  return prisma.contact.update({
    where: { id: existing.id },
    data: {
      aliases: [...aliases, incomingName],
      ...(!existing.companyName && input.companyName?.trim()
        ? { companyName: input.companyName.trim() }
        : {}),
    },
  });
}

/**
 * Seule porte d'entrée pour créer/mettre à jour un Contact.
 * Dédup : téléphone > email > WhatsApp.
 */
export async function findOrCreateContact(input: FindOrCreateContactInput): Promise<Contact> {
  assertWritableVia(input.createdVia, input.allowManualImport);

  const phoneNormalized = normalizePhone(input.phone);
  const emailNormalized = normalizeEmail(input.email);
  const whatsappNormalized = normalizeWhatsapp(input.whatsappId);
  const incomingName = normalizeName(input.name);

  if (!hasIdentifier({ phoneNormalized, emailNormalized, whatsappNormalized })) {
    throw new Error('At least one of phone, email, or whatsappId is required');
  }

  const existing = await findExistingContact(input.organizationId, {
    phoneNormalized,
    emailNormalized,
    whatsappNormalized,
  });

  if (existing) {
    return applyNameConflictHandling(existing, input, incomingName);
  }

  const created = await prisma.contact.create({
    data: {
      organizationId: input.organizationId,
      name: incomingName,
      companyName: input.companyName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      whatsappId: input.whatsappId?.trim() || null,
      phoneNormalized,
      emailNormalized,
      whatsappNormalized,
      createdVia: input.createdVia,
    },
  });

  void import('./contactResolution.js').then(({ scheduleOrgRescan }) => {
    if (!input.skipRescan) scheduleOrgRescan(input.organizationId);
  });

  return created;
}

export async function listContacts(
  organizationId: string,
  opts: {
    take?: number;
    skip?: number;
    search?: string;
    status?: ContactPipelineStatus;
    sort?: 'pipelineStatusAt' | 'createdAt';
    sortDir?: 'asc' | 'desc';
  } = {}
): Promise<{ items: Contact[]; total: number }> {
  const take = Math.min(opts.take ?? 30, 100);
  const skip = opts.skip ?? 0;
  const search = opts.search?.trim();
  const sortField = opts.sort === 'createdAt' ? 'createdAt' : 'pipelineStatusAt';
  const sortDir = opts.sortDir === 'asc' ? 'asc' : 'desc';

  const where: Prisma.ContactWhereInput = {
    organizationId,
    erasedAt: null,
    ...(opts.status ? { pipelineStatus: opts.status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { companyName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { [sortField]: sortDir },
      take,
      skip,
    }),
    prisma.contact.count({ where }),
  ]);

  return { items, total };
}

export async function getContactById(organizationId: string, contactId: string): Promise<Contact | null> {
  return prisma.contact.findFirst({
    where: { id: contactId, organizationId, erasedAt: null },
  });
}
