import type { NextFunction, Response } from 'express';
import { prisma } from '../db/prisma.js';
import type { AuthRequest } from './auth.js';
import { isMissionActive } from '../services/agent-team/missionConstants.js';

/**
 * Bloque les actions agents tant que la Mission IA n’est pas ACTIVE.
 * L’UI reste consultable ; seuls les endpoints d’exécution sont refusés.
 */
export async function requireActiveMission(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const organizationId = req.organizationId;
    if (!organizationId) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }
    const profile = await prisma.orgTargetingProfile.findUnique({
      where: { organizationId },
      select: { missionStatus: true, missionCompletedAt: true },
    });
    if (!isMissionActive(profile)) {
      res.status(403).json({
        error: 'MISSION_REQUIRED',
        code: 'MISSION_REQUIRED',
        message:
          'Votre équipe IA attend sa Mission. Complétez la Mission IA pour démarrer la détection d’opportunités.',
      });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
