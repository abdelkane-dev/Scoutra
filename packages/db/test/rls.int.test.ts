import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { PROSPECTING_MODELS, PROSPECT_KINDS } from '@scoutra/core';
import {
  TENANT_TABLES,
  UnsafeDatabaseRoleError,
  appendLedgerEntry,
  assertRlsEnforcedRole,
  createDb,
  eq,
  getCreditBalance,
  schema,
  sql,
  withTenant,
  writeAudit,
} from '../src';
import { expectPgError, handles, seedOrgAndOwner } from './helpers';

const info = inject('db');
const s = schema;
const hex64 = () => randomBytes(32).toString('hex');

describe.skipIf(!info.available)('isolation multi-locataire (RLS Postgres)', () => {
  let h: ReturnType<typeof handles>;
  let A: { orgId: string; userId: string };
  let B: { orgId: string; userId: string };
  const ids: Record<'A' | 'B', { campaign: string; prospect: string; contact: string }> =
    {} as never;

  async function seedTenantData(t: { orgId: string; userId: string }, key: 'A' | 'B') {
    await withTenant(h.app.db, t, async (tx) => {
      const [c] = await tx
        .insert(s.campaigns)
        .values({
          organizationId: t.orgId,
          createdBy: t.userId,
          name: `Campagne ${key}`,
          promptText: 'PME du BTP à Bamako',
          prospectingModel: 'b2b',
        })
        .returning();
      await tx.insert(s.targetProfiles).values({
        organizationId: t.orgId,
        campaignId: c!.id,
        version: 1,
        spec: { audience: 'b2b' },
        prospectKinds: ['company'],
        countries: ['ML'],
      });
      const [p] = await tx
        .insert(s.prospects)
        .values({
          organizationId: t.orgId,
          campaignId: c!.id,
          kind: 'company',
          prospectingModel: 'b2b',
          displayName: `Société ${key}`,
          countryCode: 'ML',
          dedupeKey: `societe-${key}.ml`,
        })
        .returning();
      const [ct] = await tx
        .insert(s.contacts)
        .values({
          organizationId: t.orgId,
          prospectId: p!.id,
          channel: 'email',
          valueEncrypted: { v: 1 },
          valueHash: hex64(),
        })
        .returning();
      await tx.insert(s.evidence).values({
        organizationId: t.orgId,
        prospectId: p!.id,
        contactId: ct!.id,
        fieldPath: 'contact',
        sourceCode: 'website',
        sourceUrl: 'https://exemple.ml/contact',
        collectedAt: new Date(),
        legalBasis: 'legitimate_interest',
        countryCode: 'ML',
      });
      await tx.insert(s.apiCredentials).values({
        organizationId: t.orgId,
        provider: 'anthropic',
        label: 'principale',
        ciphertext: 'x',
        wrappedDek: 'y',
        keyVersion: 1,
        last4: 'abcd',
      });
      await tx.insert(s.suppressionList).values({
        organizationId: t.orgId,
        valueHash: hex64(),
        channel: 'email',
        reason: 'opt_out',
      });
      await writeAudit(tx, {
        orgId: t.orgId,
        actorType: 'user',
        actorUserId: t.userId,
        action: 'test.seed',
      });
      await appendLedgerEntry(tx, {
        orgId: t.orgId,
        delta: 100,
        reason: 'monthly_grant',
        idempotencyKey: `grant-${t.orgId}`,
      });
      await tx.insert(s.tenantJobs).values({ organizationId: t.orgId, kind: 'test.seed' });
      ids[key] = { campaign: c!.id, prospect: p!.id, contact: ct!.id };
    });
  }

  beforeAll(async () => {
    h = handles(info);
    A = await seedOrgAndOwner(h.auth, 'a');
    B = await seedOrgAndOwner(h.auth, 'b', 'SN');
    await seedTenantData(A, 'A');
    await seedTenantData(B, 'B');
  });
  afterAll(async () => {
    await Promise.all([h.app.close(), h.auth.close(), h.migrator.close()]);
  });

  const dataTables = [
    ['campaigns', s.campaigns],
    ['target_profiles', s.targetProfiles],
    ['prospects', s.prospects],
    ['contacts', s.contacts],
    ['evidence', s.evidence],
    ['api_credentials', s.apiCredentials],
    ['suppression_list', s.suppressionList],
    ['audit_log', s.auditLog],
    ['credit_ledger', s.creditLedger],
    ['members', s.members],
    ['tenant_jobs', s.tenantJobs],
  ] as const;

  it('le rôle applicatif ne peut pas contourner la RLS ; le propriétaire est refusé au démarrage', async () => {
    await expect(assertRlsEnforcedRole(h.app.pool)).resolves.toBe('scoutra_app');
    await expect(assertRlsEnforcedRole(h.migrator.pool)).rejects.toThrow(UnsafeDatabaseRoleError);
  });

  it('catalogue : toute table avec organization_id a la RLS activée ET forcée, et est déclarée', async () => {
    const { rows } = await h.migrator.pool.query<{ table: string; rls: boolean; force: boolean }>(`
      select c.relname as table, c.relrowsecurity as rls, c.relforcerowsecurity as force
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
         and (exists (select 1 from information_schema.columns col where col.table_schema = 'public'
                       and col.table_name = c.relname and col.column_name = 'organization_id')
              or c.relname = 'organizations')`);
    expect(rows.map((r) => r.table).sort()).toEqual([...TENANT_TABLES].sort());
    for (const r of rows) {
      expect(r, r.table).toMatchObject({ rls: true, force: true });
    }
  });

  it.each(dataTables)('%s : chaque organisation ne voit que ses lignes', async (_name, table) => {
    for (const t of [A, B]) {
      const rows = await withTenant(h.app.db, t, (tx) => tx.select().from(table));
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.organizationId === t.orgId)).toBe(true);
    }
  });

  it.each(dataTables)('%s : sans organisation courante, aucune ligne', async (_name, table) => {
    expect(await h.app.db.select().from(table)).toHaveLength(0);
  });

  it('organizations : seule l’organisation courante est visible', async () => {
    const rows = await withTenant(h.app.db, A, (tx) => tx.select().from(s.organizations));
    expect(rows.map((r) => r.id)).toEqual([A.orgId]);
    expect(await h.app.db.select().from(s.organizations)).toHaveLength(0);
  });

  it('écriture refusée avec l’organization_id d’une autre organisation', async () => {
    await expectPgError(
      withTenant(h.app.db, A, (tx) =>
        tx.insert(s.campaigns).values({
          organizationId: B.orgId,
          name: 'intrus',
          promptText: 'x',
          prospectingModel: 'b2b',
        }),
      ),
      ['42501'],
    );
    await expectPgError(
      withTenant(h.app.db, A, (tx) =>
        writeAudit(tx, { orgId: B.orgId, actorType: 'system', action: 'intrusion' }),
      ),
      ['42501'],
    );
    await expectPgError(
      withTenant(h.app.db, A, (tx) =>
        tx.insert(s.creditLedger).values({
          organizationId: B.orgId,
          delta: 1000,
          reason: 'adjustment',
          idempotencyKey: 'vol-de-credits',
        }),
      ),
      ['42501'],
    );
  });

  it('impossible de déplacer une ligne vers une autre organisation (UPDATE)', async () => {
    await expectPgError(
      withTenant(h.app.db, A, (tx) =>
        tx
          .update(s.campaigns)
          .set({ organizationId: B.orgId })
          .where(eq(s.campaigns.id, ids.A.campaign)),
      ),
      ['42501'],
    );
  });

  it('UPDATE et DELETE sur les lignes d’une autre organisation n’affectent rien', async () => {
    await withTenant(h.app.db, A, async (tx) => {
      const upd = await tx
        .update(s.prospects)
        .set({ displayName: 'piraté' })
        .where(eq(s.prospects.id, ids.B.prospect))
        .returning();
      expect(upd).toHaveLength(0);
      const del = await tx
        .delete(s.campaigns)
        .where(eq(s.campaigns.id, ids.B.campaign))
        .returning();
      expect(del).toHaveLength(0);
    });
    const still = await withTenant(h.app.db, B, (tx) =>
      tx.select().from(s.prospects).where(eq(s.prospects.id, ids.B.prospect)),
    );
    expect(still[0]?.displayName).toBe('Société B');
  });

  it('clé étrangère composite : impossible de rattacher un contact au prospect d’une autre organisation', async () => {
    await expectPgError(
      withTenant(h.app.db, A, (tx) =>
        tx.insert(s.contacts).values({
          organizationId: A.orgId,
          prospectId: ids.B.prospect,
          channel: 'email',
          valueEncrypted: {},
          valueHash: hex64(),
        }),
      ),
      ['23503'],
    );
  });

  it('evidence : source, date, base légale et pays sont obligatoires', async () => {
    await expectPgError(
      withTenant(h.app.db, A, (tx) =>
        tx.execute(sql`insert into evidence (organization_id, prospect_id, field_path, source_code, collected_at, legal_basis)
                       values (${A.orgId}, ${ids.A.prospect}, 'display_name', 'osm', now(), 'public_professional')`),
      ),
      ['23502'],
    );
  });

  it('journal d’audit et grand livre en ajout seul (même pour sa propre organisation)', async () => {
    for (const stmt of [
      sql`update audit_log set action = 'falsifié'`,
      sql`delete from audit_log`,
      sql`update credit_ledger set delta = 999999`,
      sql`delete from credit_ledger`,
    ]) {
      await expectPgError(
        withTenant(h.app.db, A, (tx) => tx.execute(stmt)),
        ['42501'],
      );
    }
    // Même le propriétaire des tables est bloqué par le déclencheur.
    await expectPgError(h.migrator.db.execute(sql`truncate audit_log`), ['42501']);
    await expectPgError(h.migrator.db.execute(sql`truncate credit_ledger`), ['42501']);
  });

  it('séparation des rôles : scoutra_app ne lit pas les comptes, scoutra_auth ne lit pas les données métier', async () => {
    for (const t of [
      'users',
      'sessions',
      'accounts',
      'verifications',
      'invitations',
      'two_factors',
    ]) {
      await expectPgError(h.app.pool.query(`select * from ${t} limit 1`), ['42501']);
    }
    for (const t of [
      'prospects',
      'contacts',
      'evidence',
      'api_credentials',
      'audit_log',
      'credit_ledger',
    ]) {
      await expectPgError(h.auth.pool.query(`select * from ${t} limit 1`), ['42501']);
    }
    await expectPgError(h.app.pool.query('create table pirate (id int)'), ['42501']);
  });

  it('le contexte d’organisation ne fuit pas vers la requête suivante du pool', async () => {
    const single = createDb(info.appUrl, { max: 1 });
    try {
      await withTenant(single.db, A, (tx) => tx.select().from(s.campaigns));
      expect(await single.db.select().from(s.campaigns)).toHaveLength(0);
      const { rows } = await single.pool.query<{ v: string | null }>(
        "select current_setting('app.org_id', true) as v",
      );
      expect(rows[0]?.v ?? '').toBe('');
    } finally {
      await single.close();
    }
  });

  it('withTenant refuse un identifiant d’organisation invalide', async () => {
    await expect(withTenant(h.app.db, { orgId: "x' or 1=1 --" }, async () => 1)).rejects.toThrow();
  });

  it('crédits : débits concurrents jamais en dessous de zéro, idempotence', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        withTenant(h.app.db, A, (tx) =>
          appendLedgerEntry(tx, {
            orgId: A.orgId,
            delta: -30,
            reason: 'usage',
            idempotencyKey: `usage-test-${i}`,
          }),
        ),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    const balance = await withTenant(h.app.db, A, (tx) => getCreditBalance(tx, A.orgId));
    expect(balance).toBe(10);
    const again = await withTenant(h.app.db, A, (tx) =>
      appendLedgerEntry(tx, {
        orgId: A.orgId,
        delta: 100,
        reason: 'monthly_grant',
        idempotencyKey: `grant-${A.orgId}`,
      }),
    );
    expect(again).toBe(false);
    expect(await withTenant(h.app.db, B, (tx) => getCreditBalance(tx, B.orgId))).toBe(100);
  });

  it('tables de référence synchronisées avec @scoutra/core', async () => {
    const models = await withTenant(h.app.db, A, (tx) => tx.select().from(s.prospectingModels));
    expect(models.map((m) => m.code).sort()).toEqual(PROSPECTING_MODELS.map((m) => m.code).sort());
    for (const m of PROSPECTING_MODELS) {
      const row = models.find((r) => r.code === m.code)!;
      expect(row.involvesIndividuals).toBe(m.involvesIndividuals);
      expect(row.defaultKinds).toEqual([...m.defaultKinds]);
    }
    const kinds = await h.app.db.select().from(s.prospectKinds);
    expect(kinds.map((k) => k.code).sort()).toEqual([...PROSPECT_KINDS].sort());
    await expectPgError(
      h.app.pool.query("insert into prospecting_models values ('pirate', false, '{}', true)"),
      ['42501'],
    );
  });
});

