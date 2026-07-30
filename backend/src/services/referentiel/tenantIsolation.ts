/**
 * Isolation multi-tenant Postgres RLS.
 *
 * - Fail-closed : sans `app.current_tenant_id` et sans bypass → 0 ligne.
 * - Bypass explicite : migrations, login, SUPERADMIN, workers (qui filtrent déjà en app).
 * - SET LOCAL (is_local=true) dès qu’on est dans une transaction ; sinon session + clear en fin de requête.
 */

import { prisma } from '../../db/prisma.js';

export async function setTenantRlsContext(organizationId: string): Promise<void> {
  const org = organizationId.trim();
  if (!org) {
    throw new Error('TENANT_RLS_MISSING_ORG');
  }
  // Désactive le bypass si on pose un tenant
  await prisma.$executeRawUnsafe(
    `SELECT set_config('app.bypass_rls', 'off', false), set_config('app.current_tenant_id', $1, false)`,
    org
  );
}

export async function clearTenantRlsContext(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `SELECT set_config('app.current_tenant_id', '', false), set_config('app.bypass_rls', 'off', false)`
  );
}

/** Accès cross-tenant contrôlé (login, SUPERADMIN, cron/orchestrateur). */
export async function setRlsBypass(enabled: boolean): Promise<void> {
  await prisma.$executeRawUnsafe(
    `SELECT set_config('app.bypass_rls', $1, false), set_config('app.current_tenant_id', '', false)`,
    enabled ? 'on' : 'off'
  );
}

/**
 * Exécute `fn` avec bypass RLS (même connexion / session Prisma).
 * Toujours clear en finally.
 */
export async function withRlsBypass<T>(fn: () => Promise<T>): Promise<T> {
  await setRlsBypass(true);
  try {
    return await fn();
  } finally {
    try {
      await clearTenantRlsContext();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Exécute `fn` dans une transaction avec SET LOCAL tenant (étanche au pool).
 */
export async function withTenantRlsTransaction<T>(
  organizationId: string,
  fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  const org = organizationId.trim();
  if (!org) throw new Error('TENANT_RLS_MISSING_ORG');
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.bypass_rls', 'off', true), set_config('app.current_tenant_id', $1, true)`,
      org
    );
    return fn(tx);
  });
}

/** @deprecated alias — préférer setTenantRlsContext */
export async function withTenantRls<T>(organizationId: string, fn: () => Promise<T>): Promise<T> {
  await setTenantRlsContext(organizationId);
  try {
    return await fn();
  } finally {
    try {
      await clearTenantRlsContext();
    } catch {
      /* ignore */
    }
  }
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
}): Promise<void> {
  await setTenantRlsContext(opts.attackerOrgId);
  try {
    const leak = await prisma.contact.findFirst({
      where: { id: opts.victimContactId },
    });
    if (leak) {
      throw new Error('TENANT_ISOLATION_BREACH — contact visible hors organisation');
    }
  } finally {
    await clearTenantRlsContext();
  }
}
