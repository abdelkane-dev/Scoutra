import { and, eq, ne, sql } from 'drizzle-orm';
import type { Database } from './client';
import { playbooks } from './schema';

/**
 * Copie les playbooks (source de vérité : @scoutra/agents) dans la table de référence, avec le
 * rôle PROPRIÉTAIRE (migration). Idempotent : une version existante n'est jamais modifiée ;
 * la plus haute version de chaque modèle devient active.
 */
export async function seedPlaybooks(
  db: Database,
  list: readonly { model: string; version: number }[],
): Promise<number> {
  let inserted = 0;
  await db.transaction(async (tx) => {
    for (const p of list) {
      const rows = await tx
        .insert(playbooks)
        .values({ modelCode: p.model, version: p.version, definition: p, isActive: false })
        .onConflictDoNothing({ target: [playbooks.modelCode, playbooks.version] })
        .returning({ id: playbooks.id });
      inserted += rows.length;
      await tx
        .update(playbooks)
        .set({ isActive: sql`${playbooks.version} = ${p.version}` })
        .where(and(eq(playbooks.modelCode, p.model), ne(playbooks.version, -1)));
    }
  });
  return inserted;
}
