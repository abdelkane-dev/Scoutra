import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations, users } from './auth';
import { prospectKinds, prospectingModels } from './reference';

/**
 * Tables métier multi-locataires. Règles :
 * - `organization_id NOT NULL` partout, RLS FORCE (migration 0001) ;
 * - relations critiques par clé étrangère COMPOSITE (organization_id, id) : impossible de
 *   lier une ligne de l'organisation A à une ligne de B, même par erreur.
 */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const orgId = () =>
  uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' });
const countryCheck = (name: string, col: unknown) => check(name, sql`${col} ~ '^[A-Z]{2}$'`);

export const campaignStatus = pgEnum('campaign_status', [
  'draft',
  'interpreting',
  'running',
  'paused',
  'cancelling',
  'cancelled',
  'completed',
  'failed',
  'awaiting_confirmation',
]);
export const prospectStatus = pgEnum('prospect_status', [
  'found',
  'enriched',
  'verified',
  'scored',
  'drafted',
  'rejected',
  'suppressed',
]);
export const contactChannel = pgEnum('contact_channel', [
  'email',
  'phone',
  'whatsapp',
  'website_form',
  'social_page',
  'postal',
]);
export const verificationStatus = pgEnum('verification_status', [
  'unknown',
  'valid',
  'invalid',
  'risky',
  'accept_all',
  'webmail',
  'disposable',
]);
export const legalBasis = pgEnum('legal_basis', [
  'consent',
  'legitimate_interest',
  'public_professional',
  'contract',
]);
export const actorType = pgEnum('actor_type', ['user', 'system', 'agent']);
export const ledgerReason = pgEnum('ledger_reason', [
  'monthly_grant',
  'purchase',
  'usage',
  'reserve',
  'refund',
  'adjustment',
  'pack_purchase',
  'rollover',
  'expire',
]);
export const suppressionReason = pgEnum('suppression_reason', [
  'opt_out',
  'erasure',
  'bounce',
  'complaint',
]);

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: orgId(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 200 }).notNull(),
    promptText: varchar('prompt_text', { length: 2000 }).notNull(),
    prospectingModel: text('prospecting_model')
      .notNull()
      .references(() => prospectingModels.code),
    status: campaignStatus('status').notNull().default('draft'),
    maxProspects: integer('max_prospects').notNull().default(100),
    creditBudget: integer('credit_budget').notNull().default(0),
    /** Qualité des messages : standard (inclus), careful (+1 crédit), premium (+3). */
    quality: varchar('quality', { length: 20 }).notNull().default('standard'),
    /** Modèle de prospection imposé par l'utilisateur (sinon choisi par l'Interprète). */
    modelForced: boolean('model_forced').notNull().default(false),
    /** Millicrédits réservés au lancement, consommés (prospects livrés) ; le reste est remboursé. */
    reservedMc: bigint('reserved_mc', { mode: 'number' }).notNull().default(0),
    consumedMc: bigint('consumed_mc', { mode: 'number' }).notNull().default(0),
    candidatesCount: integer('candidates_count').notNull().default(0),
    duplicatesCount: integer('duplicates_count').notNull().default(0),
    deliveredCount: integer('delivered_count').notNull().default(0),
    rejectedCount: integer('rejected_count').notNull().default(0),
    /** Sources gratuites seulement (pas de clé, garde-fou de coût) : expliqué à l'écran. */
    degraded: boolean('degraded').notNull().default(false),
    costMode: varchar('cost_mode', { length: 20 }).notNull().default('normal'),
    estimate: jsonb('estimate'),
    /** Sources retenues et écartées (avec la raison) au lancement. */
    sources: jsonb('sources'),
    errorCode: varchar('error_code', { length: 100 }),
    startedAt: ts('started_at'),
    finishedAt: ts('finished_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('campaigns_org_id_unique').on(t.organizationId, t.id),
    index('campaigns_org_created_idx').on(t.organizationId, t.createdAt),
    check('campaigns_budget_positive', sql`${t.maxProspects} > 0 and ${t.creditBudget} >= 0`),
    check('campaigns_quality_valid', sql`${t.quality} in ('standard', 'careful', 'premium')`),
    check('campaigns_credits_consistent', sql`${t.consumedMc} >= 0 and ${t.reservedMc} >= 0`),
    index('campaigns_org_status_idx').on(t.organizationId, t.status),
  ],
);

