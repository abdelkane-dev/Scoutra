import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { z } from 'zod';
import { AppError, isAppError } from '@scoutra/core';
import { LOCALE_COOKIE, negotiateLocale, t, type MessageKey } from '@scoutra/i18n';
import { getEnv } from './env';

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

/**
 * Enveloppe commune des Route Handlers : validation Zod du corps et des paramètres,
 * contrôle d'origine sur les mutations, erreurs traduites sans fuite d'information.
 * L'autorisation se fait DANS le gestionnaire via requireOrgAccess(action).
 */
export function apiRoute<
  B extends z.ZodType = z.ZodUndefined,
  P extends z.ZodType = z.ZodUndefined,
>(
  opts: { body?: B; params?: P },
  handler: (input: { req: NextRequest; body: z.infer<B>; params: z.infer<P> }) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: RouteCtx): Promise<Response> => {
    try {
      const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
      if (mutation) assertSameOrigin(req);
      const body = opts.body ? validate(opts.body, await readJson(req)) : undefined;
      const params = opts.params ? validate(opts.params, await ctx.params) : undefined;
      return await handler({ req, body: body as z.infer<B>, params: params as z.infer<P> });
    } catch (err) {
      return errorResponse(req, err);
    }
  };
}

export { AppError };
