import { z } from 'zod';
import { AppError } from '@scoutra/core';
import { and, eq, isNull, schema, withTenant, writeAudit } from '@scoutra/db';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Révocation (la clé n'est plus utilisée ; la ligne reste pour l'historique). */
export const DELETE = apiRoute(
  { action: 'apikey:manage', params: z.object({ id: z.uuid() }) },
  async ({ params, ctx }) => {
    const db = await appDb();
    await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
      const rows = await tx
        .update(schema.apiCredentials)
        .set({ revokedAt: new Date() })
        .where(
          and(eq(schema.apiCredentials.id, params.id), isNull(schema.apiCredentials.revokedAt)),
        )
        .returning({ id: schema.apiCredentials.id, provider: schema.apiCredentials.provider });
      if (!rows.length) throw new AppError('not_found');
      await writeAudit(tx, {
        orgId: ctx.orgId,
        actorType: 'user',
        actorUserId: ctx.user.id,
        action: 'apikey.revoked',
        targetType: 'api_credential',
        targetId: params.id,
        metadata: { provider: rows[0]!.provider },
      });
    });
    return json({ revoked: true });
  },
);
