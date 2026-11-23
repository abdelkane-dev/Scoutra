import { z } from 'zod';
import { AppError } from '@scoutra/core';
import { savedFiltersSchema } from '@scoutra/crm';
import { and, eq, schema, withTenant } from '@scoutra/db';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

const body = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    filters: savedFiltersSchema.optional(),
    alert: z.boolean().optional(),
    /** Marque les résultats comme vus (remet `fresh` à 0). */
    markSeen: z.literal(true).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'au moins un champ');

const mine = (id: string, userId: string) =>
  and(eq(schema.savedSearches.id, id), eq(schema.savedSearches.userId, userId));

export const PATCH = apiRoute(
  { action: 'prospect:read', params: z.object({ id: z.uuid() }), body },
  async ({ params, body, ctx }) => {
    const { markSeen, ...rest } = body;
    const db = await appDb();
    const [s] = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      tx
        .update(schema.savedSearches)
        .set({ ...rest, ...(markSeen ? { lastSeenAt: new Date() } : {}) })
        .where(mine(params.id, ctx.user.id))
        .returning(),
    );
    if (!s) throw new AppError('not_found');
    return json({
      id: s.id,
      name: s.name,
      filters: s.filters,
      alert: s.alert,
      lastSeenAt: s.lastSeenAt,
    });
  },
);

export const DELETE = apiRoute(
  { action: 'prospect:read', params: z.object({ id: z.uuid() }) },
  async ({ params, ctx }) => {
    const db = await appDb();
    const rows = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      tx
        .delete(schema.savedSearches)
        .where(mine(params.id, ctx.user.id))
        .returning({ id: schema.savedSearches.id }),
    );
    if (!rows.length) throw new AppError('not_found');
    return json({ deleted: true });
  },
);
