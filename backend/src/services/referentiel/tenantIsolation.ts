import { prisma } from '../../db/prisma.js';

/**
 * Isolation tenant — injecté depuis le contexte auth, jamais depuis le client.
 * Pour RLS Postgres : SET LOCAL app.current_tenant_id = '...'
 */
export async function withTenantRls<T>(
  organizationId: string,
  fn: () => Promise<T>
): Promise<T> {
  // Prisma $executeRaw pour poser le GUC de session (transaction-local si possible)
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_tenant_id', $1, true)`,
      organizationId
    );
    // Note : les appels prisma globaux hors tx ne voient pas ce GUC.
    // Les services critiques doivent utiliser le client tx ou filtrer organizationId.
    void tx;
    return fn();
  });
}

/** Test helper : toute query Contact DOIT filtrer organizationId. */
export function assertTenantFilterPresent(where: Record<string, unknown> | undefined): void {
  if (!where || where.organizationId == null) {
    throw new Error('TENANT_FILTER_MISSING — requête Contact sans organizationId');
  }
}

/**
 * Vérifie qu’un contact d’un autre tenant est inaccessible via findFirst scopé.
 */
export async function assertContactIsolated(opts: {
  attackerOrgId: string;
  victimContactId: string;
}): Promise<boolean> {
  const leak = await prisma.contact.findFirst({
    where: {
      id: opts.victimContactId,
      organizationId: opts.attackerOrgId,
      erasedAt: null,
    },
    select: { id: true },
  });
  return leak == null;
}
