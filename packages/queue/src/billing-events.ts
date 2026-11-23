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
): Promise<'applied' | 'duplicate' | 'stale'> {
  const e = billingEventSchema.parse(input);
  const orgId = e.organizationId;
  const occurredAt = new Date(e.occurredAt);
  return withTenant(db, { orgId }, async (tx) => {
    // Idempotence (constat 9) : un même événement n'est traité qu'une fois, quel qu'en soit le type.
    const [first] = await tx
      .insert(schema.billingEvents)
      .values({
        organizationId: orgId,
        eventId: e.eventId,
        type: e.type,
        occurredAt,
        outcome: 'applied',
      })
      .onConflictDoNothing({
        target: [schema.billingEvents.organizationId, schema.billingEvents.eventId],
      })
      .returning({ id: schema.billingEvents.id });
    if (!first) return 'duplicate';
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
    const [current] = await tx.select().from(schema.subscriptions);
    // Ordre : un événement d'abonnement plus ancien que le dernier appliqué est ignoré.
    if (current?.lastEventAt && occurredAt <= current.lastEventAt) return 'stale';
    if (e.type === 'subscription.canceled') {
      await tx
        .update(schema.subscriptions)
        .set({ status: 'canceled', lastEventAt: occurredAt, updatedAt: sql`now()` });
      return 'applied';
    }
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
          lastEventAt: occurredAt,
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
            lastEventAt: occurredAt,
            updatedAt: sql`now()`,
          },
        });
    } else {
      if (!current || current.status === 'canceled') return 'stale';
      if (periodStart <= current.periodStart) return 'stale'; // période déjà ouverte
      await tx.update(schema.subscriptions).set({
        status: 'active',
        periodStart,
        periodEnd,
        lastEventAt: occurredAt,
        updatedAt: sql`now()`,
      });
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
