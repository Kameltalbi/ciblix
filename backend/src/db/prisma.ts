import { PrismaClient } from '../lib/prismaInterop.js';
import { getRlsContext, rlsContext, rlsContextInTx } from './rlsContext.js';

type PrismaClientSingleton = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as { prismaBase?: PrismaClientSingleton };

const base =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaBase = base;

function modelDelegateKey(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

async function applyRlsLocal(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  ctx: NonNullable<ReturnType<typeof getRlsContext>>
): Promise<void> {
  if (ctx.type === 'bypass') {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.bypass_rls', 'on', true), set_config('app.current_tenant_id', '', true)`
    );
    return;
  }
  await tx.$executeRawUnsafe(
    `SELECT set_config('app.bypass_rls', 'off', true), set_config('app.current_tenant_id', $1, true)`,
    ctx.organizationId
  );
}

const extended = base.$extends({
  query: {
    async $allOperations({ model, operation, args, query }) {
      const ctx = getRlsContext();
      if (!ctx) {
        return query(args);
      }
      if ('_inTx' in ctx && ctx._inTx) {
        return query(args);
      }

      return rlsContext.run(rlsContextInTx(ctx), () =>
        base.$transaction(async (tx) => {
          await applyRlsLocal(tx, ctx);
          if (model) {
            const key = modelDelegateKey(model);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const delegate = (tx as any)[key];
            if (!delegate?.[operation]) {
              throw new Error(`RLS_TX_MISSING_DELEGATE:${model}.${operation}`);
            }
            return delegate[operation](args);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const txAny = tx as any;
          if (typeof txAny[operation] !== 'function') {
            throw new Error(`RLS_TX_MISSING_RAW:${operation}`);
          }
          if (
            args &&
            typeof args === 'object' &&
            'values' in (args as object) &&
            'strings' in (args as object)
          ) {
            return txAny[operation](args);
          }
          if (Array.isArray(args)) {
            return txAny[operation](...args);
          }
          return txAny[operation](args);
        })
      );
    },
  },
});

/**
 * Client Prisma avec isolation RLS absolue (SET LOCAL par opération si ALS actif).
 * Casté en PrismaClient pour rester compatible avec tout le code existant.
 */
export const prisma = extended as unknown as PrismaClientSingleton;
