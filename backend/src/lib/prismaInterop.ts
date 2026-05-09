/**
 * @prisma/client is CommonJS. With "type": "module", named imports break at runtime.
 * Re-export Prisma values from the default export once.
 */
import prismaPackage from '@prisma/client';

export const PrismaClient = prismaPackage.PrismaClient;
export const UserRole = prismaPackage.UserRole;
export const AuditAction = prismaPackage.AuditAction;
export const StatutAffaire = prismaPackage.StatutAffaire;
export const ActiviteType = prismaPackage.ActiviteType;
export const ProductType = prismaPackage.ProductType;
export const NotificationType = prismaPackage.NotificationType;
export const SupportTicketCategory = prismaPackage.SupportTicketCategory;
export const SupportTicketPriority = prismaPackage.SupportTicketPriority;
export const SupportTicketStatus = prismaPackage.SupportTicketStatus;
