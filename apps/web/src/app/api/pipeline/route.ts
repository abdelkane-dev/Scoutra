import { z } from 'zod';
import { listStages, memberNames } from '@scoutra/crm';
import { and, desc, eq, isNotNull, schema, sql, withTenant } from '@scoutra/db';
import { actorOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';
import { parseQuery } from '@/server/query';

export const dynamic = 'force-dynamic';

const query = z
  .object({
    ownerUserId: z.uuid().optional(),
    perStage: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();

/**
 * Tableau du pipeline : prospects LIVRÉS par étape (portée par rôle), avec totaux. Déplacer une
 * carte = PATCH /api/prospects/:id { stage }.
 */
export const GET = apiRoute({ action: 'pipeline:read' }, async ({ req, ctx }) => {
  const q = parseQuery(req, query);
  const actor = actorOf(ctx);
  const db = await appDb();
  const out = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
    const stages = await listStages(tx, ctx.orgId);
    const names = await memberNames(tx);
    const p = schema.prospects;
    const scope = and(
      isNotNull(p.deliveredAt),
      actor.ownerOnly ? eq(p.ownerUserId, actor.ownerOnly) : undefined,
      q.ownerUserId ? eq(p.ownerUserId, q.ownerUserId) : undefined,
    );
    const totals = await tx
      .select({
        stage: p.stageKey,
        n: sql<number>`count(*)::int`,
        value: sql<number>`coalesce(sum(${p.valueAmount}), 0)::int`,
      })
      .from(p)
      .where(scope)
      .groupBy(p.stageKey);
    const columns = [];
    for (const s of stages) {
      const rows = await tx
        .select({
          id: p.id,
          displayName: p.displayName,
          countryCode: p.countryCode,
          city: p.city,
          score: p.score,
          ownerUserId: p.ownerUserId,
          valueAmount: p.valueAmount,
          qualification: p.qualification,
          stageChangedAt: p.stageChangedAt,
        })
        .from(p)
        .where(and(scope, eq(p.stageKey, s.key)))
        .orderBy(desc(p.stageChangedAt), desc(p.score))
        .limit(q.perStage);
      const t = totals.find((x) => x.stage === s.key);
      columns.push({
        key: s.key,
        label: { fr: s.labelFr, en: s.labelEn },
        kind: s.kind,
        count: t?.n ?? 0,
        value: t?.value ?? 0,
        items: rows.map((r) => ({
          ...r,
          ownerName: r.ownerUserId ? (names.get(r.ownerUserId)?.name ?? null) : null,
        })),
      });
    }
    return columns;
  });
  return json({ stages: out });
});
