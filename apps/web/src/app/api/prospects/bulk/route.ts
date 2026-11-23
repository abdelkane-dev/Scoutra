import { bulkAction, bulkSchema } from '@scoutra/crm';
import { withTenant } from '@scoutra/db';
import { actorOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/**
 * Actions groupées (≤ 500) : liste, étape du pipeline, séquence, attribution (prospect:assign),
 * qualification. Seuls les prospects visibles par l'utilisateur sont touchés.
 */
export const POST = apiRoute(
  { action: 'prospect:write', body: bulkSchema, rateLimit: { max: 30, windowMs: 60_000 } },
  async ({ body, ctx }) => {
    const db = await appDb();
    const r = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      bulkAction(tx, actorOf(ctx), body),
    );
    return json(r);
  },
);
