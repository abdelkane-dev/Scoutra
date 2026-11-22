import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Tables de référence GLOBALES (pas de locataire), en lecture seule pour l'application.
 * Étendre = ajouter le code dans @scoutra/core puis une migration d'insertion.
 */

export const prospectKinds = pgTable('prospect_kinds', {
  code: text('code').primaryKey(),
});

export const prospectingModels = pgTable(
  'prospecting_models',
  {
    code: text('code').primaryKey(),
    involvesIndividuals: boolean('involves_individuals').notNull(),
    defaultKinds: text('default_kinds').array().notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [check('prospecting_models_code_format', sql`${t.code} ~ '^[a-z0-9]+(_[a-z0-9]+)*$'`)],
);

/**
 * Playbook déclaratif par modèle de prospection : profil de cible type, connecteurs,
 * signaux, canaux autorisés, règles de conformité, gabarits. Versionné ; rempli à l'étape 2.
 */
export const playbooks = pgTable(
  'playbooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    modelCode: text('model_code')
      .notNull()
      .references(() => prospectingModels.code),
    version: integer('version').notNull(),
    definition: jsonb('definition').notNull(),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('playbooks_model_version_unique').on(t.modelCode, t.version)],
);
