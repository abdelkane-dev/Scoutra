import {
  and,
  count,
  eq,
  inArray,
  lt,
  ne,
  schema,
  settleCampaign,
  sql,
  withTenant,
} from '@scoutra/db';
import { campaignFinalizeJob, publishTenantJob, type JobPayload } from '@scoutra/queue';
import { emit } from './context';
import type { CampaignDeps } from './deps';

/**
 * Clôture : tant que des tâches de la campagne restent ouvertes (suivi tenant_jobs sous RLS),
 * se replanifie ; sinon règle les crédits (remboursement du non-consommé) et fixe le statut final.
 */
export async function handleFinalize(
  deps: CampaignDeps,
  p: JobPayload<typeof campaignFinalizeJob>,
) {
  const orgId = p.organizationId;
  const state = await withTenant(deps.db, { orgId }, async (tx) => {
    const [c] = await tx
      .select({ status: schema.campaigns.status })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, p.campaignId));
    if (!c || (c.status !== 'running' && c.status !== 'cancelling')) return null;
    // Suivi resté ouvert sans mise à jour depuis 20 min (worker arrêté, base indisponible au
    // moment de l'échec) : considéré comme mort, pour que la campagne se clôture quand même.
    await tx
      .update(schema.tenantJobs)
      .set({ status: 'failed', errorCode: 'stale', finishedAt: sql`now()`, updatedAt: sql`now()` })
      .where(
        and(
          eq(schema.tenantJobs.refType, 'campaign'),
          eq(schema.tenantJobs.refId, p.campaignId),
          inArray(schema.tenantJobs.status, ['active', 'retrying']),
          lt(schema.tenantJobs.updatedAt, sql`now() - interval '20 minutes'`),
        ),
      );
    const [open] = await tx
      .select({ n: count() })
      .from(schema.tenantJobs)
      .where(
        and(
          eq(schema.tenantJobs.refType, 'campaign'),
          eq(schema.tenantJobs.refId, p.campaignId),
          ne(schema.tenantJobs.kind, campaignFinalizeJob.name),
          inArray(schema.tenantJobs.status, ['queued', 'active', 'retrying']),
        ),
      );
    return { status: c.status, open: open?.n ?? 0 };
  });
  if (!state) return { skipped: true };
  if (state.open > 0) {
    await publishTenantJob(
      deps.boss,
      deps.db,
      campaignFinalizeJob,
      { organizationId: orgId, campaignId: p.campaignId },
      { refType: 'campaign', refId: p.campaignId, startAfter: 10 },
    );
    return { waiting: state.open };
  }
  return withTenant(deps.db, { orgId }, async (tx) => {
    const refunded =
      deps.mode === 'saas' ? await settleCampaign(tx, { orgId, campaignId: p.campaignId }) : 0;
    const final = state.status === 'cancelling' ? 'cancelled' : 'completed';
    const [c] = await tx
      .update(schema.campaigns)
      .set({ status: final, finishedAt: sql`now()`, updatedAt: sql`now()` })
      .where(
        and(
          eq(schema.campaigns.id, p.campaignId),
          inArray(schema.campaigns.status, ['running', 'cancelling']),
        ),
      )
      .returning({
        delivered: schema.campaigns.deliveredCount,
        consumedMc: schema.campaigns.consumedMc,
      });
    if (c)
      await emit(tx, orgId, p.campaignId, 'campaign.status', {
        status: final,
        delivered: c.delivered,
        consumedMc: c.consumedMc,
        refundedMc: refunded,
      });
    return { status: final, refundedMc: refunded };
  });
}
