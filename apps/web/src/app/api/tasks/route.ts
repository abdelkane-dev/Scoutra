import { z } from 'zod';
import { createTask, listTasks, taskInputSchema } from '@scoutra/crm';
import { withTenant } from '@scoutra/db';
import { actorOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';
import { parseQuery } from '@/server/query';

export const dynamic = 'force-dynamic';

const query = z
  .object({
    status: z.enum(['open', 'done', 'cancelled']).optional(),
    due: z.enum(['overdue', 'today', 'week']).optional(),
    mine: z.enum(['true', 'false']).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();

/** Tâches (membre : assignées à lui ou créées par lui ; équipe : toutes). */
export const GET = apiRoute({ action: 'task:read' }, async ({ req, ctx }) => {
  const q = parseQuery(req, query);
  const db = await appDb();
  const items = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
    listTasks(tx, actorOf(ctx), { ...q, mine: q.mine === 'true' }),
  );
  return json({ items });
});

export const POST = apiRoute(
  { action: 'task:write', body: taskInputSchema },
  async ({ body, ctx }) => {
    const db = await appDb();
    const t = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      createTask(tx, actorOf(ctx), body),
    );
    return json(
      {
        id: t.id,
        title: t.title,
        kind: t.kind,
        status: t.status,
        dueAt: t.dueAt,
        endAt: t.endAt,
        prospectId: t.prospectId,
        assigneeUserId: t.assigneeUserId,
      },
      { status: 201 },
    );
  },
);
