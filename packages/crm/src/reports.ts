import { and, eq, gte, isNotNull, schema, sql, type Transaction } from '@scoutra/db';
import { memberNames } from './activity';
import { listStages } from './stages';

/**
 * Rapports calculés sur les VRAIES tables (prospects livrés, messages saisis, historique,
 * consommations de crédits). `ownerOnly` : un membre ne voit que ses propres chiffres.
 */
export async function buildReport(
  tx: Transaction,
  orgId: string,
  o: { days: number; ownerOnly: string | null; team: boolean },
) {
  const since = new Date(Date.now() - o.days * 86_400_000);
  const p = schema.prospects;
  const mine = o.ownerOnly ? eq(p.ownerUserId, o.ownerOnly) : undefined;
  const delivered = and(isNotNull(p.deliveredAt), gte(p.deliveredAt, since), mine);

  // Entonnoir cumulé : un prospect à l'étape k a franchi toutes les étapes ouvertes précédentes.
  const stages = (await listStages(tx, orgId)).filter((s) => s.kind !== 'lost');
  const byStage = await tx
    .select({ stage: p.stageKey, n: sql<number>`count(*)::int` })
    .from(p)
    .where(delivered)
    .groupBy(p.stageKey);
  const funnel = stages.map((s, i) => ({
    stage: s.key,
    label: { fr: s.labelFr, en: s.labelEn },
    n: byStage
      .filter((b) => stages.findIndex((x) => x.key === b.stage) >= i)
      .reduce((t, b) => t + b.n, 0),
  }));

  const m = schema.messages;
  const channels = await tx
    .select({
      channel: m.channel,
      sent: sql<number>`count(*) filter (where ${m.status} in ('sent_manually', 'replied'))::int`,
      replied: sql<number>`count(*) filter (where ${m.status} = 'replied')::int`,
    })
    .from(m)
    .innerJoin(p, eq(p.id, m.prospectId))
    .where(and(isNotNull(m.sentAt), gte(m.sentAt, since), mine))
    .groupBy(m.channel);

  const countries = await tx
    .select({ cc: p.countryCode, n: sql<number>`count(*)::int` })
    .from(p)
    .where(delivered)
    .groupBy(p.countryCode)
    .orderBy(sql`2 desc`)
    .limit(8);

  const weeksDelivered = await tx
    .select({
      w: sql<string>`to_char(date_trunc('week', ${p.deliveredAt}), 'YYYY-MM-DD')`,
      n: sql<number>`count(*)::int`,
    })
    .from(p)
    .where(delivered)
    .groupBy(sql`1`);
  const a = schema.prospectActivities;
  const meetingsRows = await tx
    .select({
      w: sql<string>`to_char(date_trunc('week', ${a.createdAt}), 'YYYY-MM-DD')`,
      n: sql<number>`count(*)::int`,
      owner: p.ownerUserId,
    })
    .from(a)
    .innerJoin(p, eq(p.id, a.prospectId))
    .where(
      and(
        eq(a.type, 'stage_changed'),
        sql`${a.payload}->>'to' = 'meeting'`,
        gte(a.createdAt, since),
        mine,
      ),
    )
    .groupBy(sql`1`, p.ownerUserId);
  const weekKeys = [
    ...new Set([...weeksDelivered.map((x) => x.w), ...meetingsRows.map((x) => x.w)]),
  ].sort();
  const weekly = weekKeys.map((w) => ({
    week: w,
    delivered: weeksDelivered.find((x) => x.w === w)?.n ?? 0,
    meetings: meetingsRows.filter((x) => x.w === w).reduce((t, x) => t + x.n, 0),
  }));

  const c = schema.creditConsumptions;
  const daily = await tx
    .select({
      d: sql<string>`to_char(date_trunc('day', ${c.createdAt}), 'YYYY-MM-DD')`,
      mc: sql<number>`sum(${c.amountMc})::bigint`,
    })
    .from(c)
    .leftJoin(p, eq(p.id, c.prospectId))
    .where(and(gte(c.createdAt, since), mine))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  let cumul = 0;
  const credits = daily.map((d) => ({
    day: d.d,
    used: Math.round((cumul += Number(d.mc)) / 1000),
  }));

  let members:
    | { userId: string; name: string; prospects: number; meetings: number; won: number }[]
    | undefined;
  if (o.team) {
    const names = await memberNames(tx);
    const per = await tx
      .select({
        owner: p.ownerUserId,
        prospects: sql<number>`count(*)::int`,
        won: sql<number>`count(*) filter (where ${p.stageKey} = 'won')::int`,
      })
      .from(p)
      .where(and(delivered, isNotNull(p.ownerUserId)))
      .groupBy(p.ownerUserId);
    const ids = [
      ...new Set([
        ...per.map((x) => x.owner!),
        ...meetingsRows.map((x) => x.owner).filter((x): x is string => !!x),
      ]),
    ];
    members = ids.map((id) => ({
      userId: id,
      name: names.get(id)?.name ?? '',
      prospects: per.find((x) => x.owner === id)?.prospects ?? 0,
      meetings: meetingsRows.filter((x) => x.owner === id).reduce((t, x) => t + x.n, 0),
      won: per.find((x) => x.owner === id)?.won ?? 0,
    }));
  }
  return {
    range: { days: o.days, since },
    scope: o.ownerOnly ? 'own' : 'team',
    funnel,
    channels: channels.map((x) => ({
      channel: x.channel,
      sent: x.sent,
      replied: x.replied,
      rate: x.sent ? x.replied / x.sent : 0,
    })),
    countries,
    weekly,
    credits,
    members,
  };
}
