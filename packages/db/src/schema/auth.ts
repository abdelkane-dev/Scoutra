import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  char,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Tables d'identité gérées par Better Auth (noms de champs imposés par Better Auth,
 * colonnes en snake_case). Accès : rôle `scoutra_auth` uniquement, sauf `organizations`
 * et `members` lisibles par `scoutra_app` sous RLS (organisation courante).
 */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    twoFactorEnabled: boolean('two_factor_enabled').default(false),
    /** Opérateur plateforme (console super-admin, mode SaaS) : posé hors API, jamais par l'utilisateur. */
    platformRole: text('platform_role'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check(
      'users_platform_role_valid',
      sql`${t.platformRole} is null or ${t.platformRole} = 'operator'`,
    ),
  ],
);

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    logo: text('logo'),
    metadata: text('metadata'),
    /** Pays d'établissement (ISO 3166-1 alpha-2) : base des règles « émetteur » et de la licence. */
    countryCode: char('country_code', { length: 2 }).notNull(),
    /** Type de compte (onboarding, @scoutra/core ACCOUNT_TYPES), modifiable par owner/admin. */
    accountType: text('account_type'),
    /** Secteurs d'activité (codes ISIC de @scoutra/core SECTORS), validés par Zod côté code. */
    sectors: text('sectors')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('organizations_country_code_format', sql`${t.countryCode} ~ '^[A-Z]{2}$'`),
    check(
      'organizations_account_type_format',
      sql`${t.accountType} is null or ${t.accountType} ~ '^[a-z_]{2,40}$'`,
    ),
    check('organizations_sectors_max', sql`cardinality(${t.sectors}) <= 10`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    expiresAt: ts('expires_at').notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    activeOrganizationId: uuid('active_organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: ts('access_token_expires_at'),
    refreshTokenExpiresAt: ts('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [index('accounts_user_id_idx').on(t.userId)],
);

export const verifications = pgTable(
  'verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: ts('expires_at').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
);

export const members = pgTable(
  'members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('members_org_user_unique').on(t.organizationId, t.userId),
    index('members_user_id_idx').on(t.userId),
    check(
      'members_role_valid',
      sql`${t.role} in ('owner', 'admin', 'manager', 'member', 'viewer', 'billing')`,
    ),
  ],
);

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role'),
    status: text('status').notNull(),
    expiresAt: ts('expires_at').notNull(),
    inviterId: uuid('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('invitations_org_idx').on(t.organizationId),
    index('invitations_email_idx').on(t.email),
    check(
      'invitations_role_valid',
      sql`${t.role} is null or ${t.role} in ('admin', 'manager', 'member', 'viewer', 'billing')`,
    ),
  ],
);

export const twoFactors = pgTable(
  'two_factors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    verified: boolean('verified').default(true),
    failedVerificationCount: integer('failed_verification_count').default(0),
    lockedUntil: ts('locked_until'),
  },
  (t) => [index('two_factors_user_id_idx').on(t.userId)],
);

export const rateLimits = pgTable('rate_limits', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});
