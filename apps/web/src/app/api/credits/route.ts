import { DELIVERY_CREDITS, PACKS } from '@scoutra/billing';
import { asc, gt, schema, walletBalanceMc, withTenant } from '@scoutra/db';
import { currentCostMode, planFor } from '@scoutra/queue';
import { appDb } from '@/server/db';
import { getEnv } from '@/server/env';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Solde, portefeuilles (expiration), formule et quotas, garde-fou de coût (barème unique). */
export const GET = apiRoute({ action: 'credits:read' }, async ({ ctx }) => {
  const env = getEnv();
  if (env.SCOUTRA_MODE === 'license') return json({ mode: 'license', credits: null });
  const db = await appDb();
  const out = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
    const now = new Date();
    const { plan, periodStart } = await planFor(tx, now);
    const buckets = await tx
      .select({
        origin: schema.creditBuckets.origin,
        remainingMc: schema.creditBuckets.remainingMc,
        expiresAt: schema.creditBuckets.expiresAt,
      })
      .from(schema.creditBuckets)
      .where(gt(schema.creditBuckets.expiresAt, now))
      .orderBy(asc(schema.creditBuckets.expiresAt));
    return {
      mode: 'saas',
      balance: (await walletBalanceMc(tx, ctx.orgId, now)) / 1000,
      buckets: buckets.map((b) => ({
        origin: b.origin,
        remaining: b.remainingMc / 1000,
        expiresAt: b.expiresAt,
      })),
      plan: {
        code: plan.code,
        monthlyCredits: plan.monthlyCredits,
        concurrentCampaigns: plan.concurrentCampaigns,
        maxProspectsPerCampaign: plan.maxProspectsPerCampaign,
        dailyProspectCap: plan.dailyProspectCap,
        pipeline: plan.pipeline,
      },
      periodStart,
      costMode: await currentCostMode(tx, 'saas', now),
      deliveryCredits: DELIVERY_CREDITS,
      packs: PACKS.map((p) => ({
        code: p.code,
        credits: p.credits,
        priceUsd: p.priceUsd,
        validityMonths: p.validityMonths,
      })),
    };
  });
  return json(out);
});
