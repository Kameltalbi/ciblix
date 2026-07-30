import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { runWithRlsContextAsync } from '../db/rlsContext.js';
import { withRlsBypass } from '../services/referentiel/tenantIsolation.js';

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

    const user = await withRlsBypass(() => loadUserWithOrg(decoded.userId));

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

    const ctx =
      user.role === 'SUPERADMIN'
        ? ({ type: 'bypass' } as const)
        : ({ type: 'tenant', organizationId: user.organizationId } as const);

    // ALS propage sur toute la chaîne async du handler Express
    return runWithRlsContextAsync(ctx, async () => {
      await new Promise<void>((resolve, reject) => {
        try {
          next();
          res.on('finish', () => resolve());
          res.on('close', () => resolve());
        } catch (e) {
          reject(e);
        }
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'TENANT_RLS_MISSING_ORG') {
      return res.status(500).json({ error: 'Isolation tenant indisponible' });
    }
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
    const user = await withRlsBypass(() => loadUserWithOrg(decoded.userId));
    if (!user || isOrgSuspended(user)) {
      return next();
    }
    req.userId = user.id;
    req.organizationId = user.organizationId;
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    };
    const ctx =
      user.role === 'SUPERADMIN'
        ? ({ type: 'bypass' } as const)
        : ({ type: 'tenant', organizationId: user.organizationId } as const);
    return runWithRlsContextAsync(ctx, async () => {
      await new Promise<void>((resolve) => {
        next();
        res.on('finish', () => resolve());
        res.on('close', () => resolve());
      });
    });
  } catch {
    /* ignore */
  }
  next();
};

export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'SUPERADMIN') {
    return res.status(403).json({ error: 'Accès réservé aux superadmins' });
  }
  next();
};

export const requirePage = (page: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    if (req.user.role === 'OWNER') {
      return next();
    }

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
