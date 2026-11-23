import { sequenceInputSchema } from '@scoutra/crm';
import { desc, schema, sql, withTenant } from '@scoutra/db';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Séquences avec statistiques (inscrits, actifs, ayant répondu). */
export const GET = apiRoute({ action: 'sequence:read' }, async ({ ctx }) => {
  const db = await appDb();
  const items = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
    const seqs = await tx.select().from(schema.sequences).orderBy(desc(schema.sequences.createdAt));
    const stats = await tx
      .select({
        id: schema.sequenceEnrollments.sequenceId,
        enrolled: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${schema.sequenceEnrollments.status} = 'active')::int`,
        replied: sql<number>`count(*) filter (where ${schema.sequenceEnrollments.status} = 'replied')::int`,
      })
      .from(schema.sequenceEnrollments)
      .groupBy(schema.sequenceEnrollments.sequenceId);
    return seqs.map((s) => {
      const st = stats.find((x) => x.id === s.id);
      const enrolled = st?.enrolled ?? 0;
      return {
        id: s.id,
        name: s.name,
        status: s.status,
        steps: s.steps,
        enrolled,
        active: st?.active ?? 0,
        replyRate: enrolled ? (st?.replied ?? 0) / enrolled : 0,
        createdBy: s.createdBy,
        createdAt: s.createdAt,
      };
    });
  });
  return json({ items });
});

export const POST = apiRoute(
  { action: 'sequence:manage', body: sequenceInputSchema },
  async ({ body, ctx }) => {
    const db = await appDb();
    const [s] = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      tx
        .insert(schema.sequences)
        .values({
          organizationId: ctx.orgId,
          name: body.name,
          status: body.status,
          steps: body.steps,
          createdBy: ctx.user.id,
        })
        .returning(),
    );
    return json({ id: s!.id, name: s!.name, status: s!.status, steps: s!.steps }, { status: 201 });
  },
);
