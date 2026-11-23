import { AppError } from '@scoutra/core';
import {
  DELIVERY_CREDITS,
  MILLICREDITS_PER_CREDIT,
  PLANS,
  TRIAL,
  campaignCostCapMicroUsd,
  costModeFor,
  type CostMode,
  type PlanConfig,
} from '@scoutra/billing';
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
import { costSince, grantCredits, lockOrgQuotas, type Transaction } from '@scoutra/db';

/** Formule de l'organisation (abonnement actif, sinon essai) et début de période. */
export async function planFor(
  tx: Transaction,
  now: Date,
): Promise<{ plan: PlanConfig; periodStart: Date; costCapUsd: number }> {
  const [s] = await tx.select().from(schema.subscriptions);
  if (s && (s.status === 'active' || s.status === 'trialing' || s.status === 'past_due')) {
    const plan = PLANS[s.plan as keyof typeof PLANS] ?? PLANS.research;
    return { plan, periodStart: s.periodStart, costCapUsd: plan.costGuardUsd };
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { plan: PLANS[TRIAL.plan], periodStart: start, costCapUsd: TRIAL.costGuardUsd };
}

/** Garde-fou de coût réel : licence = toujours normal (le client paie ses clés). */
export async function currentCostMode(
  tx: Transaction,
  mode: 'saas' | 'license',
  now: Date,
): Promise<CostMode> {
  if (mode === 'license') return 'normal';
  const { periodStart, costCapUsd } = await planFor(tx, now);
  return costModeFor(await costSince(tx, periodStart), costCapUsd);
}

const RANK: Record<CostMode, number> = { normal: 0, economy: 1, free_only: 2 };

/**
 * Mode de coût EFFECTIF d'une campagne, réévalué à chaque appel coûteux (constat 4) : le plus
 * strict entre le garde-fou de l'organisation et la borne de coût de la campagne
 * (≥ 70 % : économie, ≥ 100 % : gratuit seul). Licence : toujours normal.
 */
export async function campaignCostMode(
  tx: Transaction,
  mode: 'saas' | 'license',
  campaign: { id: string; reservedMc: number },
  now: Date,
): Promise<CostMode> {
  if (mode === 'license') return 'normal';
  const org = await currentCostMode(tx, mode, now);
  const [row] = await tx
    .select({ total: sql<string>`coalesce(sum(${schema.usageEvents.costMicroUsd}), 0)` })
    .from(schema.usageEvents)
    .where(eq(schema.usageEvents.campaignId, campaign.id));
  const camp = costModeFor(
    Number(row?.total ?? 0),
    campaignCostCapMicroUsd(campaign.reservedMc) / 1_000_000,
  );
  return RANK[camp] > RANK[org] ? camp : org;
}

/**
 * Essai sans carte (barème : 100 crédits, coût réel plafonné à 1 $) : octroyé une seule fois
 * (clé d'idempotence `trial`) à une organisation sans abonnement.
 */
export async function ensureTrialCredits(tx: Transaction, orgId: string): Promise<void> {
  const [s] = await tx.select({ id: schema.subscriptions.id }).from(schema.subscriptions);
  if (s) return;
  const [org] = await tx
    .select({ eligible: schema.organizations.trialEligible })
    .from(schema.organizations);
  if (!org?.eligible) return; // pas la première organisation de son propriétaire
  await grantCredits(tx, {
    orgId,
    origin: 'trial',
    amountMc: TRIAL.credits * MILLICREDITS_PER_CREDIT,
    expiresAt: new Date(Date.now() + 30 * 86_400_000),
    ref: 'trial',
  });
}

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
    await lockOrgQuotas(tx, o.orgId); // contrôles de quotas atomiques (constat 14)
    const [c] = await tx
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, o.campaignId))
      .for('update');
    if (!c) throw new AppError('not_found');
    if (c.status !== 'awaiting_confirmation') throw new AppError('conflict', 'statut');
    // Quota re-contrôlé AU LANCEMENT (la fiche a pu être modifiée après la création, constat 5).
    if (o.mode === 'saas' && c.maxProspects > o.plan.maxProspectsPerCampaign)
      throw new AppError('quota_exceeded', 'prospects par campagne');
    if (o.mode === 'saas') {
      const [running] = await tx
        .select({ n: count() })
        .from(schema.campaigns)
        .where(
          inArray(schema.campaigns.status, ['interpreting', 'running', 'paused', 'cancelling']),
        );
      if ((running?.n ?? 0) >= o.plan.concurrentCampaigns)
        throw new AppError('quota_exceeded', 'campagnes simultanées');
    }
    let reserved = 0;
    if (o.mode === 'saas') await ensureTrialCredits(tx, o.orgId);
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

/** Pause : les tâches en cours se reportent d'une minute tant que la campagne est en pause. */
export async function pauseCampaign(
  db: Database,
  o: { orgId: string; userId: string; campaignId: string },
): Promise<void> {
  await setPaused(db, o, 'running', 'paused');
}

/** Reprise d'une campagne en pause. */
export async function resumeCampaign(
  db: Database,
  o: { orgId: string; userId: string; campaignId: string },
): Promise<void> {
  await setPaused(db, o, 'paused', 'running');
}

async function setPaused(
  db: Database,
  o: { orgId: string; userId: string; campaignId: string },
  from: 'running' | 'paused',
  to: 'running' | 'paused',
) {
  await withTenant(db, { orgId: o.orgId, userId: o.userId }, async (tx) => {
    const [c] = await tx
      .update(schema.campaigns)
      .set({ status: to, updatedAt: sql`now()` })
      .where(and(eq(schema.campaigns.id, o.campaignId), eq(schema.campaigns.status, from)))
      .returning({ id: schema.campaigns.id });
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
      payload: { status: to },
    });
  });
}
