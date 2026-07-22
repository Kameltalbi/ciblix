import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import auth, { AuthRequest } from '../middleware/auth.js';

export const userPermissionsRoutes = Router();
userPermissionsRoutes.use(auth);

const permissionSchema = z.object({
  userId: z.string().min(1),
  page: z.string().min(1),
  canView: z.boolean().optional(),
  canCreate: z.boolean().optional(),
  canEdit: z.boolean().optional(),
  canDelete: z.boolean().optional(),
});

const AVAILABLE_PAGES = [
  'dashboard',
  'contacts',
  'affaires',
  'clients',
  'leads',
  'calendar',
  'expenses',
  'activites',
  'email-templates',
  'ai-assistant',
  'prospection-ia',
  'scout-ai',
  'offre-bot',
  'gmail-ai',
  'factcheck-ai',
  'brand-pulse',
  'agents-marketplace',
  'objectifs',
  'settings',
  'support',
] as const;

// GET permissions for a user
userPermissionsRoutes.get('/user/:userId', async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.params;
    const permissions = await prisma.userPermission.findMany({
      where: {
        userId: userId as string,
        organizationId: req.organizationId,
      },
    });
    res.json(permissions);
  } catch (e) { next(e); }
});

// GET current user's permissions
userPermissionsRoutes.get('/me', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Non authentifié' });
    
    const permissions = await prisma.userPermission.findMany({
      where: {
        userId: req.userId,
        organizationId: req.organizationId,
      },
    });
    
    // If user is OWNER, return full access to all pages
    if (req.user?.role === 'OWNER') {
      const fullPermissions = AVAILABLE_PAGES.map(page => ({
        page,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
      }));
      return res.json(fullPermissions);
    }
    
    res.json(permissions);
  } catch (e) { next(e); }
});

// POST create/update permissions for a user (bulk)
userPermissionsRoutes.post('/bulk', async (req: AuthRequest, res, next) => {
  try {
    const actor = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!actor || actor.role !== 'OWNER' || actor.organizationId !== req.organizationId) {
      return res.status(403).json({ error: 'Réservé à l’administrateur de l’organisation' });
    }

    const { userId, permissions } = req.body as {
      userId: string;
      permissions: Array<{
        page: string;
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
      }>;
    };

    // Verify user belongs to organization
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId: req.organizationId },
    });
    if (!user) return res.status(400).json({ error: 'Utilisateur introuvable' });
    if (user.role === 'OWNER' || user.role === 'SUPERADMIN') {
      return res.status(400).json({ error: 'Les administrateurs ont déjà un accès complet' });
    }

    // Delete existing permissions for this user
    await prisma.userPermission.deleteMany({
      where: {
        userId,
        organizationId: req.organizationId,
      },
    });

    // Create new permissions
    const created = await prisma.userPermission.createMany({
      data: permissions.map(p => ({
        userId,
        organizationId: req.organizationId!,
        page: p.page,
        canView: p.canView,
        canCreate: p.canCreate,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
      })),
    });

    res.json({ created });
  } catch (e) { next(e); }
});

// POST create/update single permission
userPermissionsRoutes.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = permissionSchema.parse(req.body);

    // Verify user belongs to organization
    const user = await prisma.user.findFirst({
      where: { id: data.userId, organizationId: req.organizationId },
    });
    if (!user) return res.status(400).json({ error: 'Utilisateur introuvable' });

    // Upsert permission
    const permission = await prisma.userPermission.upsert({
      where: {
        organizationId_userId_page: {
          organizationId: req.organizationId!,
          userId: data.userId,
          page: data.page,
        },
      },
      update: {
        canView: data.canView,
        canCreate: data.canCreate,
        canEdit: data.canEdit,
        canDelete: data.canDelete,
      },
      create: {
        userId: data.userId,
        organizationId: req.organizationId!,
        page: data.page,
        canView: data.canView ?? true,
        canCreate: data.canCreate ?? false,
        canEdit: data.canEdit ?? false,
        canDelete: data.canDelete ?? false,
      },
    });

    res.json(permission);
  } catch (e) { next(e); }
});

// DELETE permission
userPermissionsRoutes.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const permission = await prisma.userPermission.findFirst({
      where: {
        id: req.params.id as string,
        organizationId: req.organizationId,
      },
    });
    if (!permission) return res.status(404).json({ error: 'Permission introuvable' });

    await prisma.userPermission.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (e) { next(e); }
});
