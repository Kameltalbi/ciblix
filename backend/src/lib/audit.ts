import type { AuditAction } from '@prisma/client';
import { prisma } from '../db/prisma.js';

export async function logAudit({
  organizationId,
  userId,
  action,
  entityType,
  entityId,
  oldValues,
  newValues,
  ipAddress,
  userAgent,
}: {
  organizationId: string;
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action,
        entityType,
        entityId,
        oldValues: oldValues ? JSON.stringify(oldValues) : null,
        newValues: newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}
