import { Router } from 'express';
import { PrismaClient } from '../lib/prismaInterop.js';
import auth from '../middleware/auth.js';

export const categoriesRoutes = Router();
const prisma = new PrismaClient();

categoriesRoutes.use(auth);

// GET /categories - List custom categories
categoriesRoutes.get('/', async (req: any, res) => {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /categories - Create a custom category
categoriesRoutes.post('/', async (req: any, res) => {
  try {
    const organizationId = req.organizationId;
    const { name, type } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'name et type sont requis' });
    }

    const category = await prisma.customCategory.create({
      data: { organizationId, name, type },
    });

    res.status(201).json(category);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Cette catégorie existe déjà' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /categories/:id - Delete a custom category
categoriesRoutes.delete('/:id', async (req: any, res) => {
  try {
    const organizationId = req.organizationId;

    const existing = await prisma.customCategory.findFirst({
      where: { id: req.params.id, organizationId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }

    await prisma.customCategory.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
