import { z } from 'zod';
import { AppError } from '@scoutra/core';
import { and, eq, schema, withTenant } from '@scoutra/db';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Suppression d'une de MES vues. */
export const DELETE = apiRoute(
  { action: 'prospect:read', params: z.object({ id: z.uuid() }) },
  async ({ params, ctx }) => {
    const db = await appDb();
    const rows = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      tx
        .delete(schema.savedViews)
        .where(and(eq(schema.savedViews.id, params.id), eq(schema.savedViews.userId, ctx.user.id)))
        .returning({ id: schema.savedViews.id }),
    );
    if (!rows.length) throw new AppError('not_found');
    return json({ deleted: true });
  },
);
