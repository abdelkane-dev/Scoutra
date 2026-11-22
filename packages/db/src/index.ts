export * from './client';
export * from './tenant';
export * from './audit';
export * from './credits';
export * as schema from './schema';
export {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';

/** Tables métier soumises à l'isolation par organisation (RLS). Vérifié par les tests. */
export const TENANT_TABLES = [
  'organizations',
  'members',
  'invitations',
  'campaigns',
  'target_profiles',
  'prospects',
  'contacts',
  'evidence',
  'audit_log',
  'api_credentials',
  'credit_ledger',
  'suppression_list',
] as const;
