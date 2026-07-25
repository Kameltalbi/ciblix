import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth.js';
import { requireActiveMission } from './requireMission.js';

/** Autorise la lecture ; exige une Mission ACTIVE pour POST/PUT/PATCH/DELETE. */
export function requireMissionForMutations(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  void requireActiveMission(req, res, next);
}
