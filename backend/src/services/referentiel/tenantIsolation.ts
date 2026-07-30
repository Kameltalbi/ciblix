/**
 * Isolation multi-tenant Postgres RLS.
 *
 * - Fail-closed DB : sans tenant et sans bypass → 0 ligne.
 * - Contexte requête : AsyncLocalStorage (`rlsContext`) + SET LOCAL par query (prisma.ts).
 * - Helpers legacy set_* conservés pour scripts / chemins sans ALS.
 */

import { prisma } from '../../db/prisma.js';
import { runWithRlsContextAsync } from '../../db/rlsContext.js';

export async function setTenantRlsContext(organizationId: string): Promise<void> {
  const org = organizationId.trim();
  if (!org) {
    throw new Error('TENANT_RLS_MISSING_ORG');
  }
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

/** Accès cross-tenant contrôlé (login, SUPERADMIN, cron claim). */
export async function setRlsBypass(enabled: boolean): Promise<void> {
  await prisma.$executeRawUnsafe(
    `SELECT set_config('app.bypass_rls', $1, false), set_config('app.current_tenant_id', '', false)`,
    enabled ? 'on' : 'off'
  );
}

export async function withRlsBypass<T>(fn: () => Promise<T>): Promise<T> {
  return runWithRlsContextAsync({ type: 'bypass' }, fn);
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
  return runWithRlsContextAsync({ type: 'tenant', organizationId: org }, async () =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.bypass_rls', 'off', true), set_config('app.current_tenant_id', $1, true)`,
        org
      );
      return fn(tx);
    })
  );
}

/** Exécute sous contexte tenant ALS (SET LOCAL auto via prisma extends). */
export async function withTenantRls<T>(organizationId: string, fn: () => Promise<T>): Promise<T> {
  const org = organizationId.trim();
  if (!org) throw new Error('TENANT_RLS_MISSING_ORG');
  return runWithRlsContextAsync({ type: 'tenant', organizationId: org }, fn);
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
  await withTenantRls(opts.attackerOrgId, async () => {
    const leak = await prisma.contact.findFirst({
      where: { id: opts.victimContactId },
    });
    if (leak) {
      throw new Error('TENANT_ISOLATION_BREACH — contact visible hors organisation');
    }
  });
}
