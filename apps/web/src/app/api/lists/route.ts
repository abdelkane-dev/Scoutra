import { z } from 'zod';
import { AppError } from '@scoutra/core';
import { asc, count, eq, schema, withTenant } from '@scoutra/db';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Listes de prospects de l'organisation, avec effectif. */
export const GET = apiRoute({ action: 'prospect:read' }, async ({ ctx }) => {
  const db = await appDb();
  const items = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
    tx
      .select({
        id: schema.prospectLists.id,
        name: schema.prospectLists.name,
        createdBy: schema.prospectLists.createdBy,
        createdAt: schema.prospectLists.createdAt,
        size: count(schema.prospectListItems.id),
      })
      .from(schema.prospectLists)
      .leftJoin(
        schema.prospectListItems,
        eq(schema.prospectListItems.listId, schema.prospectLists.id),
      )
      .groupBy(schema.prospectLists.id)
      .orderBy(asc(schema.prospectLists.name)),
  );
  return json({ items });
});

export const POST = apiRoute(
  {
    action: 'prospect:write',
    body: z.object({ name: z.string().trim().min(1).max(120) }).strict(),
  },
  async ({ body, ctx }) => {
    const db = await appDb();
    const row = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
      const [r] = await tx
        .insert(schema.prospectLists)
        .values({ organizationId: ctx.orgId, name: body.name, createdBy: ctx.user.id })
        .onConflictDoNothing()
        .returning();
      if (!r) throw new AppError('conflict', 'nom déjà utilisé');
      return r;
    });
    return json({ id: row.id, name: row.name, size: 0, createdAt: row.createdAt }, { status: 201 });
  },
);
