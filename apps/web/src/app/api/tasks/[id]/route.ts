import { z } from 'zod';
import { deleteTask, patchTask, taskPatchSchema } from '@scoutra/crm';
import { withTenant } from '@scoutra/db';
import { actorOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

export const PATCH = apiRoute(
  { action: 'task:write', params: z.object({ id: z.uuid() }), body: taskPatchSchema },
  async ({ params, body, ctx }) => {
    const db = await appDb();
    const t = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      patchTask(tx, actorOf(ctx), params.id, body),
    );
    return json({
      id: t.id,
      title: t.title,
      kind: t.kind,
      status: t.status,
      dueAt: t.dueAt,
      endAt: t.endAt,
      prospectId: t.prospectId,
      assigneeUserId: t.assigneeUserId,
      completedAt: t.completedAt,
    });
  },
);

export const DELETE = apiRoute(
  { action: 'task:write', params: z.object({ id: z.uuid() }) },
  async ({ params, ctx }) => {
    const db = await appDb();
    await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      deleteTask(tx, actorOf(ctx), params.id),
    );
    return json({ deleted: true });
  },
);
