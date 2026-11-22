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
