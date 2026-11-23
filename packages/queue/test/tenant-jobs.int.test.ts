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

describe.skipIf(!info.available)('événements de paiement (idempotents)', async () => {
  const { applyBillingEvent } = await import('../src');
  const { getCreditBalance, walletBalanceMc } = await import('@scoutra/db');
  it('abonnement, renouvellement avec report 50 %, pack, rejeu sans double crédit', async () => {
    const h2 = handles(info);
    try {
      const O = await seedOrgAndOwner(h2.auth, 'bill');
      const base = { organizationId: O.orgId };
      const start = new Date();
      const end = new Date(Date.now() + 30 * 864e5);
      const activated = {
        ...base,
        type: 'subscription.activated' as const,
        eventId: 'evt_a',
        plan: 'research' as const,
        seats: 1,
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        providerRef: 'sub_1',
      };
      expect(await applyBillingEvent(h2.app.db, activated)).toBe('applied');
      expect(await applyBillingEvent(h2.app.db, activated)).toBe('duplicate');
      expect(
        await applyBillingEvent(h2.app.db, {
          ...base,
          type: 'pack.purchased',
          eventId: 'evt_p',
          pack: 'pack_500',
        }),
      ).toBe('applied');
      expect(
        await applyBillingEvent(h2.app.db, {
          ...base,
          type: 'pack.purchased',
          eventId: 'evt_p',
          pack: 'pack_500',
        }),
      ).toBe('duplicate');
      const end2 = new Date(end.getTime() + 30 * 864e5);
      await applyBillingEvent(h2.app.db, {
        ...base,
        type: 'subscription.renewed',
        eventId: 'evt_r',
        periodStart: end.toISOString(),
        periodEnd: end2.toISOString(),
      });
      await withTenant(h2.app.db, O, async (tx) => {
        // 1000 (forfait) + 500 (pack) + 500 (report 50 %) + 1000 (nouveau forfait)
        expect(await getCreditBalance(tx, O.orgId)).toBe(3_000_000);
        expect(await walletBalanceMc(tx, O.orgId)).toBe(3_000_000);
      });
    } finally {
      await Promise.all([h2.app.close(), h2.auth.close(), h2.migrator.close()]);
    }
  });
});
