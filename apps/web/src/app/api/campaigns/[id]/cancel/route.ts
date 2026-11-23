import { z } from 'zod';
import { dataScope } from '@scoutra/auth';
import { withTenant } from '@scoutra/db';
import { cancelCampaign } from '@scoutra/queue';
import { loadCampaign, scopeOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';
import { getBoss } from '@/server/queue';

export const dynamic = 'force-dynamic';

/** Annulation : tâches en file annulées, crédits non consommés remboursés à la clôture. */
export const POST = apiRoute(
  {
    action: 'campaign:write',
    params: z.object({ id: z.uuid() }),
    rateLimit: { max: 20, windowMs: 60_000 },
  },
  async ({ params, ctx }) => {
    const owner = scopeOf(ctx, dataScope(ctx.role));
    const db = await appDb();
    await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      loadCampaign(tx, params.id, owner),
    );
    await cancelCampaign(await getBoss(), db, {
      orgId: ctx.orgId,
      userId: ctx.user.id,
      campaignId: params.id,
    });
    return json({ id: params.id, status: 'cancelling' }, { status: 202 });
  },
);
