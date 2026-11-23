import type { Usage } from '@scoutra/ai';
import { targetSpecSchema, type TargetSpec } from '@scoutra/core';
export { planFor, currentCostMode } from '@scoutra/queue';
import {
  appendCampaignEvent,
  desc,
  eq,
  recordUsage,
  schema,
  type CampaignEventType,
  type Transaction,
} from '@scoutra/db';

export interface OrgInfo {
  id: string;
  name: string;
  countryCode: string;
}

export async function loadOrg(tx: Transaction): Promise<OrgInfo> {
  const [o] = await tx
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      countryCode: schema.organizations.countryCode,
    })
    .from(schema.organizations);
  if (!o) throw new Error('organisation introuvable');
  return o;
}

export async function latestSpec(
  tx: Transaction,
  campaignId: string,
): Promise<{ spec: TargetSpec; version: number } | null> {
  const [t] = await tx
    .select({ spec: schema.targetProfiles.spec, version: schema.targetProfiles.version })
    .from(schema.targetProfiles)
    .where(eq(schema.targetProfiles.campaignId, campaignId))
    .orderBy(desc(schema.targetProfiles.version))
    .limit(1);
  if (!t) return null;
  const { _meta: _ignored, ...raw } = t.spec as Record<string, unknown>;
  return { spec: targetSpecSchema.parse(raw), version: t.version };
}

export function emit(
  tx: Transaction,
  orgId: string,
  campaignId: string,
  type: CampaignEventType,
  payload: Record<string, unknown> = {},
) {
  return appendCampaignEvent(tx, { orgId, campaignId, type, payload });
}

export function recordLlm(
  tx: Transaction,
  orgId: string,
  campaignId: string,
  agent: string,
  u: Usage | undefined,
  provider: string,
) {
  if (!u) return Promise.resolve();
  return recordUsage(tx, {
    orgId,
    campaignId,
    kind: 'llm',
    provider,
    source: `${agent}:${u.model}`.slice(0, 60),
    units: 1,
    inputTokens: u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens,
    outputTokens: u.outputTokens,
    costMicroUsd: u.costMicroUsd,
  });
}
