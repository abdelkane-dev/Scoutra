import { z } from 'zod';
import { SIGNAL_KEYS } from '@scoutra/core';
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  like,
  or,
  schema,
  sql,
  type Transaction,
} from '@scoutra/db';
import type { Actor } from './prospects';

/** Critères d'une recherche enregistrée (sur les prospects déjà trouvés) ou d'une alerte de signaux. */
export const savedFiltersSchema = z
  .object({
    q: z.string().trim().min(2).max(100).optional(),
    countries: z
      .array(z.string().regex(/^[A-Z]{2}$/))
      .max(20)
      .optional(),
    kind: z.string().max(20).optional(),
    minScore: z.int().min(0).max(100).optional(),
    signals: z.array(z.enum(SIGNAL_KEYS)).max(15).optional(),
    campaignId: z.uuid().optional(),
  })
  .strict();
export type SavedFilters = z.infer<typeof savedFiltersSchema>;

/** Condition SQL des prospects correspondant aux critères (portée de l'acteur incluse). */
export function prospectWhere(actor: Actor, f: SavedFilters) {
  const p = schema.prospects;
  const signalCond = f.signals?.length
    ? inArray(
        p.id,
        sql`(select ${schema.evidence.prospectId} from ${schema.evidence} where ${schema.evidence.fieldPath} in ${f.signals.map((s) => `signals.${s}`)})`,
      )
    : undefined;
  return and(
    isNotNull(p.deliveredAt),
    actor.ownerOnly ? eq(p.ownerUserId, actor.ownerOnly) : undefined,
    f.q ? sql`${p.displayName} ilike ${`%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`}` : undefined,
    f.countries?.length ? inArray(p.countryCode, f.countries) : undefined,
    f.kind ? eq(p.kind, f.kind) : undefined,
    f.minScore !== undefined ? gte(p.score, f.minScore) : undefined,
    f.campaignId ? eq(p.campaignId, f.campaignId) : undefined,
    signalCond,
  );
}

export async function countMatches(tx: Transaction, actor: Actor, f: SavedFilters, since?: Date) {
  const p = schema.prospects;
  const [r] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(p)
    .where(and(prospectWhere(actor, f), since ? gte(p.deliveredAt, since) : undefined));
  return r?.n ?? 0;
}

/** Signaux collectés (preuves `signals.*`) sur les prospects visibles, du plus récent au plus ancien. */
export async function listSignals(
  tx: Transaction,
  actor: Actor,
  o: { types?: string[]; days: number; limit: number },
) {
  const e = schema.evidence;
  const p = schema.prospects;
  const since = new Date(Date.now() - o.days * 86_400_000);
  const rows = await tx
    .select({
      id: e.id,
      fieldPath: e.fieldPath,
      sourceCode: e.sourceCode,
      sourceUrl: e.sourceUrl,
      snippet: e.snippet,
      collectedAt: e.collectedAt,
      prospectId: p.id,
      prospectName: p.displayName,
      countryCode: p.countryCode,
      score: p.score,
    })
    .from(e)
    .innerJoin(p, eq(p.id, e.prospectId))
    .where(
      and(
        like(e.fieldPath, 'signals.%'),
        gte(e.collectedAt, since),
        actor.ownerOnly ? eq(p.ownerUserId, actor.ownerOnly) : undefined,
        o.types?.length ? or(...o.types.map((t) => eq(e.fieldPath, `signals.${t}`))) : undefined,
      ),
    )
    .orderBy(desc(e.collectedAt))
    .limit(o.limit);
  return rows.map((r) => ({
    id: r.id,
    type: r.fieldPath.slice('signals.'.length),
    prospectId: r.prospectId,
    prospectName: r.prospectName,
    countryCode: r.countryCode,
    score: r.score,
    text: r.snippet,
    source: r.sourceCode,
    url: r.sourceUrl,
    at: r.collectedAt,
  }));
}
