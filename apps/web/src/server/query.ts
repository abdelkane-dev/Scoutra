import 'server-only';
import type { NextRequest } from 'next/server';
import type { z } from 'zod';
import { AppError } from '@scoutra/core';

/** Paramètres d'URL validés par Zod (refus par défaut des valeurs inattendues). */
export function parseQuery<S extends z.ZodType>(req: NextRequest, schema: S): z.infer<S> {
  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  const r = schema.safeParse(raw);
  if (!r.success)
    throw new AppError(
      'invalid_input',
      'query',
      r.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code })),
    );
  return r.data;
}
