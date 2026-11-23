import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { eq, schema, withTenant } from '../src';
import { expectPgError, handles, seedOrgAndOwner } from './helpers';

const info = inject('db');

describe.skipIf(!info.available)('profil d’organisation (type de compte, secteurs)', () => {
  let h: ReturnType<typeof handles>;
  let A: { orgId: string; userId: string };
  let B: { orgId: string; userId: string };

  beforeAll(async () => {
    h = handles(info);
    A = await seedOrgAndOwner(h.auth, 'profA');
    B = await seedOrgAndOwner(h.auth, 'profB');
  });
  afterAll(async () => {
    await Promise.all([h.app.close(), h.auth.close(), h.migrator.close()]);
  });

  it('l’application met à jour le profil de SON organisation seulement', async () => {
    await withTenant(h.app.db, A, async (tx) => {
      await tx
        .update(schema.organizations)
        .set({ accountType: 'sme', sectors: ['f_construction'] });
    });
    const rows = await h.auth.db
      .select({ id: schema.organizations.id, t: schema.organizations.accountType })
      .from(schema.organizations);
    expect(rows.find((r) => r.id === A.orgId)?.t).toBe('sme');
    expect(rows.find((r) => r.id === B.orgId)?.t).toBeNull();
  });

  it('le pays reste non modifiable par l’application', async () => {
    await expectPgError(
      withTenant(h.app.db, A, (tx) =>
        tx
          .update(schema.organizations)
          .set({ countryCode: 'FR' })
          .where(eq(schema.organizations.id, A.orgId)),
      ),
      ['42501'],
    );
  });

  it('au plus 10 secteurs (contrainte)', async () => {
    await expectPgError(
      withTenant(h.app.db, A, (tx) =>
        tx
          .update(schema.organizations)
          .set({ sectors: Array.from({ length: 11 }, (_, i) => `s${i}`) }),
      ),
      ['23514'],
    );
  });
});

describe.skipIf(!info.available)('playbooks (données initiales)', () => {
  it('23 playbooks actifs, lisibles par l’application, non modifiables par elle', async () => {
    const h = handles(info);
    try {
      const rows = await h.app.db
        .select({ model: schema.playbooks.modelCode, active: schema.playbooks.isActive })
        .from(schema.playbooks);
      expect(rows.filter((r) => r.active)).toHaveLength(23);
      await expectPgError(h.app.db.update(schema.playbooks).set({ isActive: false }), ['42501']);
    } finally {
      await Promise.all([h.app.close(), h.auth.close(), h.migrator.close()]);
    }
  });
});

describe.skipIf(!info.available)(
  'LISTEN/NOTIFY des événements de campagne (constat 3)',
  async () => {
    const { createCampaignEventListener, appendCampaignEvent } = await import('../src');
    it('un insert réveille uniquement les abonnés de la campagne', async () => {
      const h = handles(info);
      const l = createCampaignEventListener(info.appUrl);
      try {
        const O = await seedOrgAndOwner(h.auth, 'listen');
        const [c] = await withTenant(h.app.db, O, (tx) =>
          tx
            .insert(schema.campaigns)
            .values({
              organizationId: O.orgId,
              name: 'n',
              promptText: 'p',
              prospectingModel: 'b2b',
            })
            .returning(),
        );
        let woken = 0;
        let other = 0;
        l.subscribe(c!.id, () => woken++);
        l.subscribe('00000000-0000-4000-8000-000000000000', () => other++);
        await new Promise((r) => setTimeout(r, 500)); // connexion LISTEN établie
        await withTenant(h.app.db, O, (tx) =>
          appendCampaignEvent(tx, { orgId: O.orgId, campaignId: c!.id, type: 'campaign.progress' }),
        );
        for (let i = 0; i < 40 && woken === 0; i++) await new Promise((r) => setTimeout(r, 50));
        expect(woken).toBe(1);
        expect(other).toBe(0);
      } finally {
        await l.close();
        await Promise.all([h.app.close(), h.auth.close(), h.migrator.close()]);
      }
    });
  },
);

describe.skipIf(!info.available)(
  'constat 16 (étape 2) : balayage des campagnes inactives',
  async () => {
    const { staleCampaigns } = await import('../src');
    it('identifiants des campagnes actives inactives seulement, toutes organisations', async () => {
      const h = handles(info);
      try {
        const O1 = await seedOrgAndOwner(h.auth, 'sw1');
        const O2 = await seedOrgAndOwner(h.auth, 'sw2');
        const old = new Date(Date.now() - 3600_000);
        const mk = (
          o: { orgId: string; userId: string },
          status: 'running' | 'completed',
          updatedAt: Date,
        ) =>
          withTenant(
            h.app.db,
            o,
            async (tx) =>
              (
                await tx
                  .insert(schema.campaigns)
                  .values({
                    organizationId: o.orgId,
                    name: 'n',
                    promptText: 'p',
                    prospectingModel: 'b2b',
                    status,
                    updatedAt,
                  })
                  .returning()
              )[0]!.id,
          );
        const a = await mk(O1, 'running', old);
        const b = await mk(O2, 'running', old);
        await mk(O1, 'running', new Date());
        await mk(O2, 'completed', old);
        const ids = (await staleCampaigns(h.app.db)).map((s) => s.campaignId);
        expect(ids).toEqual(expect.arrayContaining([a, b]));
        expect(ids.filter((i) => i === a || i === b)).toHaveLength(2);
        const rows = await staleCampaigns(h.app.db);
        expect(
          rows.every((r) => Object.keys(r).sort().join() === 'campaignId,organizationId'),
        ).toBe(true);
        // Sans contexte d'organisation, la table elle-même reste invisible (RLS).
        expect(await h.app.db.select().from(schema.campaigns)).toHaveLength(0);
      } finally {
        await Promise.all([h.app.close(), h.auth.close(), h.migrator.close()]);
      }
    });
  },
);
