import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import auth, { AuthRequest } from '../middleware/auth.js';

export const categoriesRoutes = Router();

categoriesRoutes.use(auth);

const categorySchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  type: z.string().min(1, 'Le type est requis'),
});

categoriesRoutes.get('/', async (req: AuthRequest, res, next) => {
  try {
    const organizationId = req.organizationId;
    const type = req.query.type as string;

    const where: any = { organizationId };
    if (type) where.type = type;

    const categories = await prisma.customCategory.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json(categories);
  } catch (e) { next(e); }
});

categoriesRoutes.post('/', async (req: AuthRequest, res, next) => {
  try {
    const organizationId = req.organizationId as string;
    const { name, type } = categorySchema.parse(req.body);

    const category = await prisma.customCategory.create({
      data: { organizationId, name, type },
    });

    res.status(201).json(category);
  } catch (e) { next(e); }
});

categoriesRoutes.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.customCategory.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId as string },
    });

    if (!existing) return res.status(404).json({ error: 'Catégorie non trouvée' });

    await prisma.customCategory.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { next(e); }
});
