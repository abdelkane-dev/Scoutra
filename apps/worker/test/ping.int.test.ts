import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { schema, withTenant } from '@scoutra/db';
import {
  createBoss,
  InvalidJobPayloadError,
  getJobForOrg,
  pingJob,
  publish,
  work,
  type Boss,
} from '@scoutra/queue';
import { handlePing } from '../src/handlers/ping';
import { handles, seedOrgAndOwner } from '../../../packages/db/test/helpers';

const info = inject('db');

async function waitFor<T>(fn: () => Promise<T | null>, timeoutMs = 15_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('délai dépassé');
    await new Promise((r) => setTimeout(r, 200));
  }
}

describe.skipIf(!info.available)('tâche ping de bout en bout (pg-boss + RLS)', () => {
  let h: ReturnType<typeof handles>;
  let boss: Boss;
  let A: { orgId: string; userId: string };
  let B: { orgId: string; userId: string };

  beforeAll(async () => {
    h = handles(info);
    A = await seedOrgAndOwner(h.auth, 'ping-a');
    B = await seedOrgAndOwner(h.auth, 'ping-b');
    boss = createBoss(info.appUrl, { supervise: false }); // rôle applicatif, sans migration
    boss.on('error', () => undefined);
    await boss.start();
    await work(boss, pingJob, (payload, { jobId }) => handlePing(h.app.db, payload, jobId));
  });
  afterAll(async () => {
    await boss.stop({ graceful: false });
    await Promise.all([h.app.close(), h.auth.close(), h.migrator.close()]);
  });

  it('web publie → worker traite → audit écrit dans la bonne organisation seulement', async () => {
    const jobId = await publish(boss, pingJob, {
      organizationId: A.orgId,
      requestedBy: A.userId,
      message: 'bonjour',
    });
    const done = await waitFor(async () => {
      const j = await getJobForOrg(boss, pingJob, jobId, A.orgId);
      return j && j.state === 'completed' ? j : null;
    });
    expect(done.output).toMatchObject({ pong: true, organizationId: A.orgId });

    const auditA = await withTenant(h.app.db, A, (tx) => tx.select().from(schema.auditLog));
    expect(auditA.some((r) => r.action === 'queue.ping' && r.targetId === jobId)).toBe(true);
    const auditB = await withTenant(h.app.db, B, (tx) => tx.select().from(schema.auditLog));
    expect(auditB.some((r) => r.targetId === jobId)).toBe(false);
  });

  it('une autre organisation ne peut pas lire l’état de la tâche', async () => {
    const jobId = await publish(boss, pingJob, {
      organizationId: A.orgId,
      requestedBy: A.userId,
      message: 'secret',
    });
    expect(await getJobForOrg(boss, pingJob, jobId, B.orgId)).toBeNull();
  });

  it('constat 7 : isolation des tâches entre organisations (lecture croisée impossible)', async () => {
    const jobA = await publish(boss, pingJob, {
      organizationId: A.orgId,
      requestedBy: A.userId,
      message: 'a',
    });
    const jobB = await publish(boss, pingJob, {
      organizationId: B.orgId,
      requestedBy: B.userId,
      message: 'b',
    });
    expect(await getJobForOrg(boss, pingJob, jobB, A.orgId)).toBeNull();
    expect(await getJobForOrg(boss, pingJob, jobA, B.orgId)).toBeNull();
    expect((await getJobForOrg(boss, pingJob, jobA, A.orgId))?.id).toBe(jobA);
    // Une tâche sans organisation (forgée hors publish) n'est visible par personne.
    const orphan = await boss.send(pingJob.name, { message: 'sans org' });
    expect(await getJobForOrg(boss, pingJob, orphan!, A.orgId)).toBeNull();
    // Aucune donnée personnelle dans la file : seulement des identifiants et le message court.
    const raw = await boss.getJobById(pingJob.name, jobA);
    expect(Object.keys(raw!.data as object).sort()).toEqual([
      'message',
      'organizationId',
      'requestedBy',
    ]);
  });

  it('charge utile invalide refusée à la publication (Zod)', async () => {
    await expect(
      publish(boss, pingJob, {
        organizationId: 'pas-un-uuid',
        requestedBy: A.userId,
        message: 'x',
      }),
    ).rejects.toThrow(InvalidJobPayloadError);
    await expect(
      publish(boss, pingJob, {
        organizationId: A.orgId,
        requestedBy: A.userId,
        message: 'x',
        extra: 1,
      } as never),
    ).rejects.toThrow(InvalidJobPayloadError);
  });

  it('tâche forgée (demandeur d’une autre organisation) : échoue sans écrire', async () => {
    await expect(
      handlePing(
        h.app.db,
        { organizationId: A.orgId, requestedBy: B.userId, message: 'intrusion' },
        'forge-1',
      ),
    ).rejects.toThrow(/membre/);
    const auditA = await withTenant(h.app.db, A, (tx) => tx.select().from(schema.auditLog));
    expect(auditA.some((r) => r.targetId === 'forge-1')).toBe(false);
  });

  it('tâche forgée insérée directement dans la file : revalidée et rejetée par le worker', async () => {
    const id = await boss.send(pingJob.name, {
      organizationId: A.orgId,
      requestedBy: 'x',
      message: 'y',
    });
    const failed = await waitFor(async () => {
      const j = await boss.getJobById(pingJob.name, id!);
      return j && (j.state === 'failed' || j.state === 'retry') ? j : null;
    });
    expect(['failed', 'retry']).toContain(failed.state);
  });
});
