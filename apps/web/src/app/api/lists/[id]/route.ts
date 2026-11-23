import { z } from 'zod';
import { can } from '@scoutra/auth';
import { AppError } from '@scoutra/core';
import { eq, schema, withTenant } from '@scoutra/db';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Suppression d'une liste (les prospects restent) : son auteur ou un chef d'équipe. */
export const DELETE = apiRoute(
  { action: 'prospect:write', params: z.object({ id: z.uuid() }) },
  async ({ params, ctx }) => {
    const db = await appDb();
    await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
      const [l] = await tx
        .select()
        .from(schema.prospectLists)
        .where(eq(schema.prospectLists.id, params.id));
      if (!l) throw new AppError('not_found');
      if (l.createdBy !== ctx.user.id && !can(ctx.role, 'prospect:assign'))
        throw new AppError('forbidden');
      await tx.delete(schema.prospectLists).where(eq(schema.prospectLists.id, l.id));
    });
    return json({ deleted: true });
  },
);
