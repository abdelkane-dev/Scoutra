import { z } from 'zod';
import { dataScope } from '@scoutra/auth';
import { PROSPECT_KINDS, isoCountrySchema } from '@scoutra/core';
import { and, asc, desc, eq, gte, inArray, isNotNull, schema, sql, withTenant } from '@scoutra/db';
import { emailStatusOf, memberNames } from '@scoutra/crm';
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
    stage: z
      .string()
      .regex(/^[a-z0-9_]{2,40}$/)
      .optional(),
    ownerUserId: z.uuid().optional(),
    listId: z.uuid().optional(),
    qualification: z.enum(['unqualified', 'qualified', 'disqualified']).optional(),
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
        stage: p.stageKey,
        qualification: p.qualification,
        valueAmount: p.valueAmount,
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
          f.stage ? eq(p.stageKey, f.stage) : undefined,
          f.ownerUserId ? eq(p.ownerUserId, f.ownerUserId) : undefined,
          f.qualification ? eq(p.qualification, f.qualification) : undefined,
          f.listId
            ? inArray(
                p.id,
                tx
                  .select({ id: schema.prospectListItems.prospectId })
                  .from(schema.prospectListItems)
                  .where(eq(schema.prospectListItems.listId, f.listId)),
              )
            : undefined,
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
  const page = rows.slice(0, f.limit);
  // Noms des propriétaires et statut d'email lisible (meilleur email vérifié).
  const extra = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
    const names = await memberNames(tx);
    const ids = page.map((r) => r.id);
    const emails = ids.length
      ? await tx
          .select({ p: schema.contacts.prospectId, s: schema.contacts.verificationStatus })
          .from(schema.contacts)
          .where(
            and(inArray(schema.contacts.prospectId, ids), eq(schema.contacts.channel, 'email')),
          )
      : [];
    return { names, emails };
  });
  return json({
    items: page.map((r) => {
      const a = (r.attributes ?? {}) as Record<string, unknown>;
      const decisions = (r.channelDecisions ?? []) as { channel: string; outcome: string }[];
      return {
        ...r,
        attributes: undefined,
        channelDecisions: undefined,
        category: (a.category as string | null) ?? null,
        signals: ((a.signals as { key: string }[] | undefined) ?? []).map((s) => s.key),
        channels: decisions.map((d) => ({ channel: d.channel, outcome: d.outcome })),
        ownerName: r.ownerUserId ? (extra.names.get(r.ownerUserId)?.name ?? null) : null,
        emailStatus: emailStatusOf(extra.emails.filter((e) => e.p === r.id).map((e) => e.s)),
      };
    }),
    nextOffset: rows.length > f.limit ? f.offset + f.limit : null,
  });
});
