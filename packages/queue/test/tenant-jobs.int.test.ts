import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { schema, withTenant } from '@scoutra/db';
import {
  campaignFinalizeJob,
  cancelTenantJobs,
  createBoss,
  getTenantJob,
  publishTenantJob,
  workTenant,
  type Boss,
} from '../src';
import { handles, seedOrgAndOwner } from '../../db/test/helpers';

const info = inject('db');

async function waitFor<T>(fn: () => Promise<T | null | undefined>, timeoutMs = 15_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('délai dépassé');
    await new Promise((r) => setTimeout(r, 150));
  }
}

/** Décision « file pg-boss » (constat 7) : isolation des tâches métier. */
describe.skipIf(!info.available)('tâches métier suivies sous RLS (tenant_jobs)', () => {
  let h: ReturnType<typeof handles>;
  let boss: Boss;
  let A: { orgId: string; userId: string };
  let B: { orgId: string; userId: string };
  const seen: string[] = [];
  const campaignA = '00000000-0000-4000-8000-00000000000a';

  beforeAll(async () => {
    h = handles(info);
    A = await seedOrgAndOwner(h.auth, 'tj-a');
    B = await seedOrgAndOwner(h.auth, 'tj-b');
    boss = createBoss(info.appUrl);
    boss.on('error', () => undefined);
    await boss.start();
    await workTenant(boss, h.app.db, campaignFinalizeJob, async (p) => {
      seen.push(`${p.organizationId}:${p.trackingId}`);
      return { ok: true };
    });
  });
  afterAll(async () => {
    await boss.stop({ graceful: false });
    await Promise.all([h.app.close(), h.auth.close(), h.migrator.close()]);
  });

  it('publication → traitement → état lu sous RLS ; invisible pour une autre organisation', async () => {
    const id = await publishTenantJob(
      boss,
      h.app.db,
      campaignFinalizeJob,
      { organizationId: A.orgId, campaignId: campaignA },
      { userId: A.userId, refType: 'campaign', refId: campaignA },
    );
    const done = await waitFor(async () => {
      const j = await getTenantJob(h.app.db, A.orgId, id);
      return j?.status === 'completed' ? j : null;
    });
    expect(done.attempts).toBe(1);
    expect(await getTenantJob(h.app.db, B.orgId, id)).toBeNull();
    expect(seen).toContain(`${A.orgId}:${id}`);
  });

  it('tâche forgée (suivi d’une autre organisation) : refusée sans exécuter le gestionnaire', async () => {
    const [rowB] = await withTenant(h.app.db, B, (tx) =>
      tx
        .insert(schema.tenantJobs)
        .values({ organizationId: B.orgId, kind: campaignFinalizeJob.name })
        .returning(),
    );
    const before = seen.length;
    const bossId = await boss.send(
      campaignFinalizeJob.name,
      { organizationId: A.orgId, trackingId: rowB!.id, campaignId: campaignA },
      { retryLimit: 0 },
    );
    await waitFor(async () => {
      const j = await boss.getJobById(campaignFinalizeJob.name, bossId!);
      return j?.state === 'failed' ? j : null;
    });
    expect(seen.length).toBe(before);
    const b = await getTenantJob(h.app.db, B.orgId, rowB!.id);
    expect(b?.status).toBe('queued');
  });

  it('annulation par référence : la tâche planifiée est ignorée', async () => {
    const campaign = '00000000-0000-4000-8000-0000000000cc';
    const id = await publishTenantJob(
      boss,
      h.app.db,
      campaignFinalizeJob,
      { organizationId: A.orgId, campaignId: campaign },
      { refType: 'campaign', refId: campaign, startAfter: 3600 },
    );
    expect(
      await cancelTenantJobs(boss, h.app.db, A.orgId, { refType: 'campaign', refId: campaign }),
    ).toBe(1);
    expect((await getTenantJob(h.app.db, A.orgId, id))?.status).toBe('cancelled');
    // B ne peut pas annuler les tâches de A
    expect(
      await cancelTenantJobs(boss, h.app.db, B.orgId, { refType: 'campaign', refId: campaignA }),
    ).toBe(0);
  });
});

