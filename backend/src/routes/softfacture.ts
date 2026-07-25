import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import auth, { AuthRequest } from '../middleware/auth.js';
import { softfactureClient } from '../services/softfacture.js';

export const softfactureRoutes = Router();
softfactureRoutes.use(auth);

softfactureRoutes.get('/status', async (_req: AuthRequest, res, next) => {
  try {
    res.json(softfactureClient.status());
  } catch (e) {
    next(e);
  }
});

// ─── Créer un DEVIS dans Softfacture à partir d'une affaire ─────
softfactureRoutes.post('/devis/:affaireId', async (req: AuthRequest, res, next) => {
  try {
    const affaireId = req.params.affaireId as string;
    const affaire = await prisma.affaire.findFirst({
      where: {
        id: affaireId,
        organizationId: req.organizationId,
        deletedAt: null,
      },
      include: { client: true },
    });
    if (!affaire) return res.status(404).json({ error: 'Affaire introuvable' });
    if (affaire.devisId) {
      return res.status(400).json({ error: 'Devis déjà créé', devisId: affaire.devisId });
    }

    const result = await softfactureClient.creerDevis({
      clientNom:    affaire.client.name,
      clientEmail:  affaire.client.email,
      clientMatricule: affaire.client.matricule,
      designation:  affaire.title || '',
      montantHT:    Number(affaire.montantHT),
      tvaPct:       19,
      type:         affaire.type,
    });

    const updated = await prisma.affaire.update({
      where: { id: affaire.id },
      data: {
        devisId:     result.id,
        devisNumero: result.numero,
        devisPdfUrl: result.pdfUrl,
      },
    });
    await prisma.activite.create({
      data: {
        organizationId: affaire.organizationId,
        affaireId: affaire.id,
        type:      'DEVIS_CREE',
        title:     `Devis ${result.numero} créé`,
        content:   `Montant HT: ${affaire.montantHT} DT`,
      },
    });
    res.json({ affaire: updated, devis: result });
  } catch (e) { next(e); }
});

// ─── Créer une FACTURE dans Softfacture ─────────────────────────
softfactureRoutes.post('/facture/:affaireId', async (req: AuthRequest, res, next) => {
  try {
    const affaireId = req.params.affaireId as string;
    const affaire = await prisma.affaire.findFirst({
      where: {
        id: affaireId,
        organizationId: req.organizationId,
        deletedAt: null,
      },
      include: { client: true },
    });
    if (!affaire) return res.status(404).json({ error: 'Affaire introuvable' });
    if (affaire.factureId) {
      return res.status(400).json({ error: 'Facture déjà créée', factureId: affaire.factureId });
    }

    const result = await softfactureClient.creerFacture({
      clientNom:       affaire.client.name,
      clientEmail:     affaire.client.email,
      clientMatricule: affaire.client.matricule,
      designation:     affaire.title || '',
      montantHT:       Number(affaire.montantHT),
      tvaPct:          19,
      type:            affaire.type,
      devisId:         affaire.devisId || undefined,
    });

    const updated = await prisma.affaire.update({
      where: { id: affaire.id },
      data: {
        factureId:     result.id,
        factureNumero: result.numero,
        facturePdfUrl: result.pdfUrl,
        statut:        affaire.statut === 'GAGNE' ? 'GAGNE' : affaire.statut,
        dateClotureReelle: affaire.dateClotureReelle || new Date(),
      },
    });
    await prisma.activite.create({
      data: {
        organizationId: affaire.organizationId,
        affaireId: affaire.id,
        type:      'FACTURE_CREEE',
        title:     `Facture ${result.numero} créée`,
        content:   `Montant TTC: ${Math.round(Number(affaire.montantHT) * 1.19)} DT`,
      },
    });
    res.json({ affaire: updated, facture: result });
  } catch (e) { next(e); }
});

// ─── Récupérer le PDF d'un document Softfacture ─────────────────
softfactureRoutes.get('/pdf/:type/:id', async (req: AuthRequest, res, next) => {
  try {
    const type = req.params.type as string;
    const id = req.params.id as string;
    if (!['devis', 'facture'].includes(type))
      return res.status(400).json({ error: 'Type invalide' });
    const affaire = await prisma.affaire.findFirst({
      where: {
        organizationId: req.organizationId,
        deletedAt: null,
        ...(type === 'devis' ? { devisId: id } : { factureId: id }),
      },
      select: { id: true },
    });
    if (!affaire) return res.status(404).json({ error: 'Document introuvable' });

    const pdfBuffer = await softfactureClient.getPdf(type as 'devis' | 'facture', id);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (e) { next(e); }
});