describe.skipIf(!info.available)('constat 13 (étape 2) : aucun débit après clôture', async () => {
  const { consumeCredits, reserveCredits, grantCredits } = await import('../src');
  it('consommation refusée sur une campagne non active', async () => {
    const h = handles(info);
    try {
      const O = await seedOrgAndOwner(h.auth, 'closed');
      await withTenant(h.app.db, O, async (tx) => {
        await grantCredits(tx, {
          orgId: O.orgId,
          origin: 'adjustment',
          amountMc: 5000,
          expiresAt: new Date(Date.now() + 864e5),
          ref: 'g1',
        });
        const [c] = await tx
          .insert(schema.campaigns)
          .values({
            organizationId: O.orgId,
            name: 'n',
            promptText: 'p',
            prospectingModel: 'b2b',
            status: 'running',
          })
          .returning();
        await reserveCredits(tx, { orgId: O.orgId, campaignId: c!.id, maxMc: 3000, minMc: 1000 });
        expect(
          await consumeCredits(tx, {
            orgId: O.orgId,
            campaignId: c!.id,
            prospectId: c!.id,
            amountMc: 1000,
            key: 'k1',
          }),
        ).toBe('consumed');
        await tx
          .update(schema.campaigns)
          .set({ status: 'completed' })
          .where(eq(schema.campaigns.id, c!.id));
        expect(
          await consumeCredits(tx, {
            orgId: O.orgId,
            campaignId: c!.id,
            prospectId: c!.id,
            amountMc: 1000,
            key: 'k2',
          }),
        ).toBe('campaign_closed');
        expect(
          await consumeCredits(tx, {
            orgId: O.orgId,
            campaignId: c!.id,
            prospectId: c!.id,
            amountMc: 1000,
            key: 'k1',
          }),
        ).toBe('already');
      });
    } finally {
      await Promise.all([h.app.close(), h.auth.close(), h.migrator.close()]);
    }
  });
});

