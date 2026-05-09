import { PrismaClient } from '../lib/prismaInterop.js';

type PrismaClientSingleton = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientSingleton };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
