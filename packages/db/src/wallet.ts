import { AppError } from '@scoutra/core';
import { and, asc, desc, eq, gt, sql } from 'drizzle-orm';
import type { Transaction } from './client';
import { appendLedgerEntry } from './credits';
import { campaigns, creditBuckets, creditConsumptions, creditReservations } from './schema';

/**
 * Portefeuille de crédits en MILLICRÉDITS entiers (1 crédit = 1 000 mc) :
 * - octroi → un portefeuille par origine (forfait, report, pack, essai) avec expiration ;
 * - réservation au lancement d'une campagne, prise FIFO par date d'expiration ;
 * - consommation par prospect livré (idempotente) dans la limite de la réservation ;
 * - règlement en fin de campagne : remboursement de la part non consommée.
 * Chaque mouvement de solde est aussi écrit au grand livre (ajout seul). Toutes les fonctions
 * s'exécutent dans une transaction withTenant (RLS) et sérialisent par verrou consultatif.
 */
async function lock(tx: Transaction, orgId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`credits:${orgId}`}, 0))`);
}

export async function walletBalanceMc(
  tx: Transaction,
  orgId: string,
  now = new Date(),
): Promise<number> {
  const [row] = await tx
    .select({ total: sql<string>`coalesce(sum(${creditBuckets.remainingMc}), 0)` })
    .from(creditBuckets)
    .where(and(eq(creditBuckets.organizationId, orgId), gt(creditBuckets.expiresAt, now)));
  return Number(row?.total ?? 0);
}

export async function grantCredits(
  tx: Transaction,
  g: {
    orgId: string;
    origin: 'plan' | 'rollover' | 'pack' | 'trial' | 'adjustment';
    amountMc: number;
    expiresAt: Date;
    /** Clé d'idempotence (ex. `plan:2026-12`, `pack:evt_123`). */
    ref: string;
  },
): Promise<boolean> {
  if (!Number.isInteger(g.amountMc) || g.amountMc <= 0)
    throw new AppError('invalid_input', 'montant');
  await lock(tx, g.orgId);
  const inserted = await tx
    .insert(creditBuckets)
    .values({
      organizationId: g.orgId,
      origin: g.origin,
      grantedMc: g.amountMc,
      remainingMc: g.amountMc,
      expiresAt: g.expiresAt,
      ref: g.ref,
    })
    .onConflictDoNothing({ target: [creditBuckets.organizationId, creditBuckets.ref] })
    .returning({ id: creditBuckets.id });
  if (inserted.length === 0) return false;
  const reason = {
    plan: 'monthly_grant',
    rollover: 'rollover',
    pack: 'pack_purchase',
    trial: 'adjustment',
    adjustment: 'adjustment',
  } as const;
  await appendLedgerEntry(tx, {
    orgId: g.orgId,
    delta: g.amountMc,
    reason: reason[g.origin],
    idempotencyKey: `grant:${g.ref}`,
    refType: 'credit_bucket',
    refId: inserted[0]!.id,
  });
  return true;
}

/**
 * Réserve jusqu'à `maxMc` pour une campagne (borné par le solde disponible). Refus si moins de
 * `minMc` disponibles. Idempotent : une campagne déjà réservée renvoie sa réservation.
 */
export async function reserveCredits(
  tx: Transaction,
  r: { orgId: string; campaignId: string; maxMc: number; minMc: number; now?: Date },
): Promise<number> {
  await lock(tx, r.orgId);
  const [c] = await tx
    .select({ reservedMc: campaigns.reservedMc })
    .from(campaigns)
    .where(eq(campaigns.id, r.campaignId))
    .for('update');
  if (!c) throw new AppError('not_found');
  if (c.reservedMc > 0) return c.reservedMc;
  const buckets = await tx
    .select()
    .from(creditBuckets)
    .where(and(gt(creditBuckets.expiresAt, r.now ?? new Date()), gt(creditBuckets.remainingMc, 0)))
    .orderBy(asc(creditBuckets.expiresAt), asc(creditBuckets.createdAt));
  const available = buckets.reduce((s, b) => s + b.remainingMc, 0);
  if (available < r.minMc) throw new AppError('insufficient_credits');
  let todo = Math.min(r.maxMc, available);
  const total = todo;
  let position = 0;
  for (const b of buckets) {
    if (todo === 0) break;
    const take = Math.min(todo, b.remainingMc);
    await tx
      .update(creditBuckets)
      .set({ remainingMc: sql`${creditBuckets.remainingMc} - ${take}` })
      .where(eq(creditBuckets.id, b.id));
    await tx.insert(creditReservations).values({
      organizationId: r.orgId,
      campaignId: r.campaignId,
      bucketId: b.id,
      reservedMc: take,
      position: position++,
    });
    todo -= take;
  }
  await tx.update(campaigns).set({ reservedMc: total }).where(eq(campaigns.id, r.campaignId));
  await appendLedgerEntry(tx, {
    orgId: r.orgId,
    delta: -total,
    reason: 'reserve',
    idempotencyKey: `reserve:${r.campaignId}`,
    refType: 'campaign',
    refId: r.campaignId,
  });
  return total;
}

/**
 * Consomme `amountMc` de la réservation pour un prospect livré. Retourne false si déjà consommé
 * (reprise de tâche) ou si la réservation restante ne suffit pas (pas de livraison, pas de débit).
 */
export async function consumeCredits(
  tx: Transaction,
  c: { orgId: string; campaignId: string; prospectId: string; amountMc: number; key: string },
): Promise<'consumed' | 'already' | 'budget_exhausted' | 'campaign_closed'> {
  await lock(tx, c.orgId);
  const [done] = await tx
    .select({ id: creditConsumptions.id })
    .from(creditConsumptions)
    .where(eq(creditConsumptions.idempotencyKey, c.key));
  if (done) return 'already';
  // Jamais de débit sur une campagne close ou en cours d'annulation (constat 13).
  const [state] = await tx
    .select({ status: campaigns.status })
    .from(campaigns)
    .where(eq(campaigns.id, c.campaignId))
    .for('update');
  if (state?.status !== 'running') return 'campaign_closed';
  const updated = await tx
    .update(campaigns)
    .set({ consumedMc: sql`${campaigns.consumedMc} + ${c.amountMc}` })
    .where(
      and(
        eq(campaigns.id, c.campaignId),
        sql`${campaigns.consumedMc} + ${c.amountMc} <= ${campaigns.reservedMc}`,
      ),
    )
    .returning({ id: campaigns.id });
  if (updated.length === 0) return 'budget_exhausted';
  await tx.insert(creditConsumptions).values({
    organizationId: c.orgId,
    campaignId: c.campaignId,
    prospectId: c.prospectId,
    amountMc: c.amountMc,
    idempotencyKey: c.key,
  });
  return 'consumed';
}

/** Règlement : rembourse (réservé − consommé), d'abord aux portefeuilles qui expirent le plus tard. */
export async function settleCampaign(
  tx: Transaction,
  s: { orgId: string; campaignId: string },
): Promise<number> {
  await lock(tx, s.orgId);
  const [c] = await tx
    .select({ reservedMc: campaigns.reservedMc, consumedMc: campaigns.consumedMc })
    .from(campaigns)
    .where(eq(campaigns.id, s.campaignId))
    .for('update');
  if (!c) throw new AppError('not_found');
  const rows = await tx
    .select()
    .from(creditReservations)
    .where(eq(creditReservations.campaignId, s.campaignId))
    .orderBy(desc(creditReservations.position));
  const alreadyRefunded = rows.reduce((t, r) => t + r.refundedMc, 0);
  let todo = c.reservedMc - c.consumedMc - alreadyRefunded;
  const refund = Math.max(0, todo);
  for (const r of rows) {
    if (todo <= 0) break;
    const give = Math.min(todo, r.reservedMc - r.refundedMc);
    if (give <= 0) continue;
    await tx
      .update(creditReservations)
      .set({ refundedMc: sql`${creditReservations.refundedMc} + ${give}` })
      .where(eq(creditReservations.id, r.id));
    await tx
      .update(creditBuckets)
      .set({ remainingMc: sql`${creditBuckets.remainingMc} + ${give}` })
      .where(eq(creditBuckets.id, r.bucketId));
    todo -= give;
  }
  if (refund > 0) {
    await appendLedgerEntry(tx, {
      orgId: s.orgId,
      delta: refund,
      reason: 'refund',
      idempotencyKey: `refund:${s.campaignId}`,
      refType: 'campaign',
      refId: s.campaignId,
    });
  }
  return refund;
}

/**
 * Verrou de quotas par organisation (revue étape 2, constat 14) : sérialise les contrôles
 * « compter puis créer » (campagnes simultanées, interprétations du jour, plafond journalier).
 */
export async function lockOrgQuotas(tx: Transaction, orgId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`quotas:${orgId}`}, 0))`);
}
