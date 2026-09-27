import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors.js';
import { config } from '../config.js';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'not_found', message: 'Endpoint not found' } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // Body-parser malformed JSON
  if (err instanceof SyntaxError && 'body' in (err as any)) {
    return res.status(400).json({ error: { code: 'invalid_json', message: 'Request body is not valid JSON' } });
  }

  // eslint-disable-next-line no-console
  console.error('[error]', req.method, req.originalUrl, err);
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Something went wrong on our side. Please try again.',
      ...(config.isProd ? {} : { dev: (err as Error)?.message }),
    },
  });
}
