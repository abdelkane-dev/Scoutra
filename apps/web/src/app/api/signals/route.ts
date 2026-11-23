import { z } from 'zod';
import { SIGNAL_KEYS } from '@scoutra/core';
import { listSignals } from '@scoutra/crm';
import { withTenant } from '@scoutra/db';
import { actorOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';
import { parseQuery } from '@/server/query';

export const dynamic = 'force-dynamic';

const query = z
  .object({
    types: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(',') : undefined))
      .pipe(z.array(z.enum(SIGNAL_KEYS)).max(15).optional()),
    days: z.coerce.number().int().min(1).max(365).default(30),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();

/** Signaux d'achat réellement collectés (preuves avec source, URL, date) sur les prospects visibles. */
export const GET = apiRoute({ action: 'signal:read' }, async ({ req, ctx }) => {
  const q = parseQuery(req, query);
  const db = await appDb();
  const items = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
    listSignals(tx, actorOf(ctx), q),
  );
  return json({ items });
});
