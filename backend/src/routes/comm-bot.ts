import { Router } from 'express';

/** @deprecated CommBot remplacé par BrandPulse AI — utiliser /api/brand-pulse */
export const commBotRoutes = Router();

commBotRoutes.all('*', (_req, res) => {
  res.status(410).json({
    error: 'CommBot a été remplacé par BrandPulse AI',
    migrateTo: '/api/brand-pulse',
    agentSlug: 'brand-pulse-ai',
  });
});
