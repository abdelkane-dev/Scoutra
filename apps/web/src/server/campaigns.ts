import 'server-only';
import { buildCampaignPlan, type CampaignPlan } from '@scoutra/agents';
import type { DeliveryQuality } from '@scoutra/billing';
import { PLATFORM_KEYS } from '@scoutra/config';
import type { CostMode } from '@scoutra/connectors';
import { AppError, targetSpecSchema, type TargetSpec } from '@scoutra/core';
import { createKeyring, decodeMasterKey, type Keyring } from '@scoutra/crypto';
import { and, desc, eq, isNull, schema, type Transaction } from '@scoutra/db';
import { can, dataScope, type DataScope } from '@scoutra/auth';
import type { Actor } from '@scoutra/crm';
import { getEnv } from './env';
import type { OrgContext } from './session';

let keyring: Keyring | undefined;
let hashKey: Buffer | undefined;
export function cryptoKeys(): { keyring: Keyring; hashKey: Buffer } {
  const env = getEnv();
  keyring ??= createKeyring(env.SCOUTRA_MASTER_KEY_VERSION, {
    [env.SCOUTRA_MASTER_KEY_VERSION]: env.SCOUTRA_MASTER_KEY,
  });
  hashKey ??= decodeMasterKey(env.SCOUTRA_HASH_KEY);
  return { keyring, hashKey };
}

/** Fournisseurs disposant d'une clé (organisation ou plateforme) — sans déchiffrer. */
export async function availableKeys(tx: Transaction): Promise<Set<string>> {
  const env = getEnv();
  const rows = await tx
    .select({ provider: schema.apiCredentials.provider })
    .from(schema.apiCredentials)
    .where(isNull(schema.apiCredentials.revokedAt));
  const set = new Set(rows.map((r) => r.provider));
  for (const [provider, envKey] of Object.entries(PLATFORM_KEYS))
    if (env[envKey]) set.add(provider);
  return set;
}

export function planCampaign(
  spec: TargetSpec,
  keys: Set<string>,
  o: { maxProspects: number; quality: DeliveryQuality; costMode: CostMode },
): CampaignPlan {
  const env = getEnv();
  return buildCampaignPlan({
    spec,
    mode: env.SCOUTRA_MODE,
    hasKey: (p) => keys.has(p),
    config: {
      searxngUrl: env.SCOUTRA_SEARXNG_URL,
      overpassUrl: env.SCOUTRA_OVERPASS_URL,
      crawl4aiUrl: env.SCOUTRA_CRAWL4AI_URL,
    },
    costMode: o.costMode,
    searchProviders: env.SCOUTRA_SEARCH_PROVIDERS,
    maxProspects: o.maxProspects,
    quality: o.quality,
  });
}

/** Filtre de portée : un membre (`own`) ne voit que ses campagnes ; `none` (billing) rien. */
export function scopeOf(ctx: OrgContext, scope: DataScope) {
  if (scope === 'none') throw new AppError('forbidden');
  return scope === 'own' ? ctx.user.id : null;
}

/** Campagne de l'organisation courante (RLS) visible par l'utilisateur, sinon 404. */
export async function loadCampaign(tx: Transaction, id: string, ownerOnly: string | null) {
  const [c] = await tx
    .select()
    .from(schema.campaigns)
    .where(
      ownerOnly
        ? and(eq(schema.campaigns.id, id), eq(schema.campaigns.createdBy, ownerOnly))
        : eq(schema.campaigns.id, id),
    );
  if (!c) throw new AppError('not_found');
  return c;
}

export async function latestTarget(tx: Transaction, campaignId: string) {
  const [t] = await tx
    .select()
    .from(schema.targetProfiles)
    .where(eq(schema.targetProfiles.campaignId, campaignId))
    .orderBy(desc(schema.targetProfiles.version))
    .limit(1);
  if (!t) return null;
  const { _meta, ...raw } = t.spec as Record<string, unknown>;
  return {
    version: t.version,
    confirmed: t.confirmedByUser,
    spec: targetSpecSchema.parse(raw),
    interpretation: (_meta ?? null) as {
      method: 'ai' | 'heuristic';
      confidence: number;
      clarifyingQuestions: string[];
    } | null,
  };
}

/** Représentation publique d'une campagne (contrat docs/api.md). */
export function campaignView(c: typeof schema.campaigns.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    prompt: c.promptText,
    model: c.prospectingModel,
    modelForced: c.modelForced,
    status: c.status,
    quality: c.quality,
    maxProspects: c.maxProspects,
    credits: {
      reserved: c.reservedMc / 1000,
      consumed: c.consumedMc / 1000,
    },
    counts: {
      candidates: c.candidatesCount,
      duplicates: c.duplicatesCount,
      delivered: c.deliveredCount,
      rejected: c.rejectedCount,
    },
    degraded: c.degraded,
    costMode: c.costMode,
    estimate: c.estimate,
    sources: c.sources,
    createdBy: c.createdBy,
    createdAt: c.createdAt,
    startedAt: c.startedAt,
    finishedAt: c.finishedAt,
  };
}

/** Acteur CRM : portée (siens / équipe) et droit d'attribution, d'après le rôle. */
export function actorOf(ctx: OrgContext): Actor {
  return {
    orgId: ctx.orgId,
    userId: ctx.user.id,
    ownerOnly: scopeOf(ctx, dataScope(ctx.role)),
    canAssign: can(ctx.role, 'prospect:assign'),
  };
}
