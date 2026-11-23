import { z } from 'zod';
import { AppError } from '@scoutra/core';
import { eq, schema, withTenant, writeAudit } from '@scoutra/db';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Retrait d'une opposition (admin, 2FA) : journalisé. */
export const DELETE = apiRoute(
  { action: 'compliance:manage', params: z.object({ id: z.uuid() }) },
  async ({ params, ctx }) => {
    const db = await appDb();
    await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
      const rows = await tx
        .delete(schema.suppressionList)
        .where(eq(schema.suppressionList.id, params.id))
        .returning();
      if (!rows.length) throw new AppError('not_found');
      await writeAudit(tx, {
        orgId: ctx.orgId,
        actorType: 'user',
        actorUserId: ctx.user.id,
        action: 'compliance.suppression_removed',
        targetType: 'suppression',
        targetId: params.id,
        metadata: { kind: rows[0]!.valueKind },
      });
    });
    return json({ deleted: true });
  },
);
