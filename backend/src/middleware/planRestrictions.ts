import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';

export type PlanType = 'FREE' | 'BASIC' | 'BUSINESS' | 'ENTERPRISE';

export const PLAN_LIMITS = {
  FREE: {
    maxProspects: 20,
    maxUsers: 1,
    features: {
      objectives: false,
      expenses: false,
      ai: false,
      commissions: false,
      advancedAutomations: false,
      softfacture: false,
    },
  },
  BASIC: {
    maxProspects: Infinity,
    maxUsers: 5,
    features: {
      objectives: true,
      expenses: false,
      ai: false,
      commissions: false,
      advancedAutomations: false,
      softfacture: false,
    },
  },
  BUSINESS: {
    maxProspects: Infinity,
    maxUsers: 20,
    features: {
      objectives: true,
      expenses: false,
      ai: false,
      commissions: false,
      advancedAutomations: false,
      softfacture: false,
    },
  },
  ENTERPRISE: {
    maxProspects: Infinity,
    maxUsers: 50,
    features: {
      objectives: true,
      expenses: true,
      ai: true,
      commissions: true,
      advancedAutomations: true,
      softfacture: true,
    },
  },
};

export interface AuthRequest extends Request {
  organizationId?: string;
  userId?: string;
  role?: string;
}

export function checkPlanFeature(feature: keyof typeof PLAN_LIMITS.FREE.features) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const organization = await prisma.organization.findUnique({
        where: { id: req.organizationId },
        select: { plan: true },
      });

      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const rawPlan = organization.plan as string;
      const plan = (PLAN_LIMITS as Record<string, unknown>)[rawPlan]
        ? (rawPlan as PlanType)
        : ('FREE' as PlanType);
      const hasFeature = PLAN_LIMITS[plan].features[feature];

      if (!hasFeature) {
        return res.status(403).json({
          error: 'Feature not available in your plan',
          feature,
          currentPlan: plan,
          requiredPlan:
            feature === 'expenses' || feature === 'ai' || feature === 'commissions' ? 'ENTERPRISE' : 'BASIC',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function checkProspectLimit(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: req.organizationId },
      select: { plan: true },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const rawPlan = organization.plan as string;
    const plan = (PLAN_LIMITS as Record<string, unknown>)[rawPlan]
      ? (rawPlan as PlanType)
      : ('FREE' as PlanType);
    const maxProspects = PLAN_LIMITS[plan].maxProspects;

    if (maxProspects === Infinity) {
      return next();
    }

    const currentProspects = await prisma.lead.count({
      where: { organizationId: req.organizationId },
    });

    if (currentProspects >= maxProspects) {
      return res.status(403).json({ 
        error: 'Prospect limit reached',
        current: currentProspects,
        max: maxProspects,
        plan,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}

export async function checkUserLimit(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: req.organizationId },
      select: { plan: true },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const rawPlan = organization.plan as string;
    const plan = (PLAN_LIMITS as Record<string, unknown>)[rawPlan]
      ? (rawPlan as PlanType)
      : ('FREE' as PlanType);
    const maxUsers = PLAN_LIMITS[plan].maxUsers;

    if (maxUsers === Infinity) {
      return next();
    }

    const currentUsers = await prisma.user.count({
      where: { organizationId: req.organizationId },
    });

    if (currentUsers >= maxUsers) {
      return res.status(403).json({ 
        error: 'User limit reached',
        current: currentUsers,
        max: maxUsers,
        plan,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}