/** Profil de cible structuré (sortie de l'agent Interprète), versionné et éditable. */
export const targetProfiles = pgTable(
  'target_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: orgId(),
    campaignId: uuid('campaign_id').notNull(),
    version: integer('version').notNull(),
    spec: jsonb('spec').notNull(),
    prospectKinds: text('prospect_kinds').array().notNull(),
    countries: text('countries').array().notNull(),
    confirmedByUser: boolean('confirmed_by_user').notNull().default(false),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('target_profiles_campaign_version_unique').on(t.organizationId, t.campaignId, t.version),
    foreignKey({
      name: 'target_profiles_campaign_fk',
      columns: [t.organizationId, t.campaignId],
      foreignColumns: [campaigns.organizationId, campaigns.id],
    }).onDelete('cascade'),
  ],
);

/** Entité prospectée typée (entreprise, personne, acheteur public, bien, annonce…). */
export const prospects = pgTable(
  'prospects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: orgId(),
    campaignId: uuid('campaign_id'),
    kind: text('kind')
      .notNull()
      .references(() => prospectKinds.code),
    prospectingModel: text('prospecting_model')
      .notNull()
      .references(() => prospectingModels.code),
    displayName: varchar('display_name', { length: 300 }).notNull(),
    countryCode: char('country_code', { length: 2 }).notNull(),
    city: varchar('city', { length: 200 }),
    websiteDomain: varchar('website_domain', { length: 253 }),
    /** Attributs propres au type (taille, secteur, n° de registre…), validés par Zod côté code. */
    attributes: jsonb('attributes').notNull().default({}),
    /** Domaine normalisé, n° de registre, place_id… unique par organisation. */
    dedupeKey: varchar('dedupe_key', { length: 500 }).notNull(),
    /** Identifiant de personne (HMAC) pour l'effacement en cascade et l'opposition. */
    subjectKey: char('subject_key', { length: 64 }),
    status: prospectStatus('status').notNull().default('found'),
    rejectionReason: varchar('rejection_reason', { length: 300 }),
    /** Créateur ou commercial assigné (portée « ses prospects » du rôle member). */
    ownerUserId: uuid('owner_user_id'),
    score: smallint('score'),
    /** Raisons du score par critère (code, points, constat). */
    scoreReasons: jsonb('score_reasons').notNull().default([]),
    /** Décisions du garde-fou juridique par canal (rejouables : versions de règles incluses). */
    channelDecisions: jsonb('channel_decisions').notNull().default([]),
    sourceCodes: text('source_codes')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Livré = facturé (1 crédit + qualité) ; null tant que non livré. */
    deliveredAt: ts('delivered_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('prospects_org_id_unique').on(t.organizationId, t.id),
    unique('prospects_org_dedupe_unique').on(t.organizationId, t.dedupeKey),
    index('prospects_org_campaign_idx').on(t.organizationId, t.campaignId),
    index('prospects_org_subject_idx').on(t.organizationId, t.subjectKey),
    index('prospects_org_delivered_idx').on(t.organizationId, t.deliveredAt),
    index('prospects_org_owner_idx').on(t.organizationId, t.ownerUserId),
    check(
      'prospects_score_range',
      sql`${t.score} is null or (${t.score} >= 0 and ${t.score} <= 100)`,
    ),
    foreignKey({
      name: 'prospects_campaign_fk',
      columns: [t.organizationId, t.campaignId],
      foreignColumns: [campaigns.organizationId, campaigns.id],
    }).onDelete('set null'),
    countryCheck('prospects_country_code_format', t.countryCode),
  ],
);

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: orgId(),
    prospectId: uuid('prospect_id').notNull(),
    channel: contactChannel('channel').notNull(),
    /** Enveloppe chiffrée (@scoutra/crypto) : la valeur n'est jamais stockée en clair. */
    valueEncrypted: jsonb('value_encrypted').notNull(),
    /** HMAC de la valeur normalisée (recherche exacte, dédoublonnage, opposition). */
    valueHash: char('value_hash', { length: 64 }).notNull(),
    isRoleAddress: boolean('is_role_address').notNull().default(false),
    verificationStatus: verificationStatus('verification_status').notNull().default('unknown'),
    verifiedAt: ts('verified_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('contacts_org_id_unique').on(t.organizationId, t.id),
    unique('contacts_prospect_value_unique').on(
      t.organizationId,
      t.prospectId,
      t.channel,
      t.valueHash,
    ),
    index('contacts_org_hash_idx').on(t.organizationId, t.valueHash),
    foreignKey({
      name: 'contacts_prospect_fk',
      columns: [t.organizationId, t.prospectId],
      foreignColumns: [prospects.organizationId, prospects.id],
    }).onDelete('cascade'),
  ],
);

