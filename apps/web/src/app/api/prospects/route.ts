import { z } from 'zod';
import { dataScope } from '@scoutra/auth';
import { PROSPECT_KINDS, isoCountrySchema } from '@scoutra/core';
import { and, asc, desc, eq, gte, isNotNull, schema, sql, withTenant } from '@scoutra/db';
import { scopeOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';
import { parseQuery } from '@/server/query';

export const dynamic = 'force-dynamic';

const query = z
  .object({
    campaignId: z.uuid().optional(),
    status: z
      .enum(['found', 'enriched', 'verified', 'scored', 'drafted', 'rejected', 'suppressed'])
      .optional(),
    delivered: z.enum(['true', 'false']).optional(),
    minScore: z.coerce.number().int().min(0).max(100).optional(),
    country: isoCountrySchema.optional(),
    kind: z.enum(PROSPECT_KINDS).optional(),
    q: z.string().trim().min(2).max(100).optional(),
    sort: z.enum(['score', 'recent', 'name']).default('score'),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .strict();

/** Liste filtrée des prospects (membre : les siens). Aucune coordonnée en clair ici. */
export const GET = apiRoute({ action: 'prospect:read' }, async ({ req, ctx }) => {
  const f = parseQuery(req, query);
  const owner = scopeOf(ctx, dataScope(ctx.role));
  const p = schema.prospects;
  const db = await appDb();
  const rows = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
    tx
      .select({
        id: p.id,
        campaignId: p.campaignId,
        kind: p.kind,
        model: p.prospectingModel,
        displayName: p.displayName,
        countryCode: p.countryCode,
        city: p.city,
        websiteDomain: p.websiteDomain,
        status: p.status,
        rejectionReason: p.rejectionReason,
        score: p.score,
        sourceCodes: p.sourceCodes,
        attributes: p.attributes,
        channelDecisions: p.channelDecisions,
        ownerUserId: p.ownerUserId,
        deliveredAt: p.deliveredAt,
        createdAt: p.createdAt,
      })
      .from(p)
      .where(
        and(
          owner ? eq(p.ownerUserId, owner) : undefined,
          f.campaignId ? eq(p.campaignId, f.campaignId) : undefined,
          f.status ? eq(p.status, f.status) : undefined,
          f.delivered === 'true' ? isNotNull(p.deliveredAt) : undefined,
          f.delivered === 'false' ? sql`${p.deliveredAt} is null` : undefined,
          f.minScore !== undefined ? gte(p.score, f.minScore) : undefined,
          f.country ? eq(p.countryCode, f.country) : undefined,
          f.kind ? eq(p.kind, f.kind) : undefined,
          // Recherche paramétrée (jamais concaténée) ; % et _ échappés.
          f.q
            ? sql`${p.displayName} ilike ${`%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`}`
            : undefined,
        ),
      )
      .orderBy(
        f.sort === 'score'
          ? sql`${p.score} desc nulls last`
          : f.sort === 'name'
            ? asc(p.displayName)
            : desc(p.createdAt),
        desc(p.id),
      )
      .limit(f.limit + 1)
      .offset(f.offset),
  );
  return json({
    items: rows.slice(0, f.limit).map((r) => {
      const a = (r.attributes ?? {}) as Record<string, unknown>;
      const decisions = (r.channelDecisions ?? []) as { channel: string; outcome: string }[];
      return {
        ...r,
        attributes: undefined,
        channelDecisions: undefined,
        category: (a.category as string | null) ?? null,
        signals: ((a.signals as { key: string }[] | undefined) ?? []).map((s) => s.key),
        channels: decisions.map((d) => ({ channel: d.channel, outcome: d.outcome })),
      };
    }),
    nextOffset: rows.length > f.limit ? f.offset + f.limit : null,
  });
});
