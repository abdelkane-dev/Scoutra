import { usageOfError } from '@scoutra/ai';
import { buildCampaignPlan, interpret } from '@scoutra/agents';
import { targetsNamedPerson } from '@scoutra/core';
import { and, eq, schema, sql, withTenant } from '@scoutra/db';
import type { JobPayload, campaignInterpretJob } from '@scoutra/queue';
import { currentCostMode, emit, loadOrg, recordLlm } from './context';
import { resolveKeys, type CampaignDeps } from './deps';

/** Interprétation : texte libre → fiche de cible v1 + estimation ; attend la confirmation. */
export async function handleInterpret(
  deps: CampaignDeps,
  p: JobPayload<typeof campaignInterpretJob>,
  signal?: AbortSignal,
) {
  const orgId = p.organizationId;
  const ctx = await withTenant(deps.db, { orgId }, async (tx) => {
    const [c] = await tx
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, p.campaignId));
    if (!c || c.status !== 'interpreting') return null;
    const org = await loadOrg(tx);
    const [prof] = await tx
      .select({
        accountType: schema.organizations.accountType,
        sectors: schema.organizations.sectors,
      })
      .from(schema.organizations);
    return { c, org, prof, costMode: await currentCostMode(tx, deps.mode, deps.now()) };
  });
  if (!ctx) return { skipped: true };
  if (targetsNamedPerson(ctx.c.promptText)) {
    await withTenant(deps.db, { orgId }, async (tx) => {
      await tx
        .update(schema.campaigns)
        .set({ status: 'failed', errorCode: 'named_person_forbidden', updatedAt: sql`now()` })
        .where(eq(schema.campaigns.id, p.campaignId));
      await emit(tx, orgId, p.campaignId, 'campaign.status', {
        status: 'failed',
        code: 'named_person_forbidden',
      });
    });
    return { refused: 'named_person' };
  }
  const locale = p.locale;
  // Garde-fou de coût : à 100 % du plafond, pas d'IA (mode heuristique explicite).
  const llm = ctx.costMode === 'free_only' ? { ...deps.llm, available: false } : deps.llm;
  const r = await interpret(
    {
      promptText: ctx.c.promptText,
      locale,
      orgCountry: ctx.org.countryCode,
      accountType: ctx.prof?.accountType ?? null,
      sectors: ctx.prof?.sectors ?? [],
    },
    llm,
    signal,
  ).catch(async (e: unknown) => {
    // Coût d'un échec IA journalisé avant la reprise de la tâche (constat 11).
    const u = usageOfError(e);
    if (u)
      await withTenant(deps.db, { orgId }, (tx) =>
        recordLlm(tx, orgId, p.campaignId, 'interpreter:failed', u, deps.llm.provider),
      );
    throw e;
  });
  const spec = ctx.c.modelForced
    ? { ...r.spec, model: ctx.c.prospectingModel as typeof r.spec.model }
    : r.spec;
  const key = await resolveKeys(deps, orgId);
  const plan = buildCampaignPlan({
    spec,
    mode: deps.mode,
    hasKey: (pv) => !!key(pv),
    config: deps.config,
    costMode: ctx.costMode,
    searchProviders: deps.searchProviders,
    maxProspects: ctx.c.maxProspects,
    quality: ctx.c.quality as 'standard',
  });
  await withTenant(deps.db, { orgId }, async (tx) => {
    await tx
      .insert(schema.targetProfiles)
      .values({
        organizationId: orgId,
        campaignId: p.campaignId,
        version: 1,
        spec: {
          ...spec,
          _meta: {
            method: r.method,
            confidence: r.confidence,
            clarifyingQuestions: r.clarifyingQuestions,
          },
        },
        prospectKinds: spec.kinds,
        countries: spec.countries,
      })
      .onConflictDoNothing();
    const updated = await tx
      .update(schema.campaigns)
      .set({
        status: 'awaiting_confirmation',
        prospectingModel: spec.model,
        estimate: plan.estimate,
        sources: plan.sources,
        degraded: plan.sources.degraded,
        costMode: ctx.costMode,
        updatedAt: sql`now()`,
      })
      .where(
        and(eq(schema.campaigns.id, p.campaignId), eq(schema.campaigns.status, 'interpreting')),
      )
      .returning({ id: schema.campaigns.id });
    await recordLlm(tx, orgId, p.campaignId, 'interpreter', r.usage, deps.llm.provider);
    if (updated.length === 0) return; // annulée entre-temps
    await emit(tx, orgId, p.campaignId, 'campaign.target_ready', {
      method: r.method,
      confidence: r.confidence,
    });
    await emit(tx, orgId, p.campaignId, 'campaign.status', { status: 'awaiting_confirmation' });
  });
  return { method: r.method };
}
