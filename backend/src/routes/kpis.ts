import { Router } from 'express';
import type { StatutAffaire } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import auth from '../middleware/auth.js';

export const kpisRoutes = Router();
kpisRoutes.use(auth);

// Algorithme de prévision intelligent
function calculateSmartForecast(
  realise: any[],
  pipeline: any[],
  prospect: any[],
  perdu: any[]
) {
  // Taux de conversion historique
  const totalOpportunities = realise.length + pipeline.length + prospect.length + perdu.length;
  const conversionRate = totalOpportunities > 0 ? (realise.length / totalOpportunities) : 0;
  const pipelineToRealiseRate = (realise.length + pipeline.length) > 0 ? (realise.length / (realise.length + pipeline.length)) : 0;
  const prospectToPipelineRate = (prospect.length + pipeline.length) > 0 ? (pipeline.length / (prospect.length + pipeline.length)) : 0;

  // Facteur de confiance basé sur la taille de l'échantillon
  const confidenceScore = Math.min(100, (totalOpportunities / 10) * 100);

  // Prévision pondérée avec taux de conversion réels
  const sum = (arr: any[]) => arr.reduce((s, a) => s + Number(a.montantHT), 0);
  
  const prospectValue = sum(prospect);
  const pipelineValue = sum(pipeline);
  const realiseValue = sum(realise);

  // Ajuster la prospection avec le taux de conversion historique
  const adjustedProspect = prospectValue * Math.max(0.3, prospectToPipelineRate * pipelineToRealiseRate);
  
  // Ajuster le pipeline avec le taux de conversion historique
  const adjustedPipeline = pipelineValue * Math.max(0.5, pipelineToRealiseRate);

  // Prévision totale ajustée
  const forecast = realiseValue + adjustedPipeline + adjustedProspect;

  // Écart type pour l'intervalle de confiance
  const variance = (forecast - realiseValue) * 0.2;
  const lowerBound = Math.max(0, forecast - variance);
  const upperBound = forecast + variance;

  return {
    forecast,
    lowerBound,
    upperBound,
    confidenceScore: Math.round(confidenceScore),
    conversionRates: {
      overall: Math.round(conversionRate * 100),
      prospectToPipeline: Math.round(prospectToPipelineRate * 100),
      pipelineToRealise: Math.round(pipelineToRealiseRate * 100),
    },
    breakdown: {
      realise: realiseValue,
      adjustedPipeline,
      adjustedProspect,
    },
  };
}

// GET /api/kpis
kpisRoutes.get('/', async (req: any, res, next) => {
  try {
    const { annee, mois } = req.query;
    
    const where: any = { organizationId: req.organizationId };
    
    if (annee) {
      where.anneePrevue = Number(annee);
    }
    
    if (mois && mois !== 'all') {
      where.moisPrevu = Number(mois);
    }
    
    const affaires = await prisma.affaire.findMany({
      where,
      select: {
        id: true,
        statut: true,
        montantHT: true,
        type: true,
        moisPrevu: true,
        probabilite: true,
        viaPartenaire: true,
        tauxCommission: true,
      },
    });

    type KpisAffRow = {
      id: string;
      statut: StatutAffaire;
      montantHT: unknown;
      type: string | null;
      moisPrevu: number;
      probabilite: number;
      viaPartenaire: boolean;
      tauxCommission: unknown;
    };
    const rows = affaires as KpisAffRow[];

    const realise  = rows.filter((a) => a.statut === 'GAGNE');
    const pipeline = rows.filter((a) => ['QUALIFIE', 'PROPOSITION', 'NEGOCIATION'].includes(a.statut));
    const prospect = rows.filter((a) => a.statut === 'PROSPECT');
    const perdu    = rows.filter((a) => a.statut === 'PERDU');

    const sum = (arr: KpisAffRow[]) =>
      arr.reduce((s: number, a: KpisAffRow) => s + Number(a.montantHT), 0);

    const caTotalAll = sum(rows.filter((a) => a.statut !== 'PERDU')); // All statuses except PERDU

    const commissionDue = realise
      .filter((a) => a.viaPartenaire)
      .reduce((s: number, a: KpisAffRow) => s + Number(a.montantHT) * (Number(a.tauxCommission) / 100), 0);

    const caRealise = sum(realise);
    const netRealise = caRealise - commissionDue;
    const netPondere = caRealise +
      pipeline.reduce((s: number, a: KpisAffRow) => s + Number(a.montantHT) * (a.probabilite / 100), 0);

    // Calculer la prévision intelligente
    const smartForecast = calculateSmartForecast(realise, pipeline, prospect, perdu);

    // Répartition par type (dynamique)
    const parType: Record<string, number> = {};
    for (const a of rows) {
      const t = a.type || 'Autre';
      parType[t] = (parType[t] || 0) + Number(a.montantHT);
    }

    // Distribution mensuelle
    const parMois: Record<number, { realise: number; pipeline: number; prospect: number }> = {};
    for (let m = 1; m <= 12; m++) parMois[m] = { realise: 0, pipeline: 0, prospect: 0 };
    for (const a of rows) {
      const k = a.statut === 'GAGNE' ? 'realise' :
                ['QUALIFIE', 'PROPOSITION', 'NEGOCIATION'].includes(a.statut) ? 'pipeline' :
                a.statut === 'PROSPECT' ? 'prospect' : null;
      if (k) parMois[a.moisPrevu][k] += Number(a.montantHT);
    }

    res.json({
      caRealise,
      caPipeline: sum(pipeline),
      caProspection: sum(prospect),
      caTotal: caRealise + sum(pipeline) + sum(prospect),
      caTotalAll, // All statuses including PERDU
      caPondere: netPondere,
      commissionPartenaireDue: commissionDue,
      netRealise,
      parType,
      counts: {
        gagne: realise.length,
        enCours: pipeline.length,
        prospect: prospect.length,
        perdu: perdu.length,
      },
      parMois,
      smartForecast,
    });
  } catch (e) { next(e); }
});
