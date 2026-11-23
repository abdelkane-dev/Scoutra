import { MILLICREDITS_PER_CREDIT, PACKS, PLANS, monthlyGrantFor } from '@scoutra/billing';
import { asc, gt, schema, walletBalanceMc, withTenant } from '@scoutra/db';
import { planFor } from '@scoutra/queue';
import { appDb } from '@/server/db';
import { getEnv } from '@/server/env';
import { apiRoute, json } from '@/server/http';
import { getPaymentProvider } from '@/server/payments';

export const dynamic = 'force-dynamic';

/**
 * Facturation (lecture) : abonnement, crédits par origine, moyen de paiement et factures via
 * l'interface de paiement abstraite. Sans prestataire branché : `provider: null`, moyen de
 * paiement null, aucune facture (rien n'est inventé).
 */
export const GET = apiRoute({ action: 'billing:read' }, async ({ ctx }) => {
  const env = getEnv();
  if (env.SCOUTRA_MODE === 'license') return json({ mode: 'license', license: ctx.license });
  const db = await appDb();
  const data = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
    const now = new Date();
    const [sub] = await tx.select().from(schema.subscriptions);
    const { plan } = await planFor(tx, now);
    const buckets = await tx
      .select()
      .from(schema.creditBuckets)
      .where(gt(schema.creditBuckets.expiresAt, now))
      .orderBy(asc(schema.creditBuckets.expiresAt));
    const by = (o: string) =>
      buckets.filter((b) => b.origin === o).reduce((t, b) => t + b.remainingMc, 0) /
      MILLICREDITS_PER_CREDIT;
    return {
      subscription: sub
        ? {
            plan: sub.plan,
            status: sub.status,
            seats: sub.seats,
            periodStart: sub.periodStart,
            periodEnd: sub.periodEnd,
            renewsOn: sub.status === 'active' ? sub.periodEnd : null,
          }
        : null,
      plan: {
        code: plan.code,
        priceUsdMonthly: plan.priceUsdMonthly,
        monthlyCredits: monthlyGrantFor(plan, sub?.seats ?? plan.includedSeats),
        seatsIncluded: plan.includedSeats,
        extraSeatPriceUsd: plan.extraSeatPriceUsd,
      },
      credits: {
        balance: (await walletBalanceMc(tx, ctx.orgId, now)) / MILLICREDITS_PER_CREDIT,
        plan: by('plan'),
        rollover: by('rollover'),
        packs: by('pack'),
        trial: by('trial'),
        nextExpiry: buckets[0]?.expiresAt ?? null,
      },
    };
  });
  const provider = getPaymentProvider();
  const overview = provider?.getCustomerOverview
    ? await provider.getCustomerOverview(ctx.orgId)
    : null;
  return json({
    mode: 'saas',
    provider: provider?.code ?? null,
    ...data,
    paymentMethod: overview?.paymentMethod ?? null,
    invoices: overview?.invoices ?? [],
    catalog: {
      plans: Object.values(PLANS).map((p) => ({
        code: p.code,
        priceUsdMonthly: p.priceUsdMonthly,
        monthlyCredits: p.monthlyCredits,
        includedSeats: p.includedSeats,
      })),
      packs: PACKS.map((p) => ({
        code: p.code,
        credits: p.credits,
        priceUsd: p.priceUsd,
        validityMonths: p.validityMonths,
      })),
    },
  });
});
