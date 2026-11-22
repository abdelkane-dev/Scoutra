import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { organization, twoFactor } from 'better-auth/plugins';
import { isoCountrySchema } from '@scoutra/core';
import type { WebEnv } from '@scoutra/config';
import type { Database } from '@scoutra/db';
import { and, count, eq, gt, schema, sql } from '@scoutra/db';
import type { EmailSender } from './email';
import { hashPassword, verifyPassword } from './password';

export interface CreateAuthOptions {
  env: WebEnv;
  /** Connexion avec le rôle scoutra_auth (tables d'identité uniquement). */
  authDb: Database;
  email: EmailSender;
}

const HOUR = 3600;

export function createAuth({ env, authDb, email }: CreateAuthOptions) {
  const production = env.NODE_ENV === 'production';
  const trustedOrigins = [
    env.BETTER_AUTH_URL,
    ...(env.SCOUTRA_TRUSTED_ORIGINS?.split(',')
      .map((o) => o.trim())
      .filter(Boolean) ?? []),
  ];

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
      // Liaison Google ↔ compte existant seulement si Google certifie l'email.
      accountLinking: { enabled: true, trustedProviders: ['google'] },
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
