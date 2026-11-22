import { and, asc, eq, gt, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Transaction } from './client';
import { campaignEvents, usageEvents } from './schema';

export const CAMPAIGN_EVENT_TYPES = [
  'campaign.status',
  'campaign.target_ready',
  'campaign.progress',
  'prospect.created',
  'prospect.updated',
  'message.drafted',
  'usage.updated',
  'campaign.warning',
] as const;
export type CampaignEventType = (typeof CAMPAIGN_EVENT_TYPES)[number];

/** Événement de campagne : identifiants et compteurs seulement (pas de donnée personnelle). */
export async function appendCampaignEvent(
  tx: Transaction,
  e: {
    orgId: string;
    campaignId: string;
    type: CampaignEventType;
    payload?: Record<string, unknown>;
  },
): Promise<number> {
  const [row] = await tx
    .insert(campaignEvents)
    .values({
      organizationId: e.orgId,
      campaignId: e.campaignId,
      type: e.type,
      payload: e.payload ?? {},
    })
    .returning({ id: campaignEvents.id });
  return row!.id;
}

export async function readCampaignEvents(
  tx: Transaction,
  campaignId: string,
  afterId: number,
  limit = 200,
) {
  return tx
    .select()
    .from(campaignEvents)
    .where(and(eq(campaignEvents.campaignId, campaignId), gt(campaignEvents.id, afterId)))
    .orderBy(asc(campaignEvents.id))
    .limit(limit);
}

const usageSchema = z.object({
  orgId: z.uuid(),
  campaignId: z.uuid().optional(),
  kind: z.enum(['llm', 'connector', 'verification', 'crawl']),
  provider: z.string().min(1).max(60),
  source: z.string().min(1).max(60),
  units: z.int().min(0).default(1),
  inputTokens: z.int().min(0).optional(),
  outputTokens: z.int().min(0).optional(),
  costMicroUsd: z.int().min(0),
});

/** Coût réel d'un événement (ajout seul) : base du garde-fou et du recalibrage du barème. */
export async function recordUsage(tx: Transaction, u: z.input<typeof usageSchema>): Promise<void> {
  const v = usageSchema.parse(u);
  await tx.insert(usageEvents).values({
    organizationId: v.orgId,
    campaignId: v.campaignId,
    kind: v.kind,
    provider: v.provider,
    source: v.source,
    units: v.units,
    inputTokens: v.inputTokens,
    outputTokens: v.outputTokens,
    costMicroUsd: v.costMicroUsd,
  });
}

/** Coût réel cumulé depuis une date (micro-dollars), organisation courante. */
export async function costSince(tx: Transaction, since: Date): Promise<number> {
  const [row] = await tx
    .select({ total: sql<string>`coalesce(sum(${usageEvents.costMicroUsd}), 0)` })
    .from(usageEvents)
    .where(gte(usageEvents.createdAt, since));
  return Number(row?.total ?? 0);
}
