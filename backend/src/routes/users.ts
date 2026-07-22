import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '../db/prisma.js';
import auth, { AuthRequest } from '../middleware/auth.js';
import { UserRole } from '../lib/prismaInterop.js';
import { parsePagination } from '../lib/pagination.js';
import { checkUserLimit } from '../middleware/planRestrictions.js';

export const usersRoutes = Router();
usersRoutes.use(auth);

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(),
  name: z.string().min(1),
  role: z.nativeEnum(UserRole).optional(),
});

// GET /api/users - List all users (owner only)
usersRoutes.get('/', async (req: AuthRequest, res, next) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!currentUser || currentUser.role !== 'OWNER' || currentUser.organizationId !== req.organizationId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { page, limit, skip } = parsePagination(req.query);
    const where = { organizationId: req.organizationId };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e) { next(e); }
});

// POST /api/users - Create new user (owner only)
usersRoutes.post('/', checkUserLimit, async (req: AuthRequest, res, next) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!currentUser || currentUser.role !== 'OWNER') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const data = userSchema.parse(req.body);
    
    if (!data.password) {
      return res.status(400).json({ error: 'Mot de passe requis' });
    }

    if (data.role === 'SUPERADMIN') {
      return res.status(403).json({ error: 'Impossible d’attribuer le rôle SUPERADMIN' });
    }

    // Seul le propriétaire peut créer des utilisateurs ; le créateur d’org reste OWNER.
    const role = data.role === 'OWNER' || data.role === 'COMMERCIAL' || data.role === 'PARTNER'
      ? data.role
      : 'PARTNER';

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        role,
        organizationId: req.organizationId!,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json(user);
  } catch (e) { next(e); }
});

// PUT /api/users/:id - Update user (owner only, or self for name/email)
usersRoutes.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!currentUser || currentUser.organizationId !== req.organizationId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const targetUserId = req.params.id as string;
    const isSelf = targetUserId === req.userId;
    const isOwner = currentUser.role === 'OWNER';

    if (!isOwner && !isSelf) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const data = userSchema.partial().parse(req.body);

    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, organizationId: req.organizationId },
    });
    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // Only owner can change roles
    if (data.role && !isOwner) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    if (data.role === 'SUPERADMIN') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    // If password is provided, hash it
    const updateData: any = { ...data };
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
      delete updateData.password;
    }

    const user = await prisma.user.update({
      where: { id: targetUserId as string },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(user);
  } catch (e) { next(e); }
});

// DELETE /api/users/:id - Delete user (owner only)
usersRoutes.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!currentUser || currentUser.role !== 'OWNER' || currentUser.organizationId !== req.organizationId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const targetUserId = req.params.id as string;

    // Prevent deleting yourself
    if (targetUserId === req.userId) {
      return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, organizationId: req.organizationId },
    });
    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    await prisma.user.delete({
      where: { id: targetUserId },
    });

    res.json({ success: true });
  } catch (e) { next(e); }
});
