import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  console.error('❌ Error:', err);

  if (err instanceof ZodError) {
    const fieldErrors = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return res.status(400).json({
      error: `Validation échouée: ${fieldErrors}`,
      details: err.errors,
    });
  }

  if (err.message?.includes('Unique constraint')) {
    return res.status(409).json({ error: 'Conflit : entrée en double' });
  }

  const statusCode = (err as Error & { statusCode?: number }).statusCode;
  const code = (err as Error & { code?: string }).code;
  if (statusCode && statusCode >= 400 && statusCode < 600) {
    return res.status(statusCode).json({ error: err.message, code });
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Erreur serveur' : err.message,
  });
}
