import type { Usage } from '@scoutra/ai';
import { PLANS, TRIAL, costModeFor, type PlanConfig } from '@scoutra/billing';
import type { CostMode } from '@scoutra/connectors';
import { targetSpecSchema, type TargetSpec } from '@scoutra/core';
import {
  appendCampaignEvent,
  costSince,
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

/** Formule de l'organisation (abonnement actif, sinon essai) et début de période. */
export async function planFor(
  tx: Transaction,
  now: Date,
): Promise<{ plan: PlanConfig; periodStart: Date; costCapUsd: number }> {
  const [s] = await tx.select().from(schema.subscriptions);
  if (s && (s.status === 'active' || s.status === 'trialing' || s.status === 'past_due')) {
    const plan = PLANS[s.plan as keyof typeof PLANS] ?? PLANS.research;
    return { plan, periodStart: s.periodStart, costCapUsd: plan.costGuardUsd };
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { plan: PLANS[TRIAL.plan], periodStart: start, costCapUsd: TRIAL.costGuardUsd };
}

/** Garde-fou de coût réel : licence = toujours normal (le client paie ses clés). */
export async function currentCostMode(
  tx: Transaction,
  mode: 'saas' | 'license',
  now: Date,
): Promise<CostMode> {
  if (mode === 'license') return 'normal';
  const { periodStart, costCapUsd } = await planFor(tx, now);
  return costModeFor(await costSince(tx, periodStart), costCapUsd);
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
