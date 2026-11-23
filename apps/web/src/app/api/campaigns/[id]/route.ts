import { z } from 'zod';
import { dataScope } from '@scoutra/auth';
import { withTenant } from '@scoutra/db';
import { campaignFinalizeJob, publishTenantJob } from '@scoutra/queue';
import { campaignView, latestTarget, loadCampaign, scopeOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';
import { getBoss } from '@/server/queue';

export const dynamic = 'force-dynamic';

/** Détail : campagne, fiche de cible (dernière version), estimation, sources, compteurs. */
export const GET = apiRoute(
  { action: 'campaign:read', params: z.object({ id: z.uuid() }) },
  async ({ params, ctx }) => {
    const owner = scopeOf(ctx, dataScope(ctx.role));
    const db = await appDb();
    const out = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
      const c = await loadCampaign(tx, params.id, owner);
      return { c, view: { ...campaignView(c), target: await latestTarget(tx, c.id) } };
    });
    // Auto-réparation : campagne active sans activité depuis 5 min (worker redémarré, panne de
    // base au moment d'une clôture) → nouvelle vérification de clôture (idempotente).
    const { c } = out;
    if (
      (c.status === 'running' || c.status === 'cancelling') &&
      Date.now() - c.updatedAt.getTime() > 5 * 60_000
    ) {
      await publishTenantJob(
        await getBoss(),
        db,
        campaignFinalizeJob,
        { organizationId: ctx.orgId, campaignId: c.id },
        { refType: 'campaign', refId: c.id, singletonKey: `finalize-heal:${c.id}` },
      );
    }
    return json(out.view);
  },
);
