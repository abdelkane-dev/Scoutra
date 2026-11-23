import { z } from 'zod';
import { dataScope } from '@scoutra/auth';
import { withTenant } from '@scoutra/db';
import { pauseCampaign } from '@scoutra/queue';
import { loadCampaign, scopeOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Pause d'une campagne en cours : les tâches se reportent (rien n'est perdu ni débité). */
export const POST = apiRoute(
  {
    action: 'campaign:write',
    params: z.object({ id: z.uuid() }),
    rateLimit: { max: 30, windowMs: 60_000 },
  },
  async ({ params, ctx }) => {
    const owner = scopeOf(ctx, dataScope(ctx.role));
    const db = await appDb();
    await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      loadCampaign(tx, params.id, owner),
    );
    await pauseCampaign(db, { orgId: ctx.orgId, userId: ctx.user.id, campaignId: params.id });
    return json({ id: params.id, status: 'paused' });
  },
);