describe.skipIf(!info.available)(
  'constat 18 (étape 2) : portefeuilles figés sauf le solde',
  async () => {
    const { grantCredits } = await import('../src');
    it('expiration, montant octroyé et origine non modifiables par l’application', async () => {
      const h = handles(info);
      try {
        const O = await seedOrgAndOwner(h.auth, 'wguard');
        await withTenant(h.app.db, O, (tx) =>
          grantCredits(tx, {
            orgId: O.orgId,
            origin: 'pack',
            amountMc: 1000,
            expiresAt: new Date(Date.now() + 864e5),
            ref: 'pack-guard',
          }),
        );
        for (const set of [
          { expiresAt: new Date(Date.now() + 1e12) },
          { grantedMc: 999_999 },
          { origin: 'plan' },
        ]) {
          await expectPgError(
            withTenant(h.app.db, O, (tx) => tx.update(schema.creditBuckets).set(set)),
            ['42501'],
          );
        }
        await withTenant(h.app.db, O, (tx) =>
          tx.update(schema.creditBuckets).set({ remainingMc: 500 }),
        );
        await expectPgError(
          withTenant(h.app.db, O, (tx) => tx.delete(schema.creditBuckets)),
          ['42501'],
        );
      } finally {
        await Promise.all([h.app.close(), h.auth.close(), h.migrator.close()]);
      }
    });
  },
);
