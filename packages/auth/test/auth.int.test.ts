import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { loadEnv, webEnvSchema } from '@scoutra/config';
import { and, createDb, eq, schema, type DbHandle } from '@scoutra/db';
import { SIGN_IN_PER_EMAIL, createAuth, type Auth, type EmailMessage } from '../src';

const info = inject('db');
const BASE = 'http://localhost:3000';
const password = 'Mot-de-passe-solide-2026';

describe.skipIf(!info.available)('Better Auth (Postgres réel)', () => {
  let authDb: DbHandle;
  let auth: Auth;
  const outbox: EmailMessage[] = [];
  const H: Record<string, Headers> = {};
  let orgId: string;

  const signUp = (email: string) =>
    auth.api.signUpEmail({ body: { email, password, name: email.split('@')[0]! } });
  async function signIn(email: string): Promise<Headers> {
    const res = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
    expect(res.status).toBe(200);
    return new Headers({
      cookie: res.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    });
  }
  const setTwoFactor = (email: string, on: boolean) =>
    authDb.db
      .update(schema.users)
      .set({ twoFactorEnabled: on })
      .where(eq(schema.users.email, email));
  const verifyAll = () => authDb.db.update(schema.users).set({ emailVerified: true });
  async function inviteAndJoin(by: Headers, email: string, role: 'admin' | 'member') {
    const inv = await auth.api.createInvitation({
      headers: by,
      body: { email, role, organizationId: orgId },
    });
    await signUp(email);
    await verifyAll();
    H[email] = await signIn(email);
    await auth.api.acceptInvitation({ headers: H[email], body: { invitationId: inv.id } });
    return inv;
  }
  const memberOf = async (email: string) => {
    const [row] = await authDb.db
      .select({ id: schema.members.id, role: schema.members.role })
      .from(schema.members)
      .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
      .where(and(eq(schema.members.organizationId, orgId), eq(schema.users.email, email)));
    return row!;
  };

  beforeAll(async () => {
    authDb = createDb(info.authUrl, { max: 3 });
    const env = loadEnv(webEnvSchema, {
      NODE_ENV: 'test',
      DATABASE_URL: info.appUrl.replace(/:[^:@/]+@/, `:${randomBytes(16).toString('hex')}@`),
      DATABASE_AUTH_URL: info.authUrl,
      SCOUTRA_MASTER_KEY: randomBytes(32).toString('base64'),
      SCOUTRA_HASH_KEY: randomBytes(32).toString('base64'),
      BETTER_AUTH_SECRET: randomBytes(32).toString('base64url'),
      BETTER_AUTH_URL: BASE,
      SCOUTRA_REQUIRE_EMAIL_VERIFICATION: 'false',
    });
    auth = createAuth({
      env,
      authDb: authDb.db,
      email: { send: async (m) => void outbox.push(m) },
    });
    await authDb.db.delete(schema.users); // amorçage testé sur une table vide
    await authDb.db.delete(schema.rateLimits);
  });
  afterAll(() => authDb.close());

  it('constat 1 : aucun fournisseur « de confiance » ne contourne email_verified', () => {
    const linking = auth.options.account?.accountLinking as
      { trustedProviders?: unknown[]; requireLocalEmailVerified?: boolean } | undefined;
    expect(linking?.trustedProviders ?? []).toEqual([]);
    expect(linking?.requireLocalEmailVerified).not.toBe(false);
  });

  it('le premier compte (installation) peut s’inscrire ; mot de passe en argon2id', async () => {
    const r = await signUp('owner@test.invalid');
    const [acc] = await authDb.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, r.user.id));
    expect(acc?.password?.startsWith('$argon2id$')).toBe(true);
  });

  it('inscription publique fermée ensuite', async () => {
    await expect(signUp('intrus@test.invalid')).rejects.toThrow(/signup_disabled/);
  });

  it('création d’organisation : pays obligatoire et validé, créateur owner', async () => {
    H.owner = await signIn('owner@test.invalid');
    await expect(
      auth.api.createOrganization({
        headers: H.owner,
        body: { name: 'X', slug: 'x', countryCode: 'ZZ' },
      }),
    ).rejects.toThrow(/invalid_country_code/);
    const org = await auth.api.createOrganization({
      headers: H.owner,
      body: { name: 'Démo Bamako', slug: 'demo-bamako', countryCode: 'ml' },
    });
    orgId = org!.id;
    const [row] = await authDb.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, orgId));
    expect(row?.countryCode).toBe('ML');
  });

  it('constat 4 : action sensible refusée à un owner sans 2FA (code two_factor_required)', async () => {
    await expect(
      auth.api.createInvitation({
        headers: H.owner,
        body: { email: 'a@test.invalid', role: 'admin', organizationId: orgId },
      }),
    ).rejects.toThrow(/two_factor_required/);
    await setTwoFactor('owner@test.invalid', true);
  });

  it('invitation : à usage unique, liée à l’email invité', async () => {
    const inv = await auth.api.createInvitation({
      headers: H.owner,
      body: { email: 'member@test.invalid', role: 'member', organizationId: orgId },
    });
    expect(outbox.at(-1)).toMatchObject({ kind: 'invitation', to: 'member@test.invalid' });
    expect(outbox.at(-1)!.url).toContain(inv.id);
    await signUp('member@test.invalid');
    await verifyAll();
    H.member = await signIn('member@test.invalid');
    await expect(
      auth.api.acceptInvitation({ headers: H.owner, body: { invitationId: inv.id } }),
    ).rejects.toThrow();
    await auth.api.acceptInvitation({ headers: H.member, body: { invitationId: inv.id } });
    await expect(
      auth.api.acceptInvitation({ headers: H.member, body: { invitationId: inv.id } }),
    ).rejects.toThrow();
    expect((await memberOf('member@test.invalid')).role).toBe('member');
  });

  describe('constat 2 : routes /organization/* alignées sur la matrice', () => {
    beforeAll(async () => {
      await inviteAndJoin(H.owner!, 'admin@test.invalid', 'admin');
      await setTwoFactor('admin@test.invalid', true);
    });

    it('un admin ne peut pas inviter un autre admin', async () => {
      await expect(
        auth.api.createInvitation({
          headers: H['admin@test.invalid'],
          body: { email: 'admin2@test.invalid', role: 'admin', organizationId: orgId },
        }),
      ).rejects.toThrow(/forbidden/i);
    });

    it('un admin peut inviter un membre', async () => {
      const inv = await auth.api.createInvitation({
        headers: H['admin@test.invalid'],
        body: { email: 'm2@test.invalid', role: 'member', organizationId: orgId },
      });
      expect(inv.role).toBe('member');
    });

    it('un admin ne peut pas promouvoir un membre (changement de rôle réservé au propriétaire)', async () => {
      const m = await memberOf('member@test.invalid');
      await expect(
        auth.api.updateMemberRole({
          headers: H['admin@test.invalid'],
          body: { memberId: m.id, role: 'admin', organizationId: orgId },
        }),
      ).rejects.toThrow(/forbidden/i);
      expect((await memberOf('member@test.invalid')).role).toBe('member');
    });

    it('un admin ne peut pas retirer le propriétaire ; un membre ne peut rien gérer', async () => {
      const owner = await memberOf('owner@test.invalid');
      await expect(
        auth.api.removeMember({
          headers: H['admin@test.invalid'],
          body: { memberIdOrEmail: owner.id, organizationId: orgId },
        }),
      ).rejects.toThrow();
      await expect(
        auth.api.createInvitation({
          headers: H.member!,
          body: { email: 'z@test.invalid', role: 'member', organizationId: orgId },
        }),
      ).rejects.toThrow();
      expect((await memberOf('owner@test.invalid')).role).toBe('owner');
    });

    it('un admin sans 2FA est bloqué sur les actions sensibles', async () => {
      await setTwoFactor('admin@test.invalid', false);
      await expect(
        auth.api.createInvitation({
          headers: H['admin@test.invalid'],
          body: { email: 'm3@test.invalid', role: 'member', organizationId: orgId },
        }),
      ).rejects.toThrow(/two_factor_required/);
      await setTwoFactor('admin@test.invalid', true);
    });

    it('le propriétaire (avec 2FA) peut changer un rôle', async () => {
      const m = await memberOf('member@test.invalid');
      await auth.api.updateMemberRole({
        headers: H.owner!,
        body: { memberId: m.id, role: 'admin', organizationId: orgId },
      });
      expect((await memberOf('member@test.invalid')).role).toBe('admin');
    });
  });

  it('constat 3 : le pays d’établissement n’est pas modifiable, le nom l’est (owner)', async () => {
    await expect(
      auth.api.updateOrganization({
        headers: H.owner,
        body: { organizationId: orgId, data: { countryCode: 'FR' } },
      }),
    ).rejects.toThrow(/country_change_forbidden/);
    await expect(
      auth.api.updateOrganization({
        headers: H.owner,
        body: { organizationId: orgId, data: { countryCode: 'ZZ' } },
      }),
    ).rejects.toThrow();
    await auth.api.updateOrganization({
      headers: H.owner,
      body: { organizationId: orgId, data: { name: 'Démo SARL' } },
    });
    const [row] = await authDb.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, orgId));
    expect(row).toMatchObject({ name: 'Démo SARL', countryCode: 'ML' });
  });

  const attempt = (email: string, ip: string, origin = BASE) =>
    auth.handler(
      new Request(`${BASE}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin, 'x-forwarded-for': ip },
        body: JSON.stringify({ email, password: 'mauvais-mot-de-passe' }),
      }),
    );

  it('limite de tentatives par IP', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++)
      statuses.push((await attempt('owner@test.invalid', '203.0.113.7')).status);
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it('constat 5 : limite par email, même en changeant d’IP à chaque essai', async () => {
    const statuses: number[] = [];
    for (let i = 0; i <= SIGN_IN_PER_EMAIL.max; i++) {
      statuses.push((await attempt('cible@test.invalid', `198.51.100.${i + 1}`)).status);
    }
    expect(statuses.slice(0, SIGN_IN_PER_EMAIL.max).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    // Un autre email n'est pas bloqué.
    expect((await attempt('autre@test.invalid', '198.51.100.200')).status).toBe(401);
  });

  it('mutation depuis une origine non autorisée refusée (CSRF)', async () => {
    const res = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://evil.example',
          cookie: 'scoutra.session_token=x',
        },
        body: JSON.stringify({ email: 'owner@test.invalid', password }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
