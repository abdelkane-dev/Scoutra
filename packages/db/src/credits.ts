import { AppError } from '@scoutra/core';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Transaction } from './client';
import { creditLedger } from './schema';

const entrySchema = z.object({
  orgId: z.uuid(),
  delta: z
    .number()
    .int()
    .refine((d) => d !== 0, 'delta nul'),
  reason: z.enum(['monthly_grant', 'purchase', 'usage', 'reserve', 'refund', 'adjustment']),
  idempotencyKey: z.string().min(8).max(200),
  refType: z.string().max(50).optional(),
  refId: z.string().max(100).optional(),
  createdBy: z.uuid().optional(),
});
export type LedgerEntry = z.input<typeof entrySchema>;

async function lockOrg(tx: Transaction, orgId: string) {
  // Verrou consultatif par organisation, libéré en fin de transaction : sérialise les débits.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`credits:${orgId}`}, 0))`);
}

export async function getCreditBalance(tx: Transaction, orgId: string): Promise<number> {
  const [row] = await tx
    .select({ balance: sql<string>`coalesce(sum(${creditLedger.delta}), 0)` })
    .from(creditLedger)
    .where(eq(creditLedger.organizationId, orgId));
  return Number(row?.balance ?? 0);
}

/**
 * Ajoute un mouvement au grand livre (ajout seul, idempotent). Un débit (delta < 0) est
 * refusé s'il rendrait le solde négatif. Retourne false si la clé d'idempotence existe déjà.
 */
export async function appendLedgerEntry(tx: Transaction, entry: LedgerEntry): Promise<boolean> {
  const e = entrySchema.parse(entry);
  await lockOrg(tx, e.orgId);
  if (e.delta < 0) {
    const balance = await getCreditBalance(tx, e.orgId);
    if (balance + e.delta < 0) throw new AppError('conflict', 'Crédits insuffisants');
  }
  const inserted = await tx
    .insert(creditLedger)
    .values({
      organizationId: e.orgId,
      delta: e.delta,
      reason: e.reason,
      idempotencyKey: e.idempotencyKey,
      refType: e.refType,
      refId: e.refId,
      createdBy: e.createdBy,
    })
    .onConflictDoNothing({ target: [creditLedger.organizationId, creditLedger.idempotencyKey] })
    .returning({ id: creditLedger.id });
  return inserted.length === 1;
}
