import { z } from 'zod';
import { dataScope } from '@scoutra/auth';
import { withTenant } from '@scoutra/db';
import { campaignView, latestTarget, loadCampaign, scopeOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Détail : campagne, fiche de cible (dernière version), estimation, sources, compteurs. */
export const GET = apiRoute(
  { action: 'campaign:read', params: z.object({ id: z.uuid() }) },
  async ({ params, ctx }) => {
    const owner = scopeOf(ctx, dataScope(ctx.role));
    const db = await appDb();
    const out = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
      const c = await loadCampaign(tx, params.id, owner);
      return { ...campaignView(c), target: await latestTarget(tx, c.id) };
    });
    return json(out);
  },
);
