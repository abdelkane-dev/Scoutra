import { AppError } from '@scoutra/core';
import { asc, eq, schema, type Transaction } from '@scoutra/db';

export const DEFAULT_STAGES = [
  { key: 'new', labelFr: 'Nouveau', labelEn: 'New', kind: 'open' },
  { key: 'contacted', labelFr: 'Contacté', labelEn: 'Contacted', kind: 'open' },
  { key: 'replied', labelFr: 'A répondu', labelEn: 'Replied', kind: 'open' },
  { key: 'meeting', labelFr: 'Rendez-vous', labelEn: 'Meeting', kind: 'open' },
  { key: 'won', labelFr: 'Validé', labelEn: 'Won', kind: 'won' },
  { key: 'lost', labelFr: 'Perdu', labelEn: 'Lost', kind: 'lost' },
] as const;

export type Stage = typeof schema.pipelineStages.$inferSelect;

/** Étapes de l'organisation courante (créées par défaut au premier accès). */
export async function listStages(tx: Transaction, orgId: string): Promise<Stage[]> {
  const rows = await tx
    .select()
    .from(schema.pipelineStages)
    .orderBy(asc(schema.pipelineStages.position));
  if (rows.length) return rows;
  await tx
    .insert(schema.pipelineStages)
    .values(DEFAULT_STAGES.map((s, i) => ({ organizationId: orgId, ...s, position: i })))
    .onConflictDoNothing();
  return tx.select().from(schema.pipelineStages).orderBy(asc(schema.pipelineStages.position));
}

export async function assertStage(tx: Transaction, orgId: string, key: string): Promise<Stage> {
  const stage = (await listStages(tx, orgId)).find((s) => s.key === key);
  if (!stage)
    throw new AppError('invalid_input', 'étape inconnue', [
      { path: 'stage', code: 'unknown_stage' },
    ]);
  return stage;
}

/** Remplace la configuration des étapes (clés existantes conservées ; prospects d'une étape supprimée → 'new'). */
export async function replaceStages(
  tx: Transaction,
  orgId: string,
  stages: { key: string; labelFr: string; labelEn: string; kind: 'open' | 'won' | 'lost' }[],
): Promise<Stage[]> {
  const keys = new Set(stages.map((s) => s.key));
  if (!keys.has('new'))
    throw new AppError('invalid_input', 'étape new obligatoire', [
      { path: 'stages', code: 'new_required' },
    ]);
  const current = await listStages(tx, orgId);
  for (const c of current) {
    if (!keys.has(c.key)) {
      await tx
        .update(schema.prospects)
        .set({ stageKey: 'new' })
        .where(eq(schema.prospects.stageKey, c.key));
      await tx.delete(schema.pipelineStages).where(eq(schema.pipelineStages.id, c.id));
    }
  }
  for (const [i, s] of stages.entries()) {
    await tx
      .insert(schema.pipelineStages)
      .values({ organizationId: orgId, ...s, position: i })
      .onConflictDoUpdate({
        target: [schema.pipelineStages.organizationId, schema.pipelineStages.key],
        set: { labelFr: s.labelFr, labelEn: s.labelEn, kind: s.kind, position: i },
      });
  }
  return listStages(tx, orgId);
}
