import { Router, type NextFunction, type Response } from 'express';
import type { ContactCreatedVia, ContactPipelineStatus } from '@prisma/client';
import auth, { AuthRequest } from '../middleware/auth.js';
import { getContactById, listContacts } from '../services/agent-memory/contactService.js';
import { listEventsForContact } from '../services/agent-memory/agentEventService.js';
import { getPipelineStatusExplanation } from '../services/agent-memory/pipelineStatusService.js';
import { listContactSuggestionsHandler } from './suggestions.js';
import { listSuggestionsForContact } from '../services/suggestions/suggestionService.js';

export const contactsRoutes = Router();

contactsRoutes.use(auth);

const PIPELINE_STATUSES = new Set<ContactPipelineStatus>([
  'NOUVEAU',
  'CHAUD',
  'TIEDE',
  'A_RELANCER',
  'FROID',
  'ARCHIVE',
]);

const CREATED_VIA = new Set<ContactCreatedVia>([
  'HUNT',
  'COPILOT',
  'GMAIL',
  'SCOUT',
  'MANUAL_IMPORT',
]);

contactsRoutes.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const take = Math.min(Number(req.query.limit) || 30, 100);
    const skip = Math.max(Number(req.query.offset) || 0, 0);
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const statusRaw = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
    const status =
      statusRaw && PIPELINE_STATUSES.has(statusRaw as ContactPipelineStatus)
        ? (statusRaw as ContactPipelineStatus)
        : undefined;
    const viaRaw = typeof req.query.createdVia === 'string' ? req.query.createdVia.toUpperCase() : undefined;
    const createdVia =
      viaRaw && CREATED_VIA.has(viaRaw as ContactCreatedVia) ? (viaRaw as ContactCreatedVia) : undefined;
    const sort = req.query.sort === 'createdAt' ? 'createdAt' : 'pipelineStatusAt';
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';

    const result = await listContacts(req.organizationId!, {
      take,
      skip,
      search,
      status,
      createdVia,
      sort,
      sortDir,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Aujourd’hui — jusqu’à 5 fiches dont date_relance ≤ aujourd’hui (écrit par le Scribe). */
contactsRoutes.get('/today', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { listTodayContacts } = await import('../services/company-fiche/relanceResurface.js');
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const result = await listTodayContacts(req.organizationId!, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

contactsRoutes.get('/:id/events', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contactId = String(req.params.id);
    const contact = await getContactById(req.organizationId!, contactId);
    if (!contact) return res.status(404).json({ error: 'Contact introuvable' });

    const take = Math.min(Number(req.query.limit) || 50, 100);
    const skip = Math.max(Number(req.query.offset) || 0, 0);
    const result = await listEventsForContact(req.organizationId!, contactId, { take, skip });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

contactsRoutes.get('/:id/suggestions', listContactSuggestionsHandler);

/** Prépare / régénère le message → écrit message_brouillon sur la fiche (synchrone). */
contactsRoutes.post('/:id/reprendre', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contactId = String(req.params.id);
    const contact = await getContactById(req.organizationId!, contactId);
    if (!contact) return res.status(404).json({ error: 'Contact introuvable' });

    // Remettre dans le flux actif si archivée / perdue (sans édition de champs métier)
    if (contact.ficheEtat === 'ARCHIVEE' || contact.ficheEtat === 'PERDUE') {
      const { prisma } = await import('../db/prisma.js');
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          ficheEtat: 'CONTACTEE',
          ficheEtatAt: new Date(),
          ficheBlockReason: null,
        },
      });
    }

    const { handlePrepareOutreach } = await import('../services/agent-team/handlers.js');
    const { parseFicheData } = await import('../services/company-fiche/index.js');

    const syncTask = {
      id: `sync-reprendre-${contactId}`,
      organizationId: req.organizationId!,
      contactId,
      assignee: 'COPILOT' as const,
      kind: 'PREPARE_OUTREACH' as const,
      status: 'RUNNING' as const,
      priority: 85,
      attempts: 0,
      maxAttempts: 1,
      dedupeKey: `outreach:reprendre:${contactId}`,
      payload: {
        contactId,
        companyName: contact.companyName || contact.name,
        triggeredBy: 'reprendre_contact',
      },
      result: null,
      error: null,
      availableAt: new Date(),
      startedAt: new Date(),
      completedAt: null,
      parentTaskId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await handlePrepareOutreach(syncTask as unknown as import('@prisma/client').AgentTask);

    if (result.skipped) {
      return res.status(400).json({
        error: (result.message as string) || (result.reason as string) || 'Impossible de préparer le message',
        code: result.reason,
      });
    }

    const refreshed = await getContactById(req.organizationId!, contactId);
    const fiche = parseFicheData(refreshed?.ficheData);
    let message =
      fiche.message_brouillon?.trim() ||
      (typeof result.email === 'string' ? result.email : null);
    if (message && /\\[nrt]/.test(message)) {
      message = message
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\n')
        .replace(/\\t/g, '\t');
    }

    res.json({
      ok: true,
      message,
      approachAngle: result.approachAngle ?? null,
    });
  } catch (err) {
    next(err);
  }
});

/** Enregistre une édition manuelle du message (sans régénération IA). */
contactsRoutes.patch('/:id/message-brouillon', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contactId = String(req.params.id);
    const message = typeof req.body?.message === 'string' ? req.body.message : null;
    if (message == null) {
      return res.status(400).json({ error: 'message requis' });
    }
    const trimmed = normalizeMessageEscapes(message.trim());
    if (!trimmed) {
      return res.status(400).json({ error: 'Le message ne peut pas être vide' });
    }
    if (trimmed.length > 12000) {
      return res.status(400).json({ error: 'Message trop long' });
    }

    const contact = await getContactById(req.organizationId!, contactId);
    if (!contact) return res.status(404).json({ error: 'Contact introuvable' });

    const { persistAgentWrite, ficheEtatFromDb, parseFicheData } = await import(
      '../services/company-fiche/index.js'
    );

    const etat = ficheEtatFromDb(contact.ficheEtat) || 'decouverte';
    await persistAgentWrite({
      organizationId: req.organizationId!,
      contactId,
      agent: 'redacteur',
      patch: {
        message_brouillon: trimmed,
        message_canal: parseFicheData(contact.ficheData).message_canal || 'email',
      },
      etatCible: etat,
      raison: 'Message modifié manuellement',
      conditionSortieRemplie: true,
    });

    const refreshed = await getContactById(req.organizationId!, contactId);
    const fiche = parseFicheData(refreshed?.ficheData);
    res.json({ ok: true, message: fiche.message_brouillon?.trim() || trimmed });
  } catch (err) {
    next(err);
  }
});

