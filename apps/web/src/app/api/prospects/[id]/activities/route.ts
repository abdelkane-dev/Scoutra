import { z } from 'zod';
import { AppError } from '@scoutra/core';
import { memberNames } from '@scoutra/crm';
import { and, desc, eq, schema, withTenant } from '@scoutra/db';
import { actorOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Historique d'un prospect (étapes, attribution, notes, statuts de messages, réponses…). */
export const GET = apiRoute(
  { action: 'prospect:read', params: z.object({ id: z.uuid() }) },
  async ({ params, ctx }) => {
    const actor = actorOf(ctx);
    const db = await appDb();
    const out = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
      const [p] = await tx
        .select({ id: schema.prospects.id })
        .from(schema.prospects)
        .where(
          and(
            eq(schema.prospects.id, params.id),
            actor.ownerOnly ? eq(schema.prospects.ownerUserId, actor.ownerOnly) : undefined,
          ),
        );
      if (!p) throw new AppError('not_found');
      const names = await memberNames(tx);
      const rows = await tx
        .select()
        .from(schema.prospectActivities)
        .where(eq(schema.prospectActivities.prospectId, p.id))
        .orderBy(desc(schema.prospectActivities.id))
        .limit(200);
      return rows.map((r) => ({
        id: r.id,
        type: r.type,
        payload: r.payload,
        actorUserId: r.actorUserId,
        actorName: r.actorUserId ? (names.get(r.actorUserId)?.name ?? null) : null,
        at: r.createdAt,
      }));
    });
    return json({ items: out });
  },
);
