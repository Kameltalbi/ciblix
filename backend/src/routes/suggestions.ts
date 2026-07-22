import { Router, type NextFunction, type Response } from 'express';
import type { SuggestionStatus } from '@prisma/client';
import auth, { AuthRequest } from '../middleware/auth.js';
import { getContactById } from '../services/agent-memory/contactService.js';
import {
  acceptSuggestion,
  dismissSuggestion,
  listSuggestionsForContact,
} from '../services/suggestions/suggestionService.js';

export const suggestionsRoutes = Router();

suggestionsRoutes.use(auth);

const STATUSES = new Set<SuggestionStatus>(['PENDING', 'ACCEPTED', 'DISMISSED', 'EXPIRED']);

suggestionsRoutes.post('/:id/accept', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await acceptSuggestion(req.organizationId!, String(req.params.id));
    if (!result) return res.status(404).json({ error: 'Suggestion introuvable' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

suggestionsRoutes.post('/:id/dismiss', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const suggestion = await dismissSuggestion(req.organizationId!, String(req.params.id));
    if (!suggestion) return res.status(404).json({ error: 'Suggestion introuvable ou déjà traitée' });
    res.json({ suggestion });
  } catch (err) {
    next(err);
  }
});

/** Liste via contact — aussi exposée sur GET /contacts/:id/suggestions */
export async function listContactSuggestionsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const contactId = String(req.params.id);
    const contact = await getContactById(req.organizationId!, contactId);
    if (!contact) return res.status(404).json({ error: 'Contact introuvable' });

    const statusRaw = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : 'PENDING';
    const status =
      statusRaw && STATUSES.has(statusRaw as SuggestionStatus)
        ? (statusRaw as SuggestionStatus)
        : 'PENDING';

    const items = await listSuggestionsForContact(req.organizationId!, contactId, status);
    res.json({ items });
  } catch (err) {
    next(err);
  }
}