/**
 * Provenance PAR CHAMP (exigence RGPD/APDP, E9) : chaque donnée issue d'une source a au
 * moins une preuve. Source, URL, date de collecte, base légale et pays sont obligatoires.
 */
export const evidence = pgTable(
  'evidence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: orgId(),
    prospectId: uuid('prospect_id').notNull(),
    contactId: uuid('contact_id'),
    /** Champ concerné, ex. `display_name`, `attributes.size_band`, `contact`. */
    fieldPath: varchar('field_path', { length: 200 }).notNull(),
    sourceCode: varchar('source_code', { length: 100 }).notNull(),
    sourceUrl: varchar('source_url', { length: 2048 }),
    collectedAt: ts('collected_at').notNull(),
    legalBasis: legalBasis('legal_basis').notNull(),
    countryCode: char('country_code', { length: 2 }).notNull(),
    /** Licence des données de la source (ex. ODbL pour OpenStreetMap). */
    sourceLicense: varchar('source_license', { length: 100 }),
    confidence: numeric('confidence', { precision: 3, scale: 2 }),
    consentRef: varchar('consent_ref', { length: 200 }),
    snippet: varchar('snippet', { length: 500 }),
    rawHash: char('raw_hash', { length: 64 }),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('evidence_org_prospect_idx').on(t.organizationId, t.prospectId),
    foreignKey({
      name: 'evidence_prospect_fk',
      columns: [t.organizationId, t.prospectId],
      foreignColumns: [prospects.organizationId, prospects.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'evidence_contact_fk',
      columns: [t.organizationId, t.contactId],
      foreignColumns: [contacts.organizationId, contacts.id],
    }).onDelete('cascade'),
    countryCheck('evidence_country_code_format', t.countryCode),
    check(
      'evidence_confidence_range',
      sql`${t.confidence} is null or (${t.confidence} >= 0 and ${t.confidence} <= 1)`,
    ),
  ],
);

/** Journal d'audit en AJOUT SEUL (UPDATE/DELETE refusés par privilèges ET par déclencheur). */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    // Pas de clé étrangère : l'historique survit à la suppression de l'organisation.
    organizationId: uuid('organization_id').notNull(),
    actorUserId: uuid('actor_user_id'),
    actorType: actorType('actor_type').notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    targetType: varchar('target_type', { length: 100 }),
    targetId: varchar('target_id', { length: 100 }),
    ipHash: char('ip_hash', { length: 64 }),
    userAgent: varchar('user_agent', { length: 300 }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('audit_log_org_created_idx').on(t.organizationId, t.createdAt)],
);

/** Clés API clientes chiffrées par enveloppe ; seul `last4` est montrable. */
export const apiCredentials = pgTable(
  'api_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: orgId(),
    provider: varchar('provider', { length: 50 }).notNull(),
    label: varchar('label', { length: 100 }).notNull(),
    ciphertext: text('ciphertext').notNull(),
    wrappedDek: text('wrapped_dek').notNull(),
    keyVersion: smallint('key_version').notNull(),
    last4: varchar('last4', { length: 4 }).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    lastUsedAt: ts('last_used_at'),
    revokedAt: ts('revoked_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('api_credentials_org_provider_idx').on(t.organizationId, t.provider),
    check('api_credentials_provider_format', sql`${t.provider} ~ '^[a-z0-9_]{2,50}$'`),
  ],
);

/** Grand livre unique de crédits, en ajout seul : solde = somme des mouvements. */
export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    /** Millicrédits (1 crédit = 1 000 mc), entiers. */
    delta: bigint('delta', { mode: 'number' }).notNull(),
    reason: ledgerReason('reason').notNull(),
    refType: varchar('ref_type', { length: 50 }),
    refId: varchar('ref_id', { length: 100 }),
    idempotencyKey: varchar('idempotency_key', { length: 200 }).notNull(),
    createdBy: uuid('created_by'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('credit_ledger_idempotency_unique').on(t.organizationId, t.idempotencyKey),
    check('credit_ledger_delta_nonzero', sql`${t.delta} <> 0`),
  ],
);

