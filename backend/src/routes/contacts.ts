import { Router, type NextFunction, type Response } from 'express';
import auth, { AuthRequest } from '../middleware/auth.js';
import { getContactById, listContacts } from '../services/agent-memory/contactService.js';
import { listEventsForContact } from '../services/agent-memory/agentEventService.js';

export const contactsRoutes = Router();

contactsRoutes.use(auth);

contactsRoutes.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const take = Math.min(Number(req.query.limit) || 30, 100);
    const skip = Math.max(Number(req.query.offset) || 0, 0);
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const result = await listContacts(req.organizationId!, { take, skip, search });
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

contactsRoutes.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contactId = String(req.params.id);
    const contact = await getContactById(req.organizationId!, contactId);
    if (!contact) return res.status(404).json({ error: 'Contact introuvable' });
    res.json({ contact });
  } catch (err) {
    next(err);
  }
});
