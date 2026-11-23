import { z } from 'zod';
import { AppError } from '@scoutra/core';
import { and, eq, inArray, schema, sql, type Transaction } from '@scoutra/db';
import { logActivity, memberNames } from './activity';
import { runAutomations } from './automations';
import { enroll } from './sequences';
import { assertStage } from './stages';

export interface Actor {
  orgId: string;
  userId: string;
  /** null : voit toute l'équipe ; sinon ne voit que les prospects dont il est propriétaire. */
  ownerOnly: string | null;
  canAssign: boolean;
}

export const QUALIFICATIONS = ['unqualified', 'qualified', 'disqualified'] as const;

export const prospectPatchSchema = z
  .object({
    stage: z
      .string()
      .regex(/^[a-z0-9_]{2,40}$/)
      .optional(),
    ownerUserId: z.uuid().nullable().optional(),
    valueAmount: z.int().min(0).max(1_000_000_000).nullable().optional(),
    qualification: z.enum(QUALIFICATIONS).optional(),
    note: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'au moins un champ');
export type ProspectPatch = z.infer<typeof prospectPatchSchema>;

/** Prospects visibles par l'acteur parmi `ids` (portée par rôle). */
export async function visibleIds(tx: Transaction, actor: Actor, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await tx
    .select({ id: schema.prospects.id })
    .from(schema.prospects)
    .where(
      and(
        inArray(schema.prospects.id, ids),
        actor.ownerOnly ? eq(schema.prospects.ownerUserId, actor.ownerOnly) : undefined,
      ),
    );
  return rows.map((r) => r.id);
}

async function assertMember(tx: Transaction, userId: string) {
  if (!(await memberNames(tx)).has(userId))
    throw new AppError('invalid_input', 'membre inconnu', [
      { path: 'ownerUserId', code: 'unknown_member' },
    ]);
}

/** Mise à jour d'un prospect (étape, propriétaire, valeur, qualification, note), historisée. */
export async function patchProspect(tx: Transaction, actor: Actor, id: string, p: ProspectPatch) {
  const [cur] = await tx
    .select()
    .from(schema.prospects)
    .where(
      and(
        eq(schema.prospects.id, id),
        actor.ownerOnly ? eq(schema.prospects.ownerUserId, actor.ownerOnly) : undefined,
      ),
    )
    .for('update');
  if (!cur) throw new AppError('not_found');
  const set: Partial<typeof schema.prospects.$inferInsert> = {};
  if (p.ownerUserId !== undefined && p.ownerUserId !== cur.ownerUserId) {
    if (!actor.canAssign) throw new AppError('forbidden', 'attribution réservée');
    if (p.ownerUserId) await assertMember(tx, p.ownerUserId);
    set.ownerUserId = p.ownerUserId;
  }
  if (p.stage && p.stage !== cur.stageKey) {
    await assertStage(tx, actor.orgId, p.stage);
    set.stageKey = p.stage;
    set.stageChangedAt = new Date();
  }
  if (p.valueAmount !== undefined) set.valueAmount = p.valueAmount;
  if (p.qualification && p.qualification !== cur.qualification) set.qualification = p.qualification;
  if (Object.keys(set).length) {
    await tx
      .update(schema.prospects)
      .set({ ...set, updatedAt: sql`now()` })
      .where(eq(schema.prospects.id, id));
  }
  const log = (type: Parameters<typeof logActivity>[1]['type'], payload: Record<string, unknown>) =>
    logActivity(tx, {
      orgId: actor.orgId,
      prospectId: id,
      actorUserId: actor.userId,
      type,
      payload,
    });
  if (set.stageKey) await log('stage_changed', { from: cur.stageKey, to: set.stageKey });
  if (set.ownerUserId !== undefined)
    await log('owner_changed', { from: cur.ownerUserId, to: set.ownerUserId });
  if (set.qualification)
    await log('qualification_changed', { from: cur.qualification, to: set.qualification });
  if (p.note) await log('note', { text: p.note });
  if (set.stageKey)
    await runAutomations(tx, actor.orgId, {
      type: 'stage_changed',
      prospectId: id,
      stage: set.stageKey,
    });
  const [after] = await tx.select().from(schema.prospects).where(eq(schema.prospects.id, id));
  return after!;
}

export const bulkSchema = z
  .object({
    ids: z.array(z.uuid()).min(1).max(500),
    action: z.discriminatedUnion('type', [
      z.object({ type: z.literal('add_to_list'), listId: z.uuid() }).strict(),
      z.object({ type: z.literal('remove_from_list'), listId: z.uuid() }).strict(),
      z
        .object({ type: z.literal('move_stage'), stage: z.string().regex(/^[a-z0-9_]{2,40}$/) })
        .strict(),
      z.object({ type: z.literal('assign'), ownerUserId: z.uuid().nullable() }).strict(),
      z.object({ type: z.literal('enroll'), sequenceId: z.uuid() }).strict(),
      z.object({ type: z.literal('qualify'), qualification: z.enum(QUALIFICATIONS) }).strict(),
    ]),
  })
  .strict();
export type BulkInput = z.infer<typeof bulkSchema>;

/** Actions groupées : seuls les prospects VISIBLES par l'acteur sont touchés. */
export async function bulkAction(
  tx: Transaction,
  actor: Actor,
  b: BulkInput,
): Promise<{ affected: number; skipped: number }> {
  const ids = await visibleIds(tx, actor, [...new Set(b.ids)]);
  const a = b.action;
  let affected = 0;
  if (a.type === 'add_to_list' || a.type === 'remove_from_list') {
    const [list] = await tx
      .select({ id: schema.prospectLists.id })
      .from(schema.prospectLists)
      .where(eq(schema.prospectLists.id, a.listId));
    if (!list) throw new AppError('not_found');
    if (a.type === 'add_to_list') {
      const rows = ids.length
        ? await tx
            .insert(schema.prospectListItems)
            .values(
              ids.map((prospectId) => ({
                organizationId: actor.orgId,
                listId: a.listId,
                prospectId,
                addedBy: actor.userId,
              })),
            )
            .onConflictDoNothing()
            .returning({ id: schema.prospectListItems.id })
        : [];
      affected = rows.length;
    } else {
      const rows = ids.length
        ? await tx
            .delete(schema.prospectListItems)
            .where(
              and(
                eq(schema.prospectListItems.listId, a.listId),
                inArray(schema.prospectListItems.prospectId, ids),
              ),
            )
            .returning({ id: schema.prospectListItems.id })
        : [];
      affected = rows.length;
    }
  } else if (a.type === 'enroll') {
    for (const id of ids) if (await enroll(tx, actor, a.sequenceId, id)) affected++;
  } else {
    if (a.type === 'assign' && !actor.canAssign)
      throw new AppError('forbidden', 'attribution réservée');
    for (const id of ids) {
      const patch: ProspectPatch =
        a.type === 'move_stage'
          ? { stage: a.stage }
          : a.type === 'assign'
            ? { ownerUserId: a.ownerUserId }
            : { qualification: a.qualification };
      await patchProspect(tx, actor, id, patch);
      affected++;
    }
  }
  return { affected, skipped: b.ids.length - ids.length };
}

/** Statut d'email lisible pour la liste : valid, risky, invalid, none. */
export function emailStatusOf(statuses: string[]): 'valid' | 'risky' | 'invalid' | 'none' {
  if (statuses.length === 0) return 'none';
  if (statuses.includes('valid')) return 'valid';
  if (statuses.some((s) => ['accept_all', 'unknown', 'webmail', 'risky'].includes(s)))
    return 'risky';
  return 'invalid';
}

/** Filtres d'une vue enregistrée (mêmes clés que GET /api/prospects). */
export const viewFiltersSchema = z
  .object({
    campaignId: z.uuid().optional(),
    status: z.string().max(20).optional(),
    stage: z.string().max(40).optional(),
    ownerUserId: z.uuid().optional(),
    listId: z.uuid().optional(),
    qualification: z.enum(['unqualified', 'qualified', 'disqualified']).optional(),
    delivered: z.enum(['true', 'false']).optional(),
    minScore: z.int().min(0).max(100).optional(),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    kind: z.string().max(20).optional(),
    q: z.string().max(100).optional(),
    sort: z.enum(['score', 'recent', 'name']).optional(),
    columns: z.array(z.string().max(40)).max(30).optional(),
  })
  .strict();