/** Liste d'opposition : uniquement des empreintes, jamais la valeur. */
export const suppressionList = pgTable(
  'suppression_list',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: orgId(),
    valueHash: char('value_hash', { length: 64 }).notNull(),
    channel: contactChannel('channel').notNull(),
    reason: suppressionReason('reason').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [unique('suppression_list_unique').on(t.organizationId, t.valueHash, t.channel)],
);

export const tenantJobStatus = pgEnum('tenant_job_status', [
  'queued',
  'active',
  'retrying',
  'completed',
  'failed',
  'cancelled',
]);

/**
 * Suivi des tâches MÉTIER (décision « file pg-boss », revue étape 1 constat 7). Les tables
 * pg-boss n'ont pas de RLS : l'application ne lit JAMAIS l'état d'une tâche métier dans pg-boss,
 * seulement ici, sous RLS FORCE. Le worker refuse toute tâche dont la ligne de suivi n'existe pas
 * dans l'organisation de la charge utile (tâche forgée ou mélangée).
 */
export const tenantJobs = pgTable(
  'tenant_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: orgId(),
    kind: varchar('kind', { length: 50 }).notNull(),
    refType: varchar('ref_type', { length: 50 }),
    refId: uuid('ref_id'),
    bossJobId: uuid('boss_job_id'),
    status: tenantJobStatus('status').notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    errorCode: varchar('error_code', { length: 100 }),
    createdBy: uuid('created_by'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    finishedAt: ts('finished_at'),
  },
  (t) => [
    unique('tenant_jobs_org_id_unique').on(t.organizationId, t.id),
    index('tenant_jobs_org_ref_idx').on(t.organizationId, t.refType, t.refId),
    index('tenant_jobs_org_status_idx').on(t.organizationId, t.status),
  ],
);

/** Événements d'une campagne (diffusion en direct SSE, reprise par Last-Event-ID). */
export const campaignEvents = pgTable(
  'campaign_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    organizationId: orgId(),
    campaignId: uuid('campaign_id').notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    payload: jsonb('payload').notNull().default({}),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('campaign_events_org_campaign_idx').on(t.organizationId, t.campaignId, t.id),
    foreignKey({
      name: 'campaign_events_campaign_fk',
      columns: [t.organizationId, t.campaignId],
      foreignColumns: [campaigns.organizationId, campaigns.id],
    }).onDelete('cascade'),
  ],
);

/** Coût réel par événement (IA, connecteur, vérification) : garde-fou et recalibrage. Ajout seul. */
export const usageEvents = pgTable(
  'usage_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    organizationId: orgId(),
    campaignId: uuid('campaign_id'),
    kind: varchar('kind', { length: 30 }).notNull(),
    provider: varchar('provider', { length: 60 }).notNull(),
    /** Agent ou connecteur à l'origine du coût. */
    source: varchar('source', { length: 60 }).notNull(),
    units: integer('units').notNull().default(1),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    costMicroUsd: bigint('cost_micro_usd', { mode: 'number' }).notNull().default(0),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('usage_events_org_created_idx').on(t.organizationId, t.createdAt),
    index('usage_events_org_campaign_idx').on(t.organizationId, t.campaignId),
    check(
      'usage_events_kind_valid',
      sql`${t.kind} in ('llm', 'connector', 'verification', 'crawl')`,
    ),
    check('usage_events_cost_positive', sql`${t.costMicroUsd} >= 0`),
  ],
);

/** Messages rédigés (jamais envoyés automatiquement : l'utilisateur copie et envoie lui-même). */
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: orgId(),
    prospectId: uuid('prospect_id').notNull(),
    campaignId: uuid('campaign_id'),
    channel: contactChannel('channel').notNull(),
    language: varchar('language', { length: 5 }).notNull(),
    subject: varchar('subject', { length: 200 }),
    body: varchar('body', { length: 4000 }).notNull(),
    footer: varchar('footer', { length: 1000 }).notNull().default(''),
    quality: varchar('quality', { length: 20 }).notNull().default('standard'),
    generatedBy: varchar('generated_by', { length: 20 }).notNull(),
    model: varchar('model', { length: 100 }),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    complianceDecision: jsonb('compliance_decision').notNull(),
    createdBy: uuid('created_by'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('messages_org_prospect_idx').on(t.organizationId, t.prospectId),
    foreignKey({
      name: 'messages_prospect_fk',
      columns: [t.organizationId, t.prospectId],
      foreignColumns: [prospects.organizationId, prospects.id],
    }).onDelete('cascade'),
    check(
      'messages_status_valid',
      sql`${t.status} in ('draft', 'approved', 'copied', 'sent_manually', 'discarded')`,
    ),
    check('messages_generated_by_valid', sql`${t.generatedBy} in ('ai', 'template', 'user')`),
  ],
);

