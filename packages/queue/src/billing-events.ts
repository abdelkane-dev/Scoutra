import {
  MILLICREDITS_PER_CREDIT,
  PACKS,
  PLANS,
  billingEventSchema,
  monthlyGrantFor,
  type BillingEvent,
} from '@scoutra/billing';
import {
  and,
  desc,
  eq,
  grantCredits,
  gt,
  schema,
  sql,
  withTenant,
  type Database,
} from '@scoutra/db';

/**
 * Applique un événement de paiement VÉRIFIÉ (signature contrôlée par l'adaptateur du
 * prestataire) : idempotent grâce aux références des portefeuilles (`plan:<période>`,
 * `pack:<eventId>`…) — un webhook rejoué ne crédite jamais deux fois.
 */
export async function applyBillingEvent(
  db: Database,
  input: BillingEvent,
): Promise<'applied' | 'duplicate'> {
  const e = billingEventSchema.parse(input);
  const orgId = e.organizationId;
  return withTenant(db, { orgId }, async (tx) => {
    if (e.type === 'pack.purchased') {
      const pack = PACKS.find((p) => p.code === e.pack)!;
      const expiresAt = new Date();
      expiresAt.setUTCMonth(expiresAt.getUTCMonth() + pack.validityMonths);
      const ok = await grantCredits(tx, {
        orgId,
        origin: 'pack',
        amountMc: pack.credits * MILLICREDITS_PER_CREDIT,
        expiresAt,
        ref: `pack:${e.eventId}`,
      });
      return ok ? 'applied' : 'duplicate';
    }
    if (e.type === 'subscription.canceled') {
      await tx.update(schema.subscriptions).set({ status: 'canceled', updatedAt: sql`now()` });
      return 'applied';
    }
    const [current] = await tx.select().from(schema.subscriptions);
    const periodStart = new Date(e.periodStart);
    const periodEnd = new Date(e.periodEnd);
    if (e.type === 'subscription.activated') {
      await tx
        .insert(schema.subscriptions)
        .values({
          organizationId: orgId,
          plan: e.plan,
          status: 'active',
          seats: e.seats,
          periodStart,
          periodEnd,
          provider: 'provider',
          providerRef: e.providerRef,
        })
        .onConflictDoUpdate({
          target: schema.subscriptions.organizationId,
          set: {
            plan: e.plan,
            status: 'active',
            seats: e.seats,
            periodStart,
            periodEnd,
            providerRef: e.providerRef,
            updatedAt: sql`now()`,
          },
        });
    } else {
      if (!current) return 'duplicate';
      await tx
        .update(schema.subscriptions)
        .set({ status: 'active', periodStart, periodEnd, updatedAt: sql`now()` });
    }
    const [sub] = await tx.select().from(schema.subscriptions);
    const plan = PLANS[sub!.plan as keyof typeof PLANS];
    // Report : 50 % de l'octroi du forfait précédent, dans la limite de ce qui reste, un mois.
    if (e.type === 'subscription.renewed') {
      const [prev] = await tx
        .select()
        .from(schema.creditBuckets)
        .where(
          and(eq(schema.creditBuckets.origin, 'plan'), gt(schema.creditBuckets.remainingMc, 0)),
        )
        .orderBy(desc(schema.creditBuckets.createdAt))
        .limit(1);
      const carry = prev
        ? Math.min(prev.remainingMc, Math.floor(prev.grantedMc * plan.rolloverRatio))
        : 0;
      if (prev && carry > 0) {
        await grantCredits(tx, {
          orgId,
          origin: 'rollover',
          amountMc: carry,
          expiresAt: new Date(periodEnd.getTime() + 30 * 86_400_000),
          ref: `rollover:${e.periodStart}`,
        });
      }
    }
    const ok = await grantCredits(tx, {
      orgId,
      origin: 'plan',
      amountMc: monthlyGrantFor(plan, sub!.seats) * MILLICREDITS_PER_CREDIT,
      expiresAt: periodEnd,
      ref: `plan:${e.periodStart}`,
    });
    return ok ? 'applied' : 'duplicate';
  });
}
