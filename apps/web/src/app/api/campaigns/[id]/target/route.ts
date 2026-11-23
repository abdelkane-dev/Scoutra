import { z } from 'zod';
import { dataScope } from '@scoutra/auth';
import { kindsAllowed } from '@scoutra/agents';
import { AppError, targetSpecSchema } from '@scoutra/core';
import { eq, schema, sql, withTenant } from '@scoutra/db';
import { currentCostMode } from '@scoutra/queue';
import {
  availableKeys,
  campaignView,
  latestTarget,
  loadCampaign,
  planCampaign,
  scopeOf,
} from '@/server/campaigns';
import { appDb } from '@/server/db';
import { getEnv } from '@/server/env';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

const body = z
  .object({
    spec: targetSpecSchema,
    maxProspects: z.int().min(5).max(1500).optional(),
    quality: z.enum(['standard', 'careful', 'premium']).optional(),
  })
  .strict();

/**
 * Correction de la fiche de cible avant lancement (nouvelle version) ; l'estimation et les
 * sources sont recalculées et renvoyées.
 */
export const PUT = apiRoute(
  {
    action: 'campaign:write',
    body,
    params: z.object({ id: z.uuid() }),
    rateLimit: { max: 60, windowMs: 60_000 },
  },
  async ({ body, params, ctx }) => {
    const owner = scopeOf(ctx, dataScope(ctx.role));
    const db = await appDb();
    const out = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
      const c = await loadCampaign(tx, params.id, owner);
      if (c.status !== 'awaiting_confirmation') throw new AppError('conflict', 'statut');
      // Types d'entité limités au playbook du modèle (constat 1).
      if (!kindsAllowed(body.spec))
        throw new AppError('invalid_input', 'kinds', [
          { path: 'spec.kinds', code: 'not_in_playbook' },
        ]);
      const prev = await latestTarget(tx, c.id);
      const maxProspects = body.maxProspects ?? c.maxProspects;
      const quality = body.quality ?? (c.quality as 'standard');
      const plan = planCampaign(body.spec, await availableKeys(tx), {
        maxProspects,
        quality,
        costMode: await currentCostMode(tx, getEnv().SCOUTRA_MODE, new Date()),
      });
      await tx.insert(schema.targetProfiles).values({
        organizationId: ctx.orgId,
        campaignId: c.id,
        version: (prev?.version ?? 0) + 1,
        spec: { ...body.spec, _meta: prev?.interpretation ?? null },
        prospectKinds: body.spec.kinds,
        countries: body.spec.countries,
        confirmedByUser: true,
      });
      const [updated] = await tx
        .update(schema.campaigns)
        .set({
          prospectingModel: body.spec.model,
          modelForced: true,
          maxProspects,
          quality,
          estimate: plan.estimate,
          sources: plan.sources,
          degraded: plan.sources.degraded,
          costMode: plan.sources.costMode,
          updatedAt: sql`now()`,
        })
        .where(eq(schema.campaigns.id, c.id))
        .returning();
      return { ...campaignView(updated!), target: await latestTarget(tx, c.id) };
    });
    return json(out);
  },
);
