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
      tx.insert(schema.automations).values({
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

  it('configuration des étapes : renommage, suppression → prospects ramenés à new', async () => {
    const { replaceStages } = await import('../src');
    await T((tx) =>
      tx.update(schema.prospects).set({ stageKey: 'lost' }).where(eq(schema.prospects.id, p2)),
    );
    const st = await T((tx) =>
      replaceStages(tx, O.orgId, [
        { key: 'new', labelFr: 'À traiter', labelEn: 'To do', kind: 'open' },
        { key: 'won', labelFr: 'Gagné', labelEn: 'Won', kind: 'won' },
      ]),
    );
    expect(st.map((s) => s.key)).toEqual(['new', 'won']);
    const [b] = await T((tx) =>
      tx.select().from(schema.prospects).where(eq(schema.prospects.id, p2)),
    );
    expect(b!.stageKey).toBe('new');
    await expect(
      T((tx) =>
        replaceStages(tx, O.orgId, [{ key: 'won', labelFr: 'G', labelEn: 'W', kind: 'won' }]),
      ),
    ).rejects.toMatchObject({ code: 'invalid_input' });
  });

  it('automatisation sur prospect livré : score et signal', async () => {
    await T((tx) =>
      tx.insert(schema.automations).values({
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

describe.skipIf(!info.available)(
  'CRM : messages et boîte unifiée (aucun envoi automatique)',
  () => {
    it('envoyé à la main → contacté ; réponse saisie → automatisation, fil à deux voix ; portée', async () => {
      const h = handles(info);
      const { patchMessage, listThreads } = await import('../src');
      try {
        const O = await seedOrgAndOwner(h.auth, 'msg');
        const other = randomUUID();
        await h.auth.db
          .insert(schema.users)
          .values({ id: other, name: 'Autre', email: `o-${other}@test.invalid` });
        await h.auth.db
          .insert(schema.members)
          .values({ organizationId: O.orgId, userId: other, role: 'member' });
        const T = <R>(fn: Parameters<typeof withTenant<R>>[2]) => withTenant(h.app.db, O, fn);
        const actor: Actor = { orgId: O.orgId, userId: O.userId, ownerOnly: null, canAssign: true };
        const { p, m } = await T(async (tx) => {
          const [p] = await tx
            .insert(schema.prospects)
            .values({
              organizationId: O.orgId,
              kind: 'company',
              prospectingModel: 'b2b',
              displayName: 'Baobab',
              countryCode: 'SN',
              dedupeKey: `msg-${O.orgId}`,
              ownerUserId: O.userId,
            })
            .returning();
          const [m] = await tx
            .insert(schema.messages)
            .values({
              organizationId: O.orgId,
              prospectId: p!.id,
              channel: 'email',
              language: 'fr',
              subject: 'Bonjour',
              body: 'Premier message',
              generatedBy: 'ai',
              complianceDecision: {},
            })
            .returning();
          await tx.insert(schema.automations).values({
            organizationId: O.orgId,
            name: 'Réponse',
            trigger: 'replied',
            action: 'move_stage',
            actionArg: 'replied',
          });
          return { p: p!, m: m! };
        });
        await T((tx) => patchMessage(tx, actor, m.id, { status: 'sent_manually' }));
        let [pp] = await T((tx) =>
          tx.select().from(schema.prospects).where(eq(schema.prospects.id, p.id)),
        );
        expect(pp!.stageKey).toBe('contacted');
        await expect(
          T((tx) => patchMessage(tx, actor, m.id, { body: 'modifié' })),
        ).rejects.toMatchObject({ code: 'conflict' });
        await T((tx) =>
          patchMessage(tx, actor, m.id, {
            status: 'replied',
            replyText: 'Intéressé, rappelez-moi',
          }),
        );
        [pp] = await T((tx) =>
          tx.select().from(schema.prospects).where(eq(schema.prospects.id, p.id)),
        );
        expect(pp!.stageKey).toBe('replied');
        const threads = await T((tx) => listThreads(tx, actor, { limit: 10 }));
        expect(threads[0]!.items.map((i) => i.from)).toEqual(['me', 'them']);
        expect(threads[0]!.awaitingAction).toBe(true);
        const outsider: Actor = {
          orgId: O.orgId,
          userId: other,
          ownerOnly: other,
          canAssign: false,
        };
        await expect(
          T((tx) => patchMessage(tx, outsider, m.id, { status: 'discarded' })),
        ).rejects.toMatchObject({ code: 'not_found' });
        expect(await T((tx) => listThreads(tx, outsider, { limit: 10 }))).toHaveLength(0);
      } finally {
        await Promise.all([h.app.close(), h.auth.close(), h.migrator.close()]);
      }
    });
  },
);

describe.skipIf(!info.available)('CRM : tâches et agenda', () => {
  it('création, attribution contrôlée, portée du membre, filtres', async () => {
    const h = handles(info);
    const { createTask, listTasks, patchTask } = await import('../src');
    try {
      const O = await seedOrgAndOwner(h.auth, 'tasks');
      const mid = randomUUID();
      await h.auth.db
        .insert(schema.users)
        .values({ id: mid, name: 'Membre', email: `t-${mid}@test.invalid` });
      await h.auth.db
        .insert(schema.members)
        .values({ organizationId: O.orgId, userId: mid, role: 'member' });
      const T = <R>(fn: Parameters<typeof withTenant<R>>[2]) => withTenant(h.app.db, O, fn);
      const lead: Actor = { orgId: O.orgId, userId: O.userId, ownerOnly: null, canAssign: true };
      const mem: Actor = { orgId: O.orgId, userId: mid, ownerOnly: mid, canAssign: false };
      const soon = new Date(Date.now() - 3600_000).toISOString();
      const t1 = await T((tx) =>
        createTask(tx, lead, { title: 'Appeler', kind: 'call', dueAt: soon, assigneeUserId: mid }),
      );
      await T((tx) => createTask(tx, lead, { title: 'Pour moi', kind: 'other' }));
      await expect(
        T((tx) => createTask(tx, mem, { title: 'x', kind: 'other', assigneeUserId: O.userId })),
      ).rejects.toMatchObject({ code: 'forbidden' });
      const mine = await T((tx) => listTasks(tx, mem, { limit: 50 }));
      expect(mine.map((t) => t.title)).toEqual(['Appeler']);
      expect(mine[0]).toMatchObject({ overdue: true, assigneeName: 'Membre' });
      expect(await T((tx) => listTasks(tx, lead, { due: 'overdue', limit: 50 }))).toHaveLength(1);
      const done = await T((tx) => patchTask(tx, mem, t1.id, { status: 'done' }));
      expect(done.completedAt).not.toBeNull();
    } finally {
      await Promise.all([h.app.close(), h.auth.close(), h.migrator.close()]);
    }
  });
});

describe.skipIf(!info.available)('CRM : signaux et recherches enregistrées', () => {
  it('signaux issus des preuves, filtrés par type ; correspondances et nouveautés', async () => {
    const h = handles(info);
    const { listSignals, countMatches } = await import('../src');
    try {
      const O = await seedOrgAndOwner(h.auth, 'sig');
      const T = <R>(fn: Parameters<typeof withTenant<R>>[2]) => withTenant(h.app.db, O, fn);
      const actor: Actor = { orgId: O.orgId, userId: O.userId, ownerOnly: null, canAssign: true };
      await T(async (tx) => {
        const [p] = await tx
          .insert(schema.prospects)
          .values({
            organizationId: O.orgId,
            kind: 'company',
            prospectingModel: 'b2b',
            displayName: 'Kitepay',
            countryCode: 'DE',
            dedupeKey: `sig-${O.orgId}`,
            deliveredAt: new Date(),
            score: 80,
          })
          .returning();
        const base = {
          organizationId: O.orgId,
          prospectId: p!.id,
          sourceCode: 'web',
          collectedAt: new Date(),
          legalBasis: 'legitimate_interest' as const,
          countryCode: 'DE',
        };
        await tx.insert(schema.evidence).values([
          {
            ...base,
            fieldPath: 'signals.funding',
            snippet: 'Levée de 12 M€',
            sourceUrl: 'https://kitepay.example/press',
          },
          { ...base, fieldPath: 'display_name' },
        ]);
      });
      const all = await T((tx) => listSignals(tx, actor, { days: 30, limit: 10 }));
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({
        type: 'funding',
        prospectName: 'Kitepay',
        text: 'Levée de 12 M€',
      });
      expect(
        await T((tx) => listSignals(tx, actor, { types: ['hiring'], days: 30, limit: 10 })),
      ).toHaveLength(0);
      expect(
        await T((tx) => countMatches(tx, actor, { signals: ['funding'], countries: ['DE'] })),
      ).toBe(1);
      expect(await T((tx) => countMatches(tx, actor, { signals: ['hiring'] }))).toBe(0);
      expect(
        await T((tx) => countMatches(tx, actor, { minScore: 50 }, new Date(Date.now() + 1000))),
      ).toBe(0);
    } finally {
      await Promise.all([h.app.close(), h.auth.close(), h.migrator.close()]);
    }
  });
});

describe.skipIf(!info.available)('CRM : rapports réels', () => {
  it('entonnoir cumulé, canaux, pays, crédits, par membre ; portée membre', async () => {
    const h = handles(info);
    const { buildReport, patchMessage } = await import('../src');
    try {
      const O = await seedOrgAndOwner(h.auth, 'rep');
      const T = <R>(fn: Parameters<typeof withTenant<R>>[2]) => withTenant(h.app.db, O, fn);
      const actor: Actor = { orgId: O.orgId, userId: O.userId, ownerOnly: null, canAssign: true };
      const [c] = await T((tx) =>
        tx
          .insert(schema.campaigns)
          .values({
            organizationId: O.orgId,
            name: 'c',
            promptText: 'p',
            prospectingModel: 'b2b',
            status: 'running',
            reservedMc: 10_000,
          })
          .returning(),
      );
      const ps = await T((tx) =>
        tx
          .insert(schema.prospects)
          .values(
            (['new', 'contacted', 'meeting', 'won'] as const).map((stage, i) => ({
              organizationId: O.orgId,
              campaignId: c!.id,
              kind: 'company',
              prospectingModel: 'b2b',
              displayName: `P${i}`,
              countryCode: i < 3 ? 'FR' : 'SN',
              dedupeKey: `rep-${i}-${O.orgId}`,
              deliveredAt: new Date(),
              stageKey: stage,
              ownerUserId: O.userId,
            })),
          )
          .returning(),
      );
      await T(async (tx) => {
        const [m] = await tx
          .insert(schema.messages)
          .values({
            organizationId: O.orgId,
            prospectId: ps[1]!.id,
            channel: 'email',
            language: 'fr',
            body: 'x',
            generatedBy: 'ai',
            complianceDecision: {},
          })
          .returning();
        await patchMessage(tx, actor, m!.id, { status: 'sent_manually' });
        await patchMessage(tx, actor, m!.id, { status: 'replied' });
        await tx.insert(schema.creditConsumptions).values({
          organizationId: O.orgId,
          campaignId: c!.id,
          prospectId: ps[0]!.id,
          amountMc: 2000,
          idempotencyKey: 'rep-k1',
        });
      });
      const r = await T((tx) =>
        buildReport(tx, O.orgId, { days: 30, ownerOnly: null, team: true }),
      );
      expect(r.funnel.map((f) => f.n)).toEqual([4, 3, 2, 2, 1]);
      expect(r.channels[0]).toMatchObject({ channel: 'email', sent: 1, replied: 1, rate: 1 });
      expect(r.countries[0]).toEqual({ cc: 'FR', n: 3 });
      expect(r.credits.at(-1)?.used).toBe(2);
      expect(r.members?.[0]).toMatchObject({ userId: O.userId, prospects: 4, won: 1 });
      const own = await T((tx) =>
        buildReport(tx, O.orgId, { days: 30, ownerOnly: randomUUID(), team: false }),
      );
      expect(own.funnel[0]!.n).toBe(0);
      expect(own.members).toBeUndefined();
    } finally {
      await Promise.all([h.app.close(), h.auth.close(), h.migrator.close()]);
    }
  });
});

describe.skipIf(!info.available)('CRM : oppositions et effacement en cascade', () => {
  it('opposition supprime les coordonnées ; effacement supprime la personne entière ; audit', async () => {
    const h = handles(info);
    const { addSuppression, createRequest, processRequest, subjectHash } = await import('../src');
    const { randomBytes } = await import('node:crypto');
    const hashKey = randomBytes(32);
    try {
      const O = await seedOrgAndOwner(h.auth, 'dsr');
      const T = <R>(fn: Parameters<typeof withTenant<R>>[2]) => withTenant(h.app.db, O, fn);
      const { person, company } = await T(async (tx) => {
        const rows = await tx
          .insert(schema.prospects)
          .values([
            {
              organizationId: O.orgId,
              kind: 'person',
              prospectingModel: 'b2c',
              displayName: 'Post public',
              countryCode: 'FR',
              dedupeKey: `dsr-p-${O.orgId}`,
            },
            {
              organizationId: O.orgId,
              kind: 'company',
              prospectingModel: 'b2b',
              displayName: 'Acme',
              countryCode: 'FR',
              dedupeKey: `dsr-c-${O.orgId}`,
              websiteDomain: 'acme.example',
            },
          ])
          .returning();
        const h1 = subjectHash('email', 'Jean@Mail.example', hashKey).hash;
        for (const p of rows)
          await tx.insert(schema.contacts).values({
            organizationId: O.orgId,
            prospectId: p.id,
            channel: 'email',
            valueEncrypted: {},
            valueHash: h1,
          });
        await tx
          .insert(schema.prospectActivities)
          .values({ organizationId: O.orgId, prospectId: rows[0]!.id, type: 'note', payload: {} });
        return { person: rows[0]!, company: rows[1]! };
      });
      const req = await T((tx) =>
        createRequest(
          tx,
          { orgId: O.orgId, hashKey },
          { type: 'erasure', kind: 'email', value: 'jean@mail.example' },
        ),
      );
      expect(req.subjectHint).toBe('j•••@mail.example');
      const done = await T((tx) =>
        processRequest(tx, { orgId: O.orgId, userId: O.userId }, req.id),
      );
      expect(done.result).toMatchObject({
        contactsDeleted: 2,
        prospectsDeleted: 1,
        suppressed: true,
      });
      await T(async (tx) => {
        const left = await tx.select().from(schema.prospects);
        expect(left.map((p) => p.id)).toEqual([company.id]);
        expect(await tx.select().from(schema.contacts)).toHaveLength(0);
        expect((await tx.select().from(schema.suppressionList)).length).toBe(1);
        expect(
          (await tx.select().from(schema.auditLog)).some(
            (a) => a.action === 'compliance.request_erasure',
          ),
        ).toBe(true);
      });
      void person;
      await expect(
        T((tx) => processRequest(tx, { orgId: O.orgId, userId: O.userId }, req.id)),
      ).rejects.toMatchObject({ code: 'conflict' });
      const r = await T((tx) =>
        addSuppression(
          tx,
          { orgId: O.orgId, userId: O.userId, hashKey },
          { kind: 'domain', value: 'https://www.acme.example/x', reason: 'opt_out' },
        ),
      );
      expect(r).toMatchObject({ duplicate: false, prospectsSuppressed: 1 });
      const [c] = await T((tx) => tx.select().from(schema.prospects));
      expect(c!.status).toBe('suppressed');
      await expect(
        T((tx) =>
          addSuppression(
            tx,
            { orgId: O.orgId, userId: O.userId, hashKey },
            { kind: 'email', value: 'pas-un-email', reason: 'opt_out' },
          ),
        ),
      ).rejects.toMatchObject({ code: 'invalid_input' });
    } finally {
      await Promise.all([h.app.close(), h.auth.close(), h.migrator.close()]);
    }
  });
});
