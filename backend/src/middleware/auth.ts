import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';

export interface AuthRequest extends Request {
  userId?: string;
  organizationId?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId: string;
  };
}

const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    req.userId = decoded.userId;
    
    // Fetch user to get organizationId and full user data
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, role: true, organizationId: true }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur introuvable' });
    }
    
    req.organizationId = user.organizationId;
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
};

/** Auth optionnelle : enrichit la requête si le JWT est valide, sinon continue sans utilisateur. */
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, role: true, organizationId: true },
    });
    if (!user) return next();
    req.userId = user.id;
    req.organizationId = user.organizationId;
    req.user = user;
  } catch {
    // Jeton expiré ou invalide : route publique, on ignore.
  }
  next();
};

// Middleware to check if user is SUPERADMIN
export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'SUPERADMIN') {
    return res.status(403).json({ error: 'Accès réservé aux superadmins' });
  }
  next();
};

// Middleware to check if user has permission to access a page
export const requirePage = (page: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // OWNER has access to everything
    if (req.user.role === 'OWNER') {
      return next();
    }

    // Check user permissions
    const permission = await prisma.userPermission.findFirst({
      where: {
        userId: req.user.id,
        organizationId: req.organizationId,
        page,
      },
    });

    if (!permission || !permission.canView) {
      return res.status(403).json({ error: 'Accès non autorisé à cette page' });
    }

    next();
  };
};

// Middleware to check if organization payment is approved
export const requirePaymentApproved = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  // SUPERADMIN bypasses payment check
  if (req.user.role === 'SUPERADMIN') {
    return next();
  }

  // Check organization payment status
  const organization = await prisma.organization.findUnique({
    where: { id: req.organizationId },
    select: { paymentStatus: true },
  });

  if (!organization) {
    return res.status(404).json({ error: 'Organisation introuvable' });
  }

  if (organization.paymentStatus !== 'APPROVED') {
    return res.status(403).json({ 
      error: 'Accès en attente de validation du paiement',
      paymentStatus: organization.paymentStatus 
    });
  }

  next();
};

export default auth;
