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

/** Reprendre le contact → Rédacteur (PREPARE_OUTREACH). Pas d’édition de champs. */
contactsRoutes.post('/:id/reprendre', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contactId = String(req.params.id);
    const contact = await getContactById(req.organizationId!, contactId);
    if (!contact) return res.status(404).json({ error: 'Contact introuvable' });

    const { enqueueAgentTask } = await import('../services/agent-team/agentTaskService.js');
    await enqueueAgentTask({
      organizationId: req.organizationId!,
      assignee: 'COPILOT',
      kind: 'PREPARE_OUTREACH',
      priority: 85,
      contactId,
      dedupeKey: `outreach:reprendre:${contactId}:${Date.now()}`,
      payload: {
        contactId,
        companyName: contact.companyName || contact.name,
        triggeredBy: 'reprendre_contact',
      },
    });

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

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

contactsRoutes.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contactId = String(req.params.id);
    const contact = await getContactById(req.organizationId!, contactId);
    if (!contact) return res.status(404).json({ error: 'Contact introuvable' });

    const [events, pipeline, suggestions] = await Promise.all([
      listEventsForContact(req.organizationId!, contactId, { take: 50 }),
      getPipelineStatusExplanation(contactId, req.organizationId!),
      listSuggestionsForContact(req.organizationId!, contactId, 'PENDING'),
    ]);

    res.json({ contact, pipeline, events: events.items, suggestions });
  } catch (err) {
    next(err);
  }
});
