import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import {
  getMinimumPlanForAgent,
  isAgentIncludedInPlan,
  normalizePlan,
  PLAN_AGENT_LABELS,
  type PlanType,
} from '../config/agentPlans.js';
import { isTrialAgentSlug } from '../config/trial.js';

export type { PlanType };

export async function resolveOrganizationPlan(organizationId: string): Promise<PlanType> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });
  return normalizePlan(organization?.plan);
}

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

      const plan = normalizePlan(organization.plan);
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

    const plan = normalizePlan(organization.plan);
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

    const plan = normalizePlan(organization.plan);
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

export function checkAgentAccess(agentSlug: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const plan = await resolveOrganizationPlan(req.organizationId);
      const billing = await prisma.billingSubscription.findUnique({
        where: { organizationId: req.organizationId },
        select: { status: true },
      });
      const trialAccess =
        billing?.status === 'TRIALING' && isTrialAgentSlug(agentSlug);

      if (!trialAccess && !isAgentIncludedInPlan(plan, agentSlug)) {
        const requiredPlan = getMinimumPlanForAgent(agentSlug) ?? 'ENTERPRISE';
        return res.status(403).json({
          error: 'Agent not available in your plan',
          agentSlug,
          currentPlan: plan,
          requiredPlan,
          requiredPlanLabel: PLAN_AGENT_LABELS[requiredPlan],
        });
      }

      const agentRow = await prisma.organizationAgent.findUnique({
        where: {
          organizationId_agentSlug: {
            organizationId: req.organizationId,
            agentSlug,
          },
        },
        select: { active: true },
      });

      // Pas de ligne = actif par défaut (inclus dans le plan). Ligne inactive = désactivé.
      if (agentRow && !agentRow.active) {
        return res.status(403).json({
          error: 'Agent deactivated for this organization',
          agentSlug,
          currentPlan: plan,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