function normalizeMessageEscapes(text: string): string {
  let t = text.trim();
  if (/\\[nrt]/.test(t)) {
    t = t
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t/g, '\t');
  }
  return t.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

contactsRoutes.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contactId = String(req.params.id);
    const contact = await getContactById(req.organizationId!, contactId);
    if (!contact) return res.status(404).json({ error: 'Contact introuvable' });

    const [events, pipeline, suggestions, intelligence] = await Promise.all([
      listEventsForContact(req.organizationId!, contactId, { take: 50 }),
      getPipelineStatusExplanation(contactId, req.organizationId!),
      listSuggestionsForContact(req.organizationId!, contactId, 'PENDING'),
      import('../services/company-fiche/dossierIntelligence.js').then(({ buildDossierIntelligence }) =>
        buildDossierIntelligence({
          organizationId: req.organizationId!,
          contactId,
          ficheData: contact.ficheData,
          email: contact.email,
          phone: contact.phone,
          referentiel: contact.entrepriseReferentiel
            ? {
                siteWeb: contact.entrepriseReferentiel.siteWeb,
                secteur: contact.entrepriseReferentiel.secteur,
                sources: null,
                scoreFraicheur: contact.entrepriseReferentiel.scoreFraicheur,
                scoreConfianceGlobal: contact.entrepriseReferentiel.scoreConfianceGlobal,
                dateDerniereVerification: contact.entrepriseReferentiel.dateDerniereVerification,
              }
            : null,
        })
      ),
    ]);

    res.json({ contact, pipeline, events: events.items, suggestions, intelligence });
  } catch (err) {
    next(err);
  }
});
