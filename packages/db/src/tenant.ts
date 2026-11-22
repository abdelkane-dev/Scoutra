import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database, Transaction } from './client';

const tenantCtxSchema = z.object({
  orgId: z.uuid(),
  userId: z.uuid().optional(),
});

export interface TenantContext {
  orgId: string;
  userId?: string;
}

/**
 * SEUL point d'entrée pour lire/écrire des données métier.
 * Ouvre une transaction et fixe `app.org_id` avec `set_config(..., true)` (équivalent de
 * SET LOCAL, paramétré) : la valeur disparaît à la fin de la transaction, donc rien ne fuit
 * vers la requête suivante qui réutilise la connexion du pool. La RLS Postgres filtre
 * ensuite chaque ligne sur cette organisation.
 */
export async function withTenant<T>(
  db: Database,
  ctx: TenantContext,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const { orgId, userId } = tenantCtxSchema.parse(ctx);
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.org_id', ${orgId}, true), set_config('app.user_id', ${userId ?? ''}, true)`,
    );
    return fn(tx);
  });
}
