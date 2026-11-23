import { z } from 'zod';
import { and, eq, inArray, isNull, schema, withTenant } from '@scoutra/db';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Marque mes notifications comme lues (toutes, ou une liste). */
export const POST = apiRoute(
  { action: 'org:read', body: z.object({ ids: z.array(z.uuid()).max(200).optional() }).strict() },
  async ({ body, ctx }) => {
    const db = await appDb();
    const rows = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      tx
        .update(schema.notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(schema.notifications.userId, ctx.user.id),
            isNull(schema.notifications.readAt),
            body.ids ? inArray(schema.notifications.id, body.ids) : undefined,
          ),
        )
        .returning({ id: schema.notifications.id }),
    );
    return json({ updated: rows.length });
  },
);