describe.skipIf(!info.available)(
  'événements de paiement (idempotents et ordonnés, constat 9)',
  async () => {
    const { applyBillingEvent } = await import('../src');
    const { getCreditBalance, walletBalanceMc } = await import('@scoutra/db');
    it('abonnement, renouvellement avec report 50 %, pack, rejeu et désordre sans effet', async () => {
      const h2 = handles(info);
      try {
        const O = await seedOrgAndOwner(h2.auth, 'bill');
        const base = { organizationId: O.orgId };
        const t = (min: number) => new Date(Date.UTC(2026, 10, 1, 0, min)).toISOString();
        const start = new Date();
        const end = new Date(Date.now() + 30 * 864e5);
        const end2 = new Date(end.getTime() + 30 * 864e5);
        const activated = {
          ...base,
          type: 'subscription.activated' as const,
          eventId: 'evt_a',
          occurredAt: t(1),
          plan: 'research' as const,
          seats: 1,
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          providerRef: 'sub_1',
        };
        expect(await applyBillingEvent(h2.app.db, activated)).toBe('applied');
        expect(await applyBillingEvent(h2.app.db, activated)).toBe('duplicate');
        const pack = {
          ...base,
          type: 'pack.purchased' as const,
          eventId: 'evt_p',
          occurredAt: t(2),
          pack: 'pack_500' as const,
        };
        expect(await applyBillingEvent(h2.app.db, pack)).toBe('applied');
        expect(await applyBillingEvent(h2.app.db, pack)).toBe('duplicate');
        const renewed = {
          ...base,
          type: 'subscription.renewed' as const,
          eventId: 'evt_r',
          occurredAt: t(10),
          periodStart: end.toISOString(),
          periodEnd: end2.toISOString(),
        };
        expect(await applyBillingEvent(h2.app.db, renewed)).toBe('applied');
        // Désordre : une résiliation plus ANCIENNE arrive après le renouvellement → ignorée.
        expect(
          await applyBillingEvent(h2.app.db, {
            ...base,
            type: 'subscription.canceled',
            eventId: 'evt_c_old',
            occurredAt: t(5),
          }),
        ).toBe('stale');
        // Même période renvoyée sous un autre identifiant → ignorée.
        expect(
          await applyBillingEvent(h2.app.db, { ...renewed, eventId: 'evt_r2', occurredAt: t(11) }),
        ).toBe('stale');
        await withTenant(h2.app.db, O, async (tx) => {
          // 1000 (forfait) + 500 (pack) + 500 (report 50 %) + 1000 (nouveau forfait)
          expect(await getCreditBalance(tx, O.orgId)).toBe(3_000_000);
          expect(await walletBalanceMc(tx, O.orgId)).toBe(3_000_000);
          const [sub] = await tx.select().from(schema.subscriptions);
          expect(sub?.status).toBe('active');
        });
      } finally {
        await Promise.all([h2.app.close(), h2.auth.close(), h2.migrator.close()]);
      }
    });
  },
);

describe.skipIf(!info.available)('constat 4 (étape 2) : borne de coût par campagne', async () => {
  const { campaignCostMode } = await import('../src');
  const { recordUsage } = await import('@scoutra/db');
  it('économie à 70 % de la borne, gratuit seul à 100 %, réévalué à chaque appel', async () => {
    const h3 = handles(info);
    try {
      const O = await seedOrgAndOwner(h3.auth, 'cap');
      await withTenant(h3.app.db, O, async (tx) => {
        await tx.insert(schema.subscriptions).values({
          organizationId: O.orgId,
          plan: 'pipeline',
          status: 'active',
          periodStart: new Date(Date.now() - 864e5),
          periodEnd: new Date(Date.now() + 864e5),
          provider: 't',
        });
        const [c] = await tx
          .insert(schema.campaigns)
          .values({
            organizationId: O.orgId,
            name: 'n',
            promptText: 'p',
            prospectingModel: 'b2b',
            reservedMc: 10_000,
          })
          .returning();
        const camp = { id: c!.id, reservedMc: 10_000 }; // borne = max(0,5 $, 10 × 0,04 $) = 0,5 $
        expect(await campaignCostMode(tx, 'saas', camp, new Date())).toBe('normal');
        await recordUsage(tx, {
          orgId: O.orgId,
          campaignId: c!.id,
          kind: 'llm',
          provider: 'x',
          source: 'x',
          costMicroUsd: 360_000,
        });
        expect(await campaignCostMode(tx, 'saas', camp, new Date())).toBe('economy');
        await recordUsage(tx, {
          orgId: O.orgId,
          campaignId: c!.id,
          kind: 'llm',
          provider: 'x',
          source: 'x',
          costMicroUsd: 200_000,
        });
        expect(await campaignCostMode(tx, 'saas', camp, new Date())).toBe('free_only');
        expect(await campaignCostMode(tx, 'license', camp, new Date())).toBe('normal');
      });
    } finally {
      await Promise.all([h3.app.close(), h3.auth.close(), h3.migrator.close()]);
    }
  });
});

describe.skipIf(!info.available)('constat 14 (étape 2) : quotas atomiques', async () => {
  const { launchCampaign } = await import('../src');
  const { grantCredits } = await import('@scoutra/db');
  const { PLANS } = await import('@scoutra/billing');
  it('lancements simultanés : jamais plus que les campagnes simultanées de la formule', async () => {
    const h4 = handles(info);
    const b = createBoss(info.appUrl);
    b.on('error', () => undefined);
    await b.start();
    try {
      const O = await seedOrgAndOwner(h4.auth, 'race');
      const ids = await withTenant(h4.app.db, O, async (tx) => {
        await tx.insert(schema.subscriptions).values({
          organizationId: O.orgId,
          plan: 'research',
          status: 'active',
          periodStart: new Date(Date.now() - 864e5),
          periodEnd: new Date(Date.now() + 864e5),
          provider: 't',
        });
        await grantCredits(tx, {
          orgId: O.orgId,
          origin: 'adjustment',
          amountMc: 100_000,
          expiresAt: new Date(Date.now() + 864e5),
          ref: 'grant-race',
        });
        const rows = await tx
          .insert(schema.campaigns)
          .values(
            [1, 2, 3, 4].map((i) => ({
              organizationId: O.orgId,
              name: `c${i}`,
              promptText: 'p',
              prospectingModel: 'b2b',
              status: 'awaiting_confirmation' as const,
              maxProspects: 5,
            })),
          )
          .returning({ id: schema.campaigns.id });
        return rows.map((r) => r.id);
      });
      const res = await Promise.allSettled(
        ids.map((campaignId) =>
          launchCampaign(b, h4.app.db, {
            orgId: O.orgId,
            userId: O.userId,
            campaignId,
            mode: 'saas',
            plan: PLANS.research,
          }),
        ),
      );
      expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(
        PLANS.research.concurrentCampaigns,
      );
    } finally {
      await b.stop({ graceful: false });
      await Promise.all([h4.app.close(), h4.auth.close(), h4.migrator.close()]);
    }
  });
});
