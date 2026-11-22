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
