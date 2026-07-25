import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '../db/prisma.js';
import auth, { AuthRequest } from '../middleware/auth.js';
import { UserRole } from '../lib/prismaInterop.js';
import { parsePagination } from '../lib/pagination.js';
import { checkUserLimit, resolveMaxUsers } from '../middleware/planRestrictions.js';
import { PASSWORD_REGEX, PASSWORD_RULE_MSG } from '../lib/passwordPolicy.js';

export const usersRoutes = Router();
usersRoutes.use(auth);

const passwordField = z.string().min(8).regex(PASSWORD_REGEX, PASSWORD_RULE_MSG);

const userSchema = z.object({
  email: z.string().email(),
  password: passwordField.optional(),
  name: z.string().min(1),
  role: z.nativeEnum(UserRole).optional(),
});

function isOrgAdmin(role: string) {
  return role === 'OWNER' || role === 'SUPERADMIN';
}

// GET /api/users - List all users (admin only) + quota sièges
usersRoutes.get('/', async (req: AuthRequest, res, next) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (
      !currentUser ||
      !isOrgAdmin(currentUser.role) ||
      currentUser.organizationId !== req.organizationId
    ) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { page, limit, skip } = parsePagination(req.query);
    const where = { organizationId: req.organizationId };

    const [users, total, seats] = await Promise.all([
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
      resolveMaxUsers(req.organizationId!),
    ]);

    const max = seats.maxUsers === Infinity ? null : seats.maxUsers;

    res.json({
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      seats: {
        used: total,
        max,
        canAdd: max == null ? true : total < max,
        plan: seats.plan,
        tier: seats.tier,
      },
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/users - Create new user with password (admin only, quota plan)
usersRoutes.post('/', checkUserLimit, async (req: AuthRequest, res, next) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!currentUser || !isOrgAdmin(currentUser.role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const data = userSchema.parse(req.body);

    if (!data.password) {
      return res.status(400).json({ error: 'Mot de passe requis' });
    }

    if (data.role === 'SUPERADMIN') {
      return res.status(403).json({ error: 'Impossible d’attribuer le rôle SUPERADMIN' });
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    const role =
      data.role === 'OWNER' || data.role === 'COMMERCIAL' || data.role === 'PARTNER'
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
  } catch (e) {
    next(e);
  }
});

// PUT /api/users/:id - Admin met à jour profil / reset MDP ; self = nom/email seulement
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
    const isAdmin = isOrgAdmin(currentUser.role);

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const data = userSchema.partial().parse(req.body);

    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, organizationId: req.organizationId },
    });
    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    if (data.role && !isAdmin) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    if (data.role === 'SUPERADMIN') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    // Reset MDP : réservé à l’admin du compte. Sinon → Paramètres > Sécurité.
    if (data.password) {
      if (!isAdmin) {
        return res.status(403).json({
          error: 'Pour changer votre mot de passe, utilisez Paramètres → Sécurité.',
        });
      }
    }

    if (!isAdmin && isSelf) {
      // Collaborateur : uniquement nom / email
      const selfUpdate: { name?: string; email?: string } = {};
      if (data.name) selfUpdate.name = data.name;
      if (data.email) selfUpdate.email = data.email;
      const user = await prisma.user.update({
        where: { id: targetUserId },
        data: selfUpdate,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return res.json(user);
    }

    const updateData: Record<string, unknown> = {};
    if (data.email) updateData.email = data.email;
    if (data.name) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    const user = await prisma.user.update({
      where: { id: targetUserId },
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

    // Si admin reset le MDP d’un user, invalider ses sessions
    if (data.password) {
      await prisma.refreshToken.deleteMany({ where: { userId: targetUserId } });
    }

    res.json(user);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/users/:id - Delete user (admin only)
usersRoutes.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (
      !currentUser ||
      !isOrgAdmin(currentUser.role) ||
      currentUser.organizationId !== req.organizationId
    ) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const targetUserId = req.params.id as string;
    if (targetUserId === req.userId) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, organizationId: req.organizationId },
    });
    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    await prisma.refreshToken.deleteMany({ where: { userId: targetUserId } });
    await prisma.user.delete({ where: { id: targetUserId } });

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});
