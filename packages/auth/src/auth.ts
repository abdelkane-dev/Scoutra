import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { organization, twoFactor } from 'better-auth/plugins';
import { isoCountrySchema, type OrgRole } from '@scoutra/core';
import { sha256Hex } from '@scoutra/crypto';
import type { WebEnv } from '@scoutra/config';
import type { Database } from '@scoutra/db';
import { and, count, eq, gt, schema, sql } from '@scoutra/db';
import {
  assignableRoles,
  can,
  canManageMember,
  isOrgRole,
  requiresTwoFactor,
  type Action,
} from './access';
import type { EmailSender } from './email';
import { hashPassword, verifyPassword } from './password';

export interface CreateAuthOptions {
  env: WebEnv;
  /** Connexion avec le rôle scoutra_auth (tables d'identité uniquement). */
  authDb: Database;
  email: EmailSender;
}

const HOUR = 3600;
/** Limite par compte (en plus de la limite par IP) : tentatives de connexion par email. */
export const SIGN_IN_PER_EMAIL = { max: 10, windowMs: 15 * 60 * 1000 } as const;

function deny(message: 'forbidden' | 'two_factor_required' | 'country_change_forbidden'): never {
  throw new APIError('FORBIDDEN', { message });
}

export function createAuth({ env, authDb, email }: CreateAuthOptions) {
  const production = env.NODE_ENV === 'production';
  const trustedOrigins = [
    env.BETTER_AUTH_URL,
    ...(env.SCOUTRA_TRUSTED_ORIGINS?.split(',')
      .map((o) => o.trim())
      .filter(Boolean) ?? []),
  ];

  /** Rôle et 2FA de l'acteur, relus en base (jamais pris de la requête). */
  async function actor(
    orgId: string,
    userId: string,
  ): Promise<{ role: OrgRole | null; twoFactor: boolean }> {
    const [row] = await authDb
      .select({ role: schema.members.role, twoFactor: schema.users.twoFactorEnabled })
      .from(schema.members)
      .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
      .where(and(eq(schema.members.organizationId, orgId), eq(schema.members.userId, userId)))
      .limit(1);
    return { role: isOrgRole(row?.role) ? row.role : null, twoFactor: !!row?.twoFactor };
  }

  /** Même matrice que les routes métier (access.ts) pour les routes /organization/* de Better Auth. */
  async function authorize(orgId: string, userId: string, action: Action): Promise<OrgRole> {
    const a = await actor(orgId, userId);
    if (!a.role || !can(a.role, action)) deny('forbidden');
    if (env.SCOUTRA_ENFORCE_ADMIN_2FA && requiresTwoFactor(a.role, action) && !a.twoFactor) {
      deny('two_factor_required');
    }
    return a.role;
  }

  /** Compteur atomique par email (table rate_limits de Better Auth), indépendant de l'IP. */
  async function hitEmailLimit(email: string): Promise<boolean> {
    const key = `sign-in-email:${sha256Hex(email.trim().toLowerCase())}`;
    const now = Date.now();
    const cutoff = now - SIGN_IN_PER_EMAIL.windowMs;
    const res = await authDb.execute<{ count: number }>(sql`
      insert into rate_limits (key, count, last_request) values (${key}, 1, ${now})
      on conflict (key) do update set
        count = case when rate_limits.last_request < ${cutoff} then 1 else rate_limits.count + 1 end,
        last_request = case when rate_limits.last_request < ${cutoff} then ${now} else rate_limits.last_request end
      returning count`);
    return Number(res.rows[0]?.count ?? 0) > SIGN_IN_PER_EMAIL.max;
  }

  /** Membre ciblé (par id ou email) dans l'organisation, relu en base. */
  async function targetMember(orgId: string, idOrEmail: string) {
    const byId = /^[0-9a-f-]{36}$/i.test(idOrEmail);
    const [row] = await authDb
      .select({ role: schema.members.role, userId: schema.members.userId })
      .from(schema.members)
      .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
      .where(
        and(
          eq(schema.members.organizationId, orgId),
          byId
            ? eq(schema.members.id, idOrEmail)
            : eq(sql`lower(${schema.users.email})`, idOrEmail.toLowerCase()),
        ),
      )
      .limit(1);
    return row;
  }

  /**
   * Changement de rôle et retrait de membre : les hooks de Better Auth reçoivent l'utilisateur
   * CIBLÉ, pas l'acteur. Le contrôle est donc fait ici, avant le traitement, avec la session
   * de l'acteur (revue étape 1, constat 2).
   */
  async function guardMemberManagement(
    ctx: Parameters<Parameters<typeof createAuthMiddleware>[0]>[0],
  ) {
    const path = ctx.path;
    if (path !== '/organization/update-member-role' && path !== '/organization/remove-member')
      return;
    const session = await getSessionFromCtx(ctx);
    if (!session) throw new APIError('UNAUTHORIZED');
    const body = (ctx.body ?? {}) as {
      organizationId?: unknown;
      memberId?: unknown;
      memberIdOrEmail?: unknown;
      role?: unknown;
    };
    const orgId =
      typeof body.organizationId === 'string'
        ? body.organizationId
        : session.session.activeOrganizationId;
    const ref = path === '/organization/update-member-role' ? body.memberId : body.memberIdOrEmail;
    if (typeof orgId !== 'string' || typeof ref !== 'string') deny('forbidden');
    const target = await targetMember(orgId, ref);
    if (!target) return; // Better Auth répondra « membre introuvable »
    if (path === '/organization/remove-member') {
      if (target.userId === session.user.id) return; // quitter l'organisation soi-même
      const role = await authorize(orgId, session.user.id, 'member:remove');
      if (!canManageMember(role, target.role)) deny('forbidden');
      return;
    }
    const role = await authorize(orgId, session.user.id, 'member:change_role');
    const roles = (Array.isArray(body.role) ? body.role : [body.role]) as unknown[];
    if (
      !canManageMember(role, target.role) ||
      !roles.every((r) => (assignableRoles(role) as unknown[]).includes(r))
    ) {
      deny('forbidden');
    }
  }

  return betterAuth({
    appName: 'Scoutra',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins,
    telemetry: { enabled: false },
    database: drizzleAdapter(authDb, {
      provider: 'pg',
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
        organization: schema.organizations,
        member: schema.members,
        invitation: schema.invitations,
        twoFactor: schema.twoFactors,
        rateLimit: schema.rateLimits,
      },
    }),
    advanced: {
      database: { generateId: 'uuid' },
      // Contrôle d'origine (CSRF) TOUJOURS actif : Better Auth le coupe sinon quand NODE_ENV=test.
      disableOriginCheck: false,
      disableCSRFCheck: false,
      cookiePrefix: 'scoutra',
      // IP client : seul l'en-tête posé par le reverse proxy de confiance est pris en compte.
      ipAddress: {
        ipAddressHeaders: [env.SCOUTRA_CLIENT_IP_HEADER],
        ...(env.SCOUTRA_TRUSTED_PROXIES.length
          ? { trustedProxies: env.SCOUTRA_TRUSTED_PROXIES }
          : {}),
      },
      useSecureCookies: production,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: production },
    },
    session: {
      expiresIn: 7 * 24 * HOUR,
      updateAge: 24 * HOUR,
      freshAge: 15 * 60,
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: env.SCOUTRA_REQUIRE_EMAIL_VERIFICATION,
      revokeSessionsOnPasswordReset: true,
      password: { hash: hashPassword, verify: verifyPassword },
      sendResetPassword: async ({ user, url }) =>
        email.send({ to: user.email, kind: 'reset_password', url }),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) =>
        email.send({ to: user.email, kind: 'verify_email', url }),
    },
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
        : {},
    account: {
      // Liaison Google ↔ compte existant UNIQUEMENT si Google certifie l'email (email_verified)
      // et si l'email local est vérifié. Aucun fournisseur « de confiance » qui contournerait ce
      // contrôle (revue étape 1, constat 1).
      accountLinking: { enabled: true, requireLocalEmailVerified: true },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: HOUR, max: 5 },
        '/request-password-reset': { window: HOUR, max: 5 },
        '/send-verification-email': { window: HOUR, max: 5 },
        '/two-factor/verify-totp': { window: 60, max: 5 },
        '/two-factor/verify-backup-code': { window: 60, max: 5 },
        '/organization/invite-member': { window: HOUR, max: 30 },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        await guardMemberManagement(ctx);
        if (ctx.path !== '/sign-in/email') return;
        const email = (ctx.body as { email?: unknown } | undefined)?.email;
        if (typeof email === 'string' && (await hitEmailLimit(email))) {
          throw new APIError('TOO_MANY_REQUESTS', { message: 'rate_limited' });
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          // Inscription fermée par défaut : seul le PREMIER compte (installation) ou une
          // personne invitée (invitation en attente, non expirée) peut créer un compte.
          before: async (user) => {
            if (env.SCOUTRA_ALLOW_SIGNUP) return;
            const [{ n } = { n: 0 }] = await authDb.select({ n: count() }).from(schema.users);
            if (n === 0) return;
            const [invite] = await authDb
              .select({ id: schema.invitations.id })
              .from(schema.invitations)
              .where(
                and(
                  eq(sql`lower(${schema.invitations.email})`, user.email.toLowerCase()),
                  eq(schema.invitations.status, 'pending'),
                  gt(schema.invitations.expiresAt, new Date()),
                ),
              )
              .limit(1);
            if (!invite) throw new APIError('FORBIDDEN', { message: 'signup_disabled' });
          },
        },
      },
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: true,
        organizationLimit: env.SCOUTRA_MODE === 'license' ? 1 : 5,
        creatorRole: 'owner',
        membershipLimit: 500,
        invitationExpiresIn: 48 * HOUR,
        invitationLimit: 100,
        cancelPendingInvitationsOnReInvite: true,
        requireEmailVerificationOnInvitation: true,
        teams: { enabled: false },
        schema: {
          organization: {
            additionalFields: {
              countryCode: { type: 'string', required: true, input: true },
            },
          },
        },
        organizationHooks: {
          beforeUpdateOrganization: async ({ organization: org, user, member }) => {
            await authorize(member.organizationId, user.id, 'org:update');
            // Le pays d'établissement pilote la licence et les règles juridiques : il n'est pas
            // modifiable par l'interface (procédure support journalisée à prévoir).
            if ('countryCode' in org && org.countryCode !== undefined)
              deny('country_change_forbidden');
            return { data: org };
          },
          beforeDeleteOrganization: async ({ organization: org, user }) => {
            await authorize(org.id, user.id, 'org:delete');
          },
          beforeCreateInvitation: async ({ invitation, inviter }) => {
            const role = await authorize(invitation.organizationId, inviter.id, 'member:invite');
            if (!(assignableRoles(role) as string[]).includes(invitation.role)) deny('forbidden');
          },
          beforeCreateOrganization: async ({ organization: org }) => {
            const parsed = isoCountrySchema.safeParse(
              (org as { countryCode?: unknown }).countryCode,
            );
            if (!parsed.success)
              throw new APIError('BAD_REQUEST', { message: 'invalid_country_code' });
            return { data: { ...org, countryCode: parsed.data } };
          },
        },
        // L'identifiant d'invitation sert de jeton à usage unique (statut pending → accepted),
        // lié à l'email invité : Better Auth refuse l'acceptation par un autre compte.
        sendInvitationEmail: async (data) =>
          email.send({
            to: data.email,
            kind: 'invitation',
            url: `${env.BETTER_AUTH_URL}/invitations/${data.id}`,
          }),
      }),
      twoFactor({ issuer: 'Scoutra' }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
