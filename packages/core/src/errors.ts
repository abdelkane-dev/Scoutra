/**
 * Erreurs applicatives typées. Le `code` est stable et traduisible côté interface ;
 * le `message` est destiné aux journaux (jamais de donnée personnelle ni de secret).
 */
export type AppErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid_input'
  | 'conflict'
  | 'rate_limited'
  | 'read_only'
  | 'blocked_url'
  | 'internal';

const STATUS: Record<AppErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_input: 400,
  conflict: 409,
  rate_limited: 429,
  read_only: 423,
  blocked_url: 400,
  internal: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: AppErrorCode, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
