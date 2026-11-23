import { z } from 'zod';
import { dataScope } from '@scoutra/auth';
import { withTenant } from '@scoutra/db';
import { launchCampaign, planFor } from '@scoutra/queue';
import { loadCampaign, scopeOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { getEnv } from '@/server/env';
import { apiRoute, json } from '@/server/http';
import { getBoss } from '@/server/queue';

export const dynamic = 'force-dynamic';

const body = z.object({ budgetCredits: z.int().min(1).max(1_000_000).optional() }).strict();

/**
 * Lancement : quotas de la formule, réservation des crédits (402 insufficient_credits),
 * puis recherche en parallèle. Seuls les prospects livrés sont débités ; le reste est remboursé.
 */
export const POST = apiRoute(
  {
    action: 'campaign:write',
    body,
    params: z.object({ id: z.uuid() }),
    rateLimit: { max: 20, windowMs: 60_000 },
  },
  async ({ body, params, ctx }) => {
    const owner = scopeOf(ctx, dataScope(ctx.role));
    const db = await appDb();
    const plan = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
      await loadCampaign(tx, params.id, owner);
      return (await planFor(tx, new Date())).plan;
    });
    const r = await launchCampaign(await getBoss(), db, {
      orgId: ctx.orgId,
      userId: ctx.user.id,
      campaignId: params.id,
      mode: getEnv().SCOUTRA_MODE,
      plan,
      budgetCredits: body.budgetCredits,
    });
    return json(
      { id: params.id, status: 'running', reservedCredits: r.reservedMc / 1000 },
      { status: 202 },
    );
  },
);
