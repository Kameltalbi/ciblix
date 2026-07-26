import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { setTenantRlsContext } from '../services/referentiel/tenantIsolation.js';

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

async function loadUserWithOrg(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      organizationId: true,
      organization: { select: { suspended: true } },
    },
  });
}

function isOrgSuspended(
  user: { role: string; organization?: { suspended: boolean } | null }
): boolean {
  if (user.role === 'SUPERADMIN') return false;
  return Boolean(user.organization?.suspended);
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

    const user = await loadUserWithOrg(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'Utilisateur introuvable' });
    }

    if (isOrgSuspended(user)) {
      return res.status(403).json({
        error: 'Organisation suspendue. Contactez le support.',
        code: 'ORGANIZATION_SUSPENDED',
      });
    }

    req.organizationId = user.organizationId;
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    };
    // Filet RLS Postgres — en plus du filtre organizationId applicatif
    void setTenantRlsContext(user.organizationId);
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
    const user = await loadUserWithOrg(decoded.userId);
    if (!user || isOrgSuspended(user)) return next();
    req.userId = user.id;
    req.organizationId = user.organizationId;
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    };
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

/** Ancien garde-fou paiement — désactivé : l’accès n’est plus bloqué par paymentStatus. */
export const requirePaymentApproved = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  next();
};

export default auth;
