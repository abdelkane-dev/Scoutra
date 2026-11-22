import { AppError } from '@scoutra/core';
import { DELIVERY_CREDITS, MILLICREDITS_PER_CREDIT, type PlanConfig } from '@scoutra/billing';
import {
  and,
  count,
  eq,
  inArray,
  reserveCredits,
  schema,
  sql,
  withTenant,
  type Database,
  appendCampaignEvent,
} from '@scoutra/db';
import type { PgBoss } from 'pg-boss';
import { campaignFinalizeJob, campaignInterpretJob, campaignPlanJob } from './jobs';
import { cancelTenantJobs, publishTenantJob } from './tenant-jobs';

/** Démarre l'interprétation d'une campagne (statut interpreting). */
export async function startInterpretation(
  boss: PgBoss,
  db: Database,
  o: { orgId: string; userId: string; campaignId: string; locale: 'fr' | 'en' },
): Promise<void> {
  await publishTenantJob(
    boss,
    db,
    campaignInterpretJob,
    { organizationId: o.orgId, campaignId: o.campaignId, locale: o.locale },
    {
      userId: o.userId,
      refType: 'campaign',
      refId: o.campaignId,
    },
  );
}

/**
 * Lancement (contrôlé côté serveur) : statut awaiting_confirmation requis, quotas de la formule
 * (campagnes simultanées), réservation des crédits (SaaS) puis planification.
 */
export async function launchCampaign(
  boss: PgBoss,
  db: Database,
  o: {
    orgId: string;
    userId: string;
    campaignId: string;
    mode: 'saas' | 'license';
    plan: PlanConfig;
    budgetCredits?: number;
  },
): Promise<{ reservedMc: number }> {
  const reservedMc = await withTenant(db, { orgId: o.orgId, userId: o.userId }, async (tx) => {
    const [c] = await tx
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, o.campaignId))
      .for('update');
    if (!c) throw new AppError('not_found');
    if (c.status !== 'awaiting_confirmation') throw new AppError('conflict', 'statut');
    if (o.mode === 'saas') {
      const [running] = await tx
        .select({ n: count() })
        .from(schema.campaigns)
        .where(inArray(schema.campaigns.status, ['interpreting', 'running', 'cancelling']));
      if ((running?.n ?? 0) >= o.plan.concurrentCampaigns)
        throw new AppError('quota_exceeded', 'campagnes simultanées');
    }
    let reserved = 0;
    if (o.mode === 'saas') {
      const per =
        DELIVERY_CREDITS[c.quality as keyof typeof DELIVERY_CREDITS] * MILLICREDITS_PER_CREDIT;
      const max = Math.min(
        c.maxProspects * per,
        (o.budgetCredits ?? Number.MAX_SAFE_INTEGER / MILLICREDITS_PER_CREDIT) *
          MILLICREDITS_PER_CREDIT,
      );
      reserved = await reserveCredits(tx, {
        orgId: o.orgId,
        campaignId: c.id,
        maxMc: Math.floor(max),
        minMc: per,
      });
    }
    await tx
      .update(schema.campaigns)
      .set({
        status: 'running',
        startedAt: sql`now()`,
        creditBudget: Math.floor(reserved / MILLICREDITS_PER_CREDIT),
        updatedAt: sql`now()`,
      })
      .where(eq(schema.campaigns.id, c.id));
    await appendCampaignEvent(tx, {
      orgId: o.orgId,
      campaignId: c.id,
      type: 'campaign.status',
      payload: { status: 'running', reservedMc: reserved },
    });
    return reserved;
  });
  await publishTenantJob(
    boss,
    db,
    campaignPlanJob,
    { organizationId: o.orgId, campaignId: o.campaignId },
    { userId: o.userId, refType: 'campaign', refId: o.campaignId },
  );
  return { reservedMc };
}

/**
 * Annulation : statut cancelling, tâches en file annulées (suivi sous RLS), clôture planifiée
 * (remboursement de la réservation non consommée ; les prospects déjà trouvés sont conservés).
 */
export async function cancelCampaign(
  boss: PgBoss,
  db: Database,
  o: { orgId: string; userId: string; campaignId: string },
): Promise<void> {
  const prev = await withTenant(db, { orgId: o.orgId, userId: o.userId }, async (tx) => {
    const [c] = await tx
      .update(schema.campaigns)
      .set({
        status: sql`case when ${schema.campaigns.status} in ('draft', 'interpreting', 'awaiting_confirmation') then 'cancelled'::campaign_status else 'cancelling'::campaign_status end`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(schema.campaigns.id, o.campaignId),
          inArray(schema.campaigns.status, [
            'draft',
            'interpreting',
            'awaiting_confirmation',
            'running',
            'paused',
          ]),
        ),
      )
      .returning({ status: schema.campaigns.status });
    if (!c) {
      const [exists] = await tx
        .select({ id: schema.campaigns.id })
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, o.campaignId));
      throw new AppError(exists ? 'conflict' : 'not_found');
    }
    await appendCampaignEvent(tx, {
      orgId: o.orgId,
      campaignId: o.campaignId,
      type: 'campaign.status',
      payload: { status: c.status },
    });
    return c.status;
  });
  await cancelTenantJobs(boss, db, o.orgId, { refType: 'campaign', refId: o.campaignId });
  if (prev === 'cancelling')
    await publishTenantJob(
      boss,
      db,
      campaignFinalizeJob,
      { organizationId: o.orgId, campaignId: o.campaignId },
      { refType: 'campaign', refId: o.campaignId },
    );
}