/** Portefeuilles de crédits par origine, consommés par ordre d'expiration (FIFO). */
export const creditBuckets = pgTable(
  'credit_buckets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: orgId(),
    origin: varchar('origin', { length: 20 }).notNull(),
    grantedMc: bigint('granted_mc', { mode: 'number' }).notNull(),
    remainingMc: bigint('remaining_mc', { mode: 'number' }).notNull(),
    expiresAt: ts('expires_at').notNull(),
    ref: varchar('ref', { length: 200 }).notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('credit_buckets_org_id_unique').on(t.organizationId, t.id),
    unique('credit_buckets_org_ref_unique').on(t.organizationId, t.ref),
    index('credit_buckets_org_expiry_idx').on(t.organizationId, t.expiresAt),
    check(
      'credit_buckets_origin_valid',
      sql`${t.origin} in ('plan', 'rollover', 'pack', 'trial', 'adjustment')`,
    ),
    check(
      'credit_buckets_amounts',
      sql`${t.remainingMc} >= 0 and ${t.remainingMc} <= ${t.grantedMc}`,
    ),
  ],
);

/** Réservation d'une campagne, ventilée par portefeuille (remboursement ciblé). */
export const creditReservations = pgTable(
  'credit_reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: orgId(),
    campaignId: uuid('campaign_id').notNull(),
    bucketId: uuid('bucket_id').notNull(),
    reservedMc: bigint('reserved_mc', { mode: 'number' }).notNull(),
    refundedMc: bigint('refunded_mc', { mode: 'number' }).notNull().default(0),
    position: integer('position').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('credit_reservations_org_campaign_idx').on(t.organizationId, t.campaignId),
    foreignKey({
      name: 'credit_reservations_bucket_fk',
      columns: [t.organizationId, t.bucketId],
      foreignColumns: [creditBuckets.organizationId, creditBuckets.id],
    }),
    check(
      'credit_reservations_amounts',
      sql`${t.refundedMc} >= 0 and ${t.refundedMc} <= ${t.reservedMc}`,
    ),
  ],
);

/** Consommations (prospect livré) : idempotentes, une reprise de tâche ne facture jamais deux fois. */
export const creditConsumptions = pgTable(
  'credit_consumptions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    organizationId: orgId(),
    campaignId: uuid('campaign_id').notNull(),
    prospectId: uuid('prospect_id'),
    amountMc: bigint('amount_mc', { mode: 'number' }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 200 }).notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('credit_consumptions_idem_unique').on(t.organizationId, t.idempotencyKey),
    check('credit_consumptions_positive', sql`${t.amountMc} > 0`),
  ],
);

/** Abonnement SaaS (prestataire de paiement abstrait). */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: orgId(),
    plan: varchar('plan', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    seats: integer('seats').notNull().default(1),
    periodStart: ts('period_start').notNull(),
    periodEnd: ts('period_end').notNull(),
    provider: varchar('provider', { length: 30 }).notNull(),
    providerRef: varchar('provider_ref', { length: 200 }),
    /** Date du dernier événement appliqué : un événement plus ancien est ignoré (ordre). */
    lastEventAt: ts('last_event_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('subscriptions_org_unique').on(t.organizationId),
    check('subscriptions_plan_valid', sql`${t.plan} in ('research', 'pipeline')`),
    check(
      'subscriptions_status_valid',
      sql`${t.status} in ('trialing', 'active', 'past_due', 'canceled')`,
    ),
  ],
);

/** Événements de paiement reçus (idempotence et ordre, revue étape 2, constat 9). Ajout seul. */
export const billingEvents = pgTable(
  'billing_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    organizationId: orgId(),
    eventId: varchar('event_id', { length: 200 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    occurredAt: ts('occurred_at').notNull(),
    outcome: varchar('outcome', { length: 20 }).notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [unique('billing_events_org_event_unique').on(t.organizationId, t.eventId)],
);
