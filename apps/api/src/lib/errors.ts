export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const BadRequest = (code: string, msg: string, details?: Record<string, unknown>) =>
  new AppError(400, code, msg, details);
export const Unauthorized = (msg = 'You must sign in to continue') => new AppError(401, 'unauthenticated', msg);
export const Forbidden = (code: string, msg: string) => new AppError(403, code, msg);
export const NotFound = (msg = 'Not found') => new AppError(404, 'not_found', msg);
export const Conflict = (code: string, msg: string) => new AppError(409, code, msg);
export const TooMany = (msg = 'Too many requests, please slow down') => new AppError(429, 'rate_limited', msg);
