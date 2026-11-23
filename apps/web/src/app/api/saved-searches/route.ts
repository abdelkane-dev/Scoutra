import { z } from 'zod';
import { countMatches, savedFiltersSchema } from '@scoutra/crm';
import { desc, eq, schema, withTenant } from '@scoutra/db';
import { actorOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/**
 * Mes recherches enregistrées : critères sur les prospects livrés et/ou types de signaux.
 * `results` : correspondances actuelles ; `fresh` : nouvelles depuis ma dernière consultation
 * (alerte si `alert`).
 */
export const GET = apiRoute({ action: 'prospect:read' }, async ({ ctx }) => {
  const actor = actorOf(ctx);
  const db = await appDb();
  const items = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
    const rows = await tx
      .select()
      .from(schema.savedSearches)
      .where(eq(schema.savedSearches.userId, ctx.user.id))
      .orderBy(desc(schema.savedSearches.createdAt));
    const out = [];
    for (const s of rows) {
      const f = savedFiltersSchema.parse(s.filters);
      out.push({
        id: s.id,
        name: s.name,
        filters: f,
        alert: s.alert,
        results: await countMatches(tx, actor, f),
        fresh: await countMatches(tx, actor, f, s.lastSeenAt),
        lastSeenAt: s.lastSeenAt,
        createdAt: s.createdAt,
      });
    }
    return out;
  });
  return json({ items });
});

export const POST = apiRoute(
  {
    action: 'prospect:read',
    body: z
      .object({
        name: z.string().trim().min(1).max(120),
        filters: savedFiltersSchema,
        alert: z.boolean().default(false),
      })
      .strict(),
  },
  async ({ body, ctx }) => {
    const db = await appDb();
    const [s] = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      tx
        .insert(schema.savedSearches)
        .values({ organizationId: ctx.orgId, userId: ctx.user.id, ...body })
        .returning(),
    );
    return json(
      { id: s!.id, name: s!.name, filters: s!.filters, alert: s!.alert },
      { status: 201 },
    );
  },
);
