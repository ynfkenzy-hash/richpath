import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { BadRequest } from './errors.js';

export type RequestPart = 'body' | 'query' | 'params';

/**
 * Validates a request part against a Zod schema and replaces it with the
 * parsed value, so handlers only ever see typed, sanitised data.
 */
export function validate<T extends ZodTypeAny>(schema: T, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[part]);
      if (part === 'query') {
        // Express 4 exposes a getter-only `query`; copy parsed values onto it.
        Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true });
      } else {
        (req as any)[part] = parsed;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details: Record<string, string[]> = {};
        for (const issue of err.issues) {
          const key = issue.path.join('.') || '_';
          details[key] = [...(details[key] ?? []), issue.message];
        }
        next(BadRequest('validation_failed', 'Please check the highlighted fields', details));
      } else {
        next(err);
      }
    }
  };
}

/** Escape user text that will be embedded in SQL LIKE patterns. */
export const escapeLike = (s: string): string => s.replace(/[%_\\]/g, '\\$&');
