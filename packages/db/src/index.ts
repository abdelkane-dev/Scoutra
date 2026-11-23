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
  isNotNull,
  isNull,
  lt,
  like,
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
  'tenant_jobs',
  'campaign_events',
  'usage_events',
  'messages',
  'credit_buckets',
  'credit_reservations',
  'credit_consumptions',
  'subscriptions',
  'billing_events',
  'pipeline_stages',
  'prospect_activities',
  'prospect_lists',
  'prospect_list_items',
  'saved_views',
  'sequences',
  'sequence_enrollments',
  'tasks',
  'automations',
  'notifications',
  'saved_searches',
  'data_subject_requests',
  'export_logs',
  'support_requests',
] as const;
export * from './playbooks';
export * from './wallet';
export * from './events';
export * from './listener';
export * from './sweeper';
