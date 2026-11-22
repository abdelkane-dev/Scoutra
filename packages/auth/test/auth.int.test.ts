import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { loadEnv, webEnvSchema } from '@scoutra/config';
import { createDb, eq, schema, type DbHandle } from '@scoutra/db';
import { createAuth, type Auth, type EmailMessage } from '../src';

const info = inject('db');
const BASE = 'http://localhost:3000';

describe.skipIf(!info.available)('Better Auth (Postgres réel)', () => {
  let authDb: DbHandle;
  let auth: Auth;
  const outbox: EmailMessage[] = [];
  const password = 'Mot-de-passe-solide-2026';

  async function signUp(email: string) {
    return auth.api.signUpEmail({ body: { email, password, name: email.split('@')[0]! } });
  }
  async function signIn(email: string): Promise<Headers> {
    const res = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
    expect(res.status).toBe(200);
    const cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    return new Headers({ cookie });
  }

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
    // Les autres suites ont pu créer des utilisateurs : on part d'une table vide pour tester l'amorçage.
    await authDb.db.delete(schema.users);
  });
  afterAll(() => authDb.close());

  let ownerHeaders: Headers;
  let orgId: string;

  it('le premier compte (installation) peut s’inscrire ; le mot de passe est en argon2id', async () => {
    const r = await signUp('owner@test.invalid');
    expect(r.user.email).toBe('owner@test.invalid');
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
    ownerHeaders = await signIn('owner@test.invalid');
    await expect(
      auth.api.createOrganization({
        headers: ownerHeaders,
        body: { name: 'Sans pays', slug: 'sans-pays' } as never,
      }),
    ).rejects.toThrow();
    await expect(
      auth.api.createOrganization({
        headers: ownerHeaders,
        body: { name: 'Mauvais', slug: 'mauvais', countryCode: 'ZZ' },
      }),
    ).rejects.toThrow(/invalid_country_code/);
    const org = await auth.api.createOrganization({
      headers: ownerHeaders,
      body: { name: 'Démo Bamako', slug: 'demo-bamako', countryCode: 'ml' },
    });
    orgId = org!.id;
    const [row] = await authDb.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, orgId));
    expect(row?.countryCode).toBe('ML');
    const [m] = await authDb.db
      .select()
      .from(schema.members)
      .where(eq(schema.members.organizationId, orgId));
    expect(m?.role).toBe('owner');
  });

  it('invitation : à usage unique, liée à l’email invité', async () => {
    const inv = await auth.api.createInvitation({
      headers: ownerHeaders,
      body: { email: 'invite@test.invalid', role: 'member', organizationId: orgId },
    });
    expect(outbox.at(-1)).toMatchObject({ kind: 'invitation', to: 'invite@test.invalid' });
    expect(outbox.at(-1)!.url).toContain(inv.id);

    // La personne invitée peut créer son compte malgré l'inscription fermée.
    await signUp('invite@test.invalid');
    // Simule la vérification d'email (exigée avant d'accepter une invitation).
    await authDb.db.update(schema.users).set({ emailVerified: true });
    const inviteeHeaders = await signIn('invite@test.invalid');

    // Un autre compte ne peut pas accepter cette invitation.
    await expect(
      auth.api.acceptInvitation({ headers: ownerHeaders, body: { invitationId: inv.id } }),
    ).rejects.toThrow(/recipient|invitation/i);

    await auth.api.acceptInvitation({ headers: inviteeHeaders, body: { invitationId: inv.id } });
    // Seconde utilisation refusée.
    await expect(
      auth.api.acceptInvitation({ headers: inviteeHeaders, body: { invitationId: inv.id } }),
    ).rejects.toThrow();

    const members = await authDb.db
      .select()
      .from(schema.members)
      .where(eq(schema.members.organizationId, orgId));
    expect(members.map((m) => m.role).sort()).toEqual(['member', 'owner']);
  });

  it('limite de tentatives de connexion (via le gestionnaire HTTP)', async () => {
    const attempt = () =>
      auth.handler(
        new Request(`${BASE}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: BASE,
            'x-forwarded-for': '203.0.113.7',
          },
          body: JSON.stringify({ email: 'owner@test.invalid', password: 'mauvais-mot-de-passe' }),
        }),
      );
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await attempt()).status);
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it('requête de mutation depuis une origine non autorisée refusée (CSRF)', async () => {
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
