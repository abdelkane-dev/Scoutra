import { z } from 'zod';
import { AppError } from '@scoutra/core';
import { listTasks } from '@scoutra/crm';
import { withTenant } from '@scoutra/db';
import { actorOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';
import { parseQuery } from '@/server/query';

export const dynamic = 'force-dynamic';

const query = z.object({ from: z.iso.datetime(), to: z.iso.datetime() }).strict();

/** Agenda : tâches datées entre `from` et `to` (31 jours au plus), y compris rendez-vous. */
export const GET = apiRoute({ action: 'task:read' }, async ({ req, ctx }) => {
  const q = parseQuery(req, query);
  const from = new Date(q.from);
  const to = new Date(q.to);
  if (to <= from || to.getTime() - from.getTime() > 31 * 86_400_000)
    throw new AppError('invalid_input', 'période', [{ path: 'to', code: 'range' }]);
  const db = await appDb();
  const items = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
    listTasks(tx, actorOf(ctx), { from, to, limit: 500 }),
  );
  return json({
    items: items
      .filter((t) => t.status !== 'cancelled')
      .map((t) => ({
        id: t.id,
        title: t.title,
        kind: t.kind,
        start: t.dueAt,
        end: t.endAt ?? (t.dueAt ? new Date(new Date(t.dueAt).getTime() + 30 * 60_000) : null),
        who: t.assigneeName,
        prospectId: t.prospectId,
        prospectName: t.prospectName,
        done: t.status === 'done',
      })),
  });
});
