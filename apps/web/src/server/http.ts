import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { z } from 'zod';
import { AppError, SlidingWindowLimiter, isAppError } from '@scoutra/core';
import type { Action } from '@scoutra/auth';
import { LOCALE_COOKIE, negotiateLocale, t, type MessageKey } from '@scoutra/i18n';
import { getEnv } from './env';
import { requireOrgAccess, type OrgContext } from './session';

const MAX_BODY_BYTES = 64 * 1024;
const NO_STORE = { 'cache-control': 'no-store' };

export function json(data: unknown, init: { status?: number } = {}) {
  return NextResponse.json(data, { status: init.status ?? 200, headers: NO_STORE });
}

function errorResponse(req: NextRequest, err: unknown) {
  const locale = negotiateLocale(
    req.headers.get('accept-language'),
    req.cookies.get(LOCALE_COOKIE)?.value,
  );
  if (isAppError(err)) {
    const known = err.message === 'no_active_organization' ? 'no_active_organization' : err.code;
    const body: Record<string, unknown> = {
      code: known,
      message: t(locale, `errors.${known}` as MessageKey),
    };
    if (err.code === 'invalid_input' && err.details) body.issues = err.details;
    return NextResponse.json({ error: body }, { status: err.status, headers: NO_STORE });
  }
  // Erreur inattendue : rien de technique vers le client, message court dans les journaux.
  console.error('[api] erreur interne :', err instanceof Error ? err.message : 'inconnue');
  return NextResponse.json(
    { error: { code: 'internal', message: t(locale, 'errors.internal') } },
    { status: 500, headers: NO_STORE },
  );
}

/** Mutation : l'origine doit être l'application elle-même (défense CSRF en plus de SameSite). */
function assertSameOrigin(req: NextRequest) {
  const env = getEnv();
  const allowed = new Set(
    [env.BETTER_AUTH_URL, ...(env.SCOUTRA_TRUSTED_ORIGINS?.split(',') ?? [])].map((o) => {
      try {
        return new URL(o.trim()).origin;
      } catch {
        return '';
      }
    }),
  );
  const origin = req.headers.get('origin');
  if (!origin || !allowed.has(origin)) throw new AppError('forbidden', 'origine refusée');
}

async function readJson(req: NextRequest): Promise<unknown> {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new AppError('invalid_input', 'JSON attendu');
  }
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) throw new AppError('invalid_input', 'corps trop volumineux');
  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES)
    throw new AppError('invalid_input', 'corps trop volumineux');
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError('invalid_input', 'JSON invalide');
  }
}

function validate<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw new AppError(
      'invalid_input',
      'validation',
      r.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code })),
    );
  }
  return r.data;
}

type RouteCtx = { params: Promise<Record<string, string | string[]>> };

/** Limite par défaut des routes métier : par organisation ET par route. */
const DEFAULT_ORG_LIMIT = { max: 120, windowMs: 60_000 };
const limiters = new Map<string, SlidingWindowLimiter>();
function limiterFor(key: string, cfg: { max: number; windowMs: number }) {
  let l = limiters.get(key);
  if (!l) limiters.set(key, (l = new SlidingWindowLimiter(cfg.max, cfg.windowMs)));
  return l;
}

type Common<B extends z.ZodType, P extends z.ZodType> = { body?: B; params?: P };
/** Route métier : action OBLIGATOIRE, contrôlée par requireOrgAccess avant le gestionnaire. */
type ProtectedOpts<B extends z.ZodType, P extends z.ZodType> = Common<B, P> & {
  action: Action;
  public?: never;
  /** Limite de débit par organisation pour cette route. */
  rateLimit?: { max: number; windowMs: number };
};
/** Route publique : doit être déclarée EXPLICITEMENT (`public: true`). */
type PublicOpts<B extends z.ZodType, P extends z.ZodType> = Common<B, P> & {
  public: true;
  action?: never;
};

type Input<B extends z.ZodType, P extends z.ZodType, C> = {
  req: NextRequest;
  body: z.infer<B>;
  params: z.infer<P>;
  ctx: C;
};
type Handler = (req: NextRequest, ctx: RouteCtx) => Promise<Response>;

/**
 * Enveloppe commune des Route Handlers (refus par défaut) :
 * - `action` obligatoire (contrôle d'accès centralisé + limite par organisation), sauf route
 *   déclarée `public: true` ;
 * - validation Zod du corps et des paramètres, contrôle d'origine sur les mutations ;
 * - erreurs traduites sans fuite d'information.
 */
export function apiRoute<
  B extends z.ZodType = z.ZodUndefined,
  P extends z.ZodType = z.ZodUndefined,
>(
  opts: ProtectedOpts<B, P>,
  handler: (input: Input<B, P, OrgContext>) => Promise<Response>,
): Handler;
export function apiRoute<
  B extends z.ZodType = z.ZodUndefined,
  P extends z.ZodType = z.ZodUndefined,
>(opts: PublicOpts<B, P>, handler: (input: Input<B, P, null>) => Promise<Response>): Handler;
export function apiRoute<B extends z.ZodType, P extends z.ZodType>(
  opts: ProtectedOpts<B, P> | PublicOpts<B, P>,
  // `never` : compatible avec les deux surcharges (contravariance) ; le contexte réel est
  // OrgContext si `action`, null si `public`.
  handler: (input: Input<B, P, never>) => Promise<Response>,
): Handler {
  const run = handler as (input: Input<B, P, OrgContext | null>) => Promise<Response>;
  const action = 'action' in opts ? opts.action : undefined;
  if (!action && opts.public !== true) {
    throw new Error('apiRoute : préciser `action` ou `public: true`');
  }
  const limit = 'rateLimit' in opts && opts.rateLimit ? opts.rateLimit : DEFAULT_ORG_LIMIT;

  return async (req, rctx) => {
    try {
      const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
      if (mutation) assertSameOrigin(req);
      let ctx: OrgContext | null = null;
      if (action) {
        ctx = await requireOrgAccess(action);
        const routeKey = `${req.method} ${req.nextUrl.pathname.replace(/[0-9a-f-]{36}/gi, ':id')}`;
        if (!limiterFor(routeKey, limit).take(ctx.orgId)) throw new AppError('rate_limited');
      }
      const body = opts.body ? validate(opts.body, await readJson(req)) : undefined;
      const params = opts.params ? validate(opts.params, await rctx.params) : undefined;
      return await run({ req, body: body as z.infer<B>, params: params as z.infer<P>, ctx });
    } catch (err) {
      return errorResponse(req, err);
    }
  };
}

export { AppError };
