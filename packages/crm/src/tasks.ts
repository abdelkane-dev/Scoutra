import { z } from 'zod';
import { AppError } from '@scoutra/core';
import { and, asc, eq, gte, inArray, lt, or, schema, sql, type Transaction } from '@scoutra/db';
import { logActivity, memberNames } from './activity';
import type { Actor } from './prospects';

export const TASK_KINDS = [
  'call',
  'email',
  'whatsapp',
  'meeting',
  'follow_up',
  'linkedin_manual',
  'other',
] as const;

export const taskInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    kind: z.enum(TASK_KINDS).default('other'),
    dueAt: z.iso.datetime().nullable().optional(),
    endAt: z.iso.datetime().nullable().optional(),
    prospectId: z.uuid().nullable().optional(),
    assigneeUserId: z.uuid().nullable().optional(),
  })
  .strict();
export const taskPatchSchema = taskInputSchema
  .partial()
  .extend({ status: z.enum(['open', 'done', 'cancelled']).optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'au moins un champ');

/** Portée des tâches : un membre voit celles qui lui sont assignées ou qu'il a créées. */
function scope(actor: Actor) {
  return actor.ownerOnly
    ? or(eq(schema.tasks.assigneeUserId, actor.userId), eq(schema.tasks.createdBy, actor.userId))
    : undefined;
}

async function checkRefs(
  tx: Transaction,
  actor: Actor,
  i: { prospectId?: string | null; assigneeUserId?: string | null },
) {
  if (i.assigneeUserId && i.assigneeUserId !== actor.userId) {
    if (!actor.canAssign) throw new AppError('forbidden', 'attribution réservée');
    if (!(await memberNames(tx)).has(i.assigneeUserId))
      throw new AppError('invalid_input', 'membre inconnu', [
        { path: 'assigneeUserId', code: 'unknown_member' },
      ]);
  }
  if (i.prospectId) {
    const [p] = await tx
      .select({ id: schema.prospects.id })
      .from(schema.prospects)
      .where(
        and(
          eq(schema.prospects.id, i.prospectId),
          actor.ownerOnly ? eq(schema.prospects.ownerUserId, actor.ownerOnly) : undefined,
        ),
      );
    if (!p) throw new AppError('not_found');
  }
}

export async function createTask(
  tx: Transaction,
  actor: Actor,
  i: z.infer<typeof taskInputSchema>,
) {
  await checkRefs(tx, actor, i);
  const [t] = await tx
    .insert(schema.tasks)
    .values({
      organizationId: actor.orgId,
      prospectId: i.prospectId ?? null,
      assigneeUserId: i.assigneeUserId ?? actor.userId,
      title: i.title,
      kind: i.kind,
      dueAt: i.dueAt ? new Date(i.dueAt) : null,
      endAt: i.endAt ? new Date(i.endAt) : null,
      createdBy: actor.userId,
    })
    .returning();
  if (t!.prospectId)
    await logActivity(tx, {
      orgId: actor.orgId,
      prospectId: t!.prospectId,
      actorUserId: actor.userId,
      type: 'task_created',
      payload: { taskId: t!.id, title: t!.title },
    });
  return t!;
}

export async function patchTask(
  tx: Transaction,
  actor: Actor,
  id: string,
  p: z.infer<typeof taskPatchSchema>,
) {
  const [cur] = await tx
    .select()
    .from(schema.tasks)
    .where(and(eq(schema.tasks.id, id), scope(actor)))
    .for('update');
  if (!cur) throw new AppError('not_found');
  await checkRefs(tx, actor, { assigneeUserId: p.assigneeUserId, prospectId: p.prospectId });
  const set: Partial<typeof schema.tasks.$inferInsert> = {};
  if (p.title !== undefined) set.title = p.title;
  if (p.kind !== undefined) set.kind = p.kind;
  if (p.dueAt !== undefined) set.dueAt = p.dueAt ? new Date(p.dueAt) : null;
  if (p.endAt !== undefined) set.endAt = p.endAt ? new Date(p.endAt) : null;
  if (p.assigneeUserId !== undefined) set.assigneeUserId = p.assigneeUserId;
  if (p.prospectId !== undefined) set.prospectId = p.prospectId;
  if (p.status && p.status !== cur.status) {
    set.status = p.status;
    set.completedAt = p.status === 'done' ? new Date() : null;
  }
  const [t] = await tx.update(schema.tasks).set(set).where(eq(schema.tasks.id, id)).returning();
  if (set.status === 'done' && t!.prospectId)
    await logActivity(tx, {
      orgId: actor.orgId,
      prospectId: t!.prospectId,
      actorUserId: actor.userId,
      type: 'task_done',
      payload: { taskId: id, title: t!.title },
    });
  return t!;
}

export async function deleteTask(tx: Transaction, actor: Actor, id: string) {
  const rows = await tx
    .delete(schema.tasks)
    .where(and(eq(schema.tasks.id, id), scope(actor)))
    .returning({ id: schema.tasks.id });
  if (!rows.length) throw new AppError('not_found');
}

export async function listTasks(
  tx: Transaction,
  actor: Actor,
  o: {
    status?: 'open' | 'done' | 'cancelled';
    due?: 'overdue' | 'today' | 'week';
    mine?: boolean;
    from?: Date;
    to?: Date;
    limit: number;
  },
  now = new Date(),
) {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const due =
    o.due === 'overdue'
      ? lt(schema.tasks.dueAt, now)
      : o.due === 'today'
        ? and(gte(schema.tasks.dueAt, dayStart), lt(schema.tasks.dueAt, dayEnd))
        : o.due === 'week'
          ? and(
              gte(schema.tasks.dueAt, dayStart),
              lt(schema.tasks.dueAt, new Date(dayStart.getTime() + 7 * 86_400_000)),
            )
          : undefined;
  const rows = await tx
    .select()
    .from(schema.tasks)
    .where(
      and(
        scope(actor),
        o.mine ? eq(schema.tasks.assigneeUserId, actor.userId) : undefined,
        o.status ? eq(schema.tasks.status, o.status) : undefined,
        due,
        o.from ? gte(schema.tasks.dueAt, o.from) : undefined,
        o.to ? lt(schema.tasks.dueAt, o.to) : undefined,
      ),
    )
    .orderBy(sql`${schema.tasks.dueAt} asc nulls last`, asc(schema.tasks.createdAt))
    .limit(o.limit);
  const names = await memberNames(tx);
  const pids = [...new Set(rows.map((r) => r.prospectId).filter((x): x is string => !!x))];
  const prospects = pids.length
    ? await tx
        .select({ id: schema.prospects.id, name: schema.prospects.displayName })
        .from(schema.prospects)
        .where(inArray(schema.prospects.id, pids))
    : [];
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    kind: t.kind,
    status: t.status,
    source: t.source,
    dueAt: t.dueAt,
    endAt: t.endAt,
    overdue: t.status === 'open' && !!t.dueAt && t.dueAt < now,
    prospectId: t.prospectId,
    prospectName: prospects.find((p) => p.id === t.prospectId)?.name ?? null,
    assigneeUserId: t.assigneeUserId,
    assigneeName: t.assigneeUserId ? (names.get(t.assigneeUserId)?.name ?? null) : null,
    createdAt: t.createdAt,
  }));
}
