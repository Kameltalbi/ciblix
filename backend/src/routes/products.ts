import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { parsePagination } from '../lib/pagination.js';
import { ProductType } from '../lib/prismaInterop.js';

export const productsRoutes = Router();
productsRoutes.use(auth);
productsRoutes.use(requirePaymentApproved);

const toOptionalString = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().optional()
);

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  type: z.nativeEnum(ProductType).optional(),
  categoryId: toOptionalString,
  active: z.boolean().optional(),
});

async function ensureCategoryInOrganization(
  organizationId: string,
  categoryId: string | undefined
) {
  if (!categoryId) return null;
  const category = await prisma.customCategory.findFirst({
    where: { id: categoryId, organizationId, type: 'REVENUE' },
    select: { id: true },
  });
  if (!category) return 'Catégorie introuvable ou de type incompatible';
  return null;
}

// GET /api/products - List all products
productsRoutes.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = { organizationId: req.organizationId, deletedAt: null };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        include: { category: { select: { id: true, name: true, type: true } } },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e) { next(e); }
});

// GET /api/products/active - List only active products
productsRoutes.get('/active', async (req: AuthRequest, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { active: true, organizationId: req.organizationId },
      orderBy: { name: 'asc' },
      include: { category: { select: { id: true, name: true, type: true } } },
    });
    res.json(products);
  } catch (e) { next(e); }
});

// POST /api/products - Create new product
productsRoutes.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = productSchema.parse(req.body);

    const categoryError = await ensureCategoryInOrganization(req.organizationId!, data.categoryId);
    if (categoryError) return res.status(400).json({ error: categoryError });

    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        type: data.type || 'SERVICE',
        categoryId: data.categoryId ?? null,
        active: data.active !== undefined ? data.active : true,
        organizationId: req.organizationId!,
      },
      include: { category: { select: { id: true, name: true, type: true } } },
    });
    res.status(201).json(product);
  } catch (e) { next(e); }
});

// PUT /api/products/:id - Update product
productsRoutes.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = productSchema.partial().parse(req.body);
    const existing = await prisma.product.findFirst({
      where: {
        id: req.params.id as string,
        organizationId: req.organizationId,
        deletedAt: null,
      },
    });
    if (!existing) return res.status(404).json({ error: 'Produit introuvable' });

    if (data.categoryId !== undefined) {
      const categoryError = await ensureCategoryInOrganization(req.organizationId!, data.categoryId);
      if (categoryError) return res.status(400).json({ error: categoryError });
    }

    const product = await prisma.product.update({
      where: { id: req.params.id as string },
      data: {
        ...data,
        categoryId: data.categoryId === undefined ? undefined : (data.categoryId ?? null),
      },
      include: { category: { select: { id: true, name: true, type: true } } },
    });
    res.json(product);
  } catch (e) { next(e); }
});

// DELETE /api/products/:id - Delete product (soft delete)
productsRoutes.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.product.findFirst({
      where: {
        id,
        organizationId: req.organizationId,
        deletedAt: null,
      },
    });
    if (!existing) return res.status(404).json({ error: 'Produit introuvable' });

    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    res.json({ success: true });
  } catch (e) { next(e); }
});
