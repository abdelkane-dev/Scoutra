import { buildCampaignPlan } from '@scoutra/agents';
import { eq, schema, sql, withTenant } from '@scoutra/db';
import {
  campaignFinalizeJob,
  publishTenantJob,
  searchRunJob,
  type JobPayload,
  type campaignPlanJob,
} from '@scoutra/queue';
import { currentCostMode, emit, latestSpec } from './context';
import { resolveKeys, type CampaignDeps } from './deps';

/** Planification au lancement : sources retenues (garde-fou, clés, disjoncteur) → requêtes en parallèle. */
export async function handlePlan(deps: CampaignDeps, p: JobPayload<typeof campaignPlanJob>) {
  const orgId = p.organizationId;
  const ctx = await withTenant(deps.db, { orgId }, async (tx) => {
    const [c] = await tx
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, p.campaignId));
    if (!c || c.status !== 'running') return null;
    return {
      c,
      spec: await latestSpec(tx, p.campaignId),
      costMode: await currentCostMode(tx, deps.mode, deps.now()),
    };
  });
  if (!ctx || !ctx.spec) return { skipped: true };
  const key = await resolveKeys(deps, orgId);
  const plan = buildCampaignPlan({
    spec: ctx.spec.spec,
    mode: deps.mode,
    hasKey: (pv) => !!key(pv),
    config: deps.config,
    costMode: ctx.costMode,
    searchProviders: deps.searchProviders,
    breaker: deps.breaker,
    maxProspects: ctx.c.maxProspects,
    quality: ctx.c.quality as 'standard',
  });
  await withTenant(deps.db, { orgId }, async (tx) => {
    await tx
      .update(schema.campaigns)
      .set({
        sources: plan.sources,
        degraded: plan.sources.degraded,
        costMode: ctx.costMode,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.campaigns.id, p.campaignId));
    await emit(tx, orgId, p.campaignId, 'campaign.progress', {
      phase: 'searching',
      queries: plan.queries.length,
      sources: plan.sources.selected,
    });
    if (plan.queries.length === 0)
      await emit(tx, orgId, p.campaignId, 'campaign.warning', {
        code: 'no_source_available',
        excluded: plan.sources.excluded,
      });
    else if (plan.sources.degraded)
      await emit(tx, orgId, p.campaignId, 'campaign.warning', {
        code: 'degraded_free_sources_only',
      });
  });
  const ref = { refType: 'campaign', refId: p.campaignId };
  for (const q of plan.queries) {
    await publishTenantJob(
      deps.boss,
      deps.db,
      searchRunJob,
      {
        organizationId: orgId,
        campaignId: p.campaignId,
        connector: q.connector,
        queryIndex: q.queryIndex,
      },
      {
        ...ref,
        singletonKey: `search:${p.campaignId}:${q.connector}:${q.queryIndex}`,
      },
    );
  }
  // Clôture : vérifiée après un délai, puis replanifiée tant que des tâches restent ouvertes.
  await publishTenantJob(
    deps.boss,
    deps.db,
    campaignFinalizeJob,
    { organizationId: orgId, campaignId: p.campaignId },
    { ...ref, startAfter: 15 },
  );
  return { queries: plan.queries.length };
}
