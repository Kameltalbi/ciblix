/**
 * Contexte RLS lié à la requête / tâche (AsyncLocalStorage).
 * Chaque query Prisma applique SET LOCAL sur la même connexion transactionnelle.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export type RlsContext =
  | { type: 'tenant'; organizationId: string }
  | { type: 'bypass' }
  /** Marqueur interne : déjà dans une tx RLS (évite la récursion $extends). */
  | { type: 'tenant'; organizationId: string; _inTx: true }
  | { type: 'bypass'; _inTx: true };

export const rlsContext = new AsyncLocalStorage<RlsContext>();

export function getRlsContext(): RlsContext | undefined {
  return rlsContext.getStore();
}

export function runWithRlsContext<T>(ctx: RlsContext, fn: () => T): T {
  return rlsContext.run(ctx, fn);
}

export async function runWithRlsContextAsync<T>(
  ctx: Exclude<RlsContext, { _inTx: true }>,
  fn: () => Promise<T>
): Promise<T> {
  return rlsContext.run(ctx, fn);
}

export function rlsContextInTx(ctx: RlsContext): RlsContext {
  if (ctx.type === 'bypass') return { type: 'bypass', _inTx: true };
  return { type: 'tenant', organizationId: ctx.organizationId, _inTx: true };
}
