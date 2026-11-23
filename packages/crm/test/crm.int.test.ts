import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { eq, schema, withTenant } from '@scoutra/db';
import {
  bulkAction,
  enroll,
  listStages,
  memberNames,
  patchProspect,
  runAutomations,
  runEnrollmentStep,
  stopSequencesOnReply,
  type Actor,
} from '../src';
import { handles, seedOrgAndOwner } from '../../db/test/helpers';

const info = inject('db');

describe.skipIf(!info.available)('CRM : prospects, pipeline, automatisations, séquences', () => {
  let h: ReturnType<typeof handles>;
  let O: { orgId: string; userId: string };
  let memberId: string;
  let p1: string;
  let p2: string;
  const owner = (): Actor => ({
    orgId: O.orgId,
    userId: O.userId,
    ownerOnly: null,
    canAssign: true,
  });
  const member = (): Actor => ({
    orgId: O.orgId,
    userId: memberId,
    ownerOnly: memberId,
    canAssign: false,
  });
  const T = <R>(fn: Parameters<typeof withTenant<R>>[2]) => withTenant(h.app.db, O, fn);

  beforeAll(async () => {
    h = handles(info);
    O = await seedOrgAndOwner(h.auth, 'crm');
    memberId = randomUUID();
    await h.auth.db
      .insert(schema.users)
      .values({ id: memberId, name: 'Awa Commerciale', email: `m-${memberId}@test.invalid` });
    await h.auth.db
      .insert(schema.members)
      .values({ organizationId: O.orgId, userId: memberId, role: 'member' });
    [p1, p2] = await T(async (tx) => {
      const rows = await tx
        .insert(schema.prospects)
        .values(
          ['A', 'B'].map((n) => ({
            organizationId: O.orgId,
            kind: 'company',
            prospectingModel: 'b2b',
            displayName: `Société ${n}`,
            countryCode: 'FR',
            dedupeKey: `crm-${n}-${O.orgId}`,
            ownerUserId: n === 'A' ? memberId : O.userId,
            channelDecisions: [
              {
                channel: 'email',
                outcome: 'allow_with_conditions',
                conditions: { footer: 'eu_notice' },
              },
            ],
          })),
        )
        .returning({ id: schema.prospects.id });
      return rows.map((r) => r.id) as [string, string];
    });
  });
  afterAll(async () => {
    await Promise.all([h.app.close(), h.auth.close(), h.migrator.close()]);
  });

  it('étapes par défaut ; noms des membres de l’organisation seulement', async () => {
    const stages = await T((tx) => listStages(tx, O.orgId));
    expect(stages.map((s) => s.key)).toEqual([
      'new',
      'contacted',
      'replied',
      'meeting',
      'won',
      'lost',
    ]);
    const names = await T((tx) => memberNames(tx));
    expect(names.get(memberId)?.name).toBe('Awa Commerciale');
    expect(names.size).toBe(2);
    expect((await h.app.db.execute('select * from app_org_member_names()')).rows).toHaveLength(0);
  });

  it('changement d’étape historisé, automatisation déclenchée ; portée et attribution contrôlées', async () => {
    await T((tx) =>
      tx
        .insert(schema.automations)
        .values({
          organizationId: O.orgId,
          name: 'RDV',
          trigger: 'stage_changed',
          triggerArg: 'meeting',
          action: 'create_task',
          actionArg: 'Préparer le rendez-vous',
        }),
    );
    const after = await T((tx) =>
      patchProspect(tx, member(), p1, { stage: 'meeting', note: 'appel ok' }),
    );
    expect(after.stageKey).toBe('meeting');
    await T(async (tx) => {
      const acts = await tx
        .select()
        .from(schema.prospectActivities)
        .where(eq(schema.prospectActivities.prospectId, p1));
      expect(acts.map((a) => a.type).sort()).toEqual(['automation', 'note', 'stage_changed']);
      const tasks = await tx.select().from(schema.tasks).where(eq(schema.tasks.prospectId, p1));
      expect(tasks[0]).toMatchObject({
        title: 'Préparer le rendez-vous',
        source: 'automation',
        assigneeUserId: memberId,
      });
    });
    await expect(
      T((tx) => patchProspect(tx, member(), p2, { stage: 'won' })),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      T((tx) => patchProspect(tx, member(), p1, { ownerUserId: O.userId })),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      T((tx) => patchProspect(tx, owner(), p1, { ownerUserId: randomUUID() })),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(
      T((tx) => patchProspect(tx, owner(), p1, { stage: 'inconnue' })),
    ).rejects.toMatchObject({ code: 'invalid_input' });
  });

  it('actions groupées : liste, qualification ; seuls les prospects visibles', async () => {
    const [list] = await T((tx) =>
      tx
        .insert(schema.prospectLists)
        .values({ organizationId: O.orgId, name: 'Chauds' })
        .returning(),
    );
    const r = await T((tx) =>
      bulkAction(tx, member(), {
        ids: [p1, p2],
        action: { type: 'add_to_list', listId: list!.id },
      }),
    );
    expect(r).toEqual({ affected: 1, skipped: 1 });
    const q = await T((tx) =>
      bulkAction(tx, owner(), {
        ids: [p1, p2],
        action: { type: 'qualify', qualification: 'qualified' },
      }),
    );
    expect(q.affected).toBe(2);
    await expect(
      T((tx) =>
        bulkAction(tx, member(), { ids: [p1], action: { type: 'assign', ownerUserId: O.userId } }),
      ),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('séquence : étapes dues → tâche puis brouillon (jamais d’envoi) ; une réponse l’arrête', async () => {
    const [seq] = await T((tx) =>
      tx
        .insert(schema.sequences)
        .values({
          organizationId: O.orgId,
          name: 'Relances',
          steps: [
            { day: 0, channel: 'phone', kind: 'task', title: 'Appeler' },
            {
              day: 0,
              channel: 'email',
              kind: 'draft',
              title: 'Relance',
              template: 'Bonjour {{name}}',
            },
            { day: 3, channel: 'email', kind: 'task', title: 'Dernière relance' },
          ],
        })
        .returning(),
    );
    expect(await T((tx) => enroll(tx, owner(), seq!.id, p2))).toBe(true);
    expect(await T((tx) => enroll(tx, owner(), seq!.id, p2))).toBe(false);
    const [e] = await T((tx) => tx.select().from(schema.sequenceEnrollments));
    expect(await T((tx) => runEnrollmentStep(tx, O.orgId, e!.id))).toBe('done');
    expect(await T((tx) => runEnrollmentStep(tx, O.orgId, e!.id))).toBe('done');
    expect(await T((tx) => runEnrollmentStep(tx, O.orgId, e!.id))).toBe('skipped'); // J+3 pas encore dû
    await T(async (tx) => {
      const msgs = await tx
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.prospectId, p2));
      expect(msgs[0]).toMatchObject({
        body: 'Bonjour Société B',
        status: 'draft',
        generatedBy: 'user',
      });
      expect(msgs[0]!.footer).toContain('STOP');
      await stopSequencesOnReply(tx, p2);
      const [after] = await tx.select().from(schema.sequenceEnrollments);
      expect(after!.status).toBe('replied');
    });
  });

  it('automatisation sur prospect livré : score et signal', async () => {
    await T((tx) =>
      tx
        .insert(schema.automations)
        .values({
          organizationId: O.orgId,
          name: 'Top',
          trigger: 'score_above',
          triggerArg: '80',
          action: 'notify',
          actionArg: 'owner',
        }),
    );
    expect(
      await T((tx) =>
        runAutomations(tx, O.orgId, { type: 'delivered', prospectId: p2, score: 70, signals: [] }),
      ),
    ).toBe(0);
    expect(
      await T((tx) =>
        runAutomations(tx, O.orgId, { type: 'delivered', prospectId: p2, score: 90, signals: [] }),
      ),
    ).toBe(1);
    const notes = await T((tx) => tx.select().from(schema.notifications));
    expect(notes[0]).toMatchObject({ userId: O.userId });
  });
});
