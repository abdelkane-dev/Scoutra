import { z } from 'zod';
import { enroll, visibleIds } from '@scoutra/crm';
import { withTenant } from '@scoutra/db';
import { actorOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Inscription de prospects visibles à une séquence active (les déjà inscrits sont ignorés). */
export const POST = apiRoute(
  {
    action: 'sequence:enroll',
    params: z.object({ id: z.uuid() }),
    body: z.object({ prospectIds: z.array(z.uuid()).min(1).max(500) }).strict(),
  },
  async ({ params, body, ctx }) => {
    const actor = actorOf(ctx);
    const db = await appDb();
    const r = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
      const ids = await visibleIds(tx, actor, [...new Set(body.prospectIds)]);
      let enrolled = 0;
      for (const id of ids) if (await enroll(tx, actor, params.id, id)) enrolled++;
      return { enrolled, skipped: body.prospectIds.length - enrolled };
    });
    return json(r);
  },
);
