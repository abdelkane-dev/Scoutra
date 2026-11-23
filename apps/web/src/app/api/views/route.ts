import { z } from 'zod';
import { desc, eq, or, schema, withTenant } from '@scoutra/db';
import { viewFiltersSchema } from '@scoutra/crm';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Vues enregistrées : les miennes et celles partagées avec l'équipe. */
export const GET = apiRoute({ action: 'prospect:read' }, async ({ ctx }) => {
  const db = await appDb();
  const items = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
    tx
      .select()
      .from(schema.savedViews)
      .where(or(eq(schema.savedViews.userId, ctx.user.id), eq(schema.savedViews.shared, true)))
      .orderBy(desc(schema.savedViews.createdAt)),
  );
  return json({
    items: items.map((v) => ({
      id: v.id,
      name: v.name,
      filters: v.filters,
      shared: v.shared,
      mine: v.userId === ctx.user.id,
    })),
  });
});

export const POST = apiRoute(
  {
    action: 'prospect:read',
    body: z
      .object({
        name: z.string().trim().min(1).max(120),
        filters: viewFiltersSchema,
        shared: z.boolean().default(false),
      })
      .strict(),
  },
  async ({ body, ctx }) => {
    const db = await appDb();
    const [v] = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      tx
        .insert(schema.savedViews)
        .values({
          organizationId: ctx.orgId,
          userId: ctx.user.id,
          name: body.name,
          filters: body.filters,
          shared: body.shared,
        })
        .returning(),
    );
    return json(
      { id: v!.id, name: v!.name, filters: v!.filters, shared: v!.shared, mine: true },
      { status: 201 },
    );
  },
);
