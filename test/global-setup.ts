import { randomBytes } from 'node:crypto';
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { runMigrations } from '@scoutra/db/migrate';
import { installQueueSchema } from '@scoutra/queue';
import { PLAYBOOKS } from '@scoutra/agents';
import { createDb, seedPlaybooks } from '@scoutra/db';

/**
 * Prépare une base Postgres JETABLE pour les tests d'intégration :
 * - rôles réels (scoutra_migrator propriétaire, scoutra_app et scoutra_auth sans BYPASSRLS) ;
 * - migrations appliquées comme en production ; schéma pg-boss installé.
 * Nécessite TEST_DATABASE_ADMIN_URL (superutilisateur d'un Postgres local ou de CI).
 */

import type { TestDbInfo } from './provided-context';

function withCreds(base: string, user: string, password: string, database: string): string {
  const u = new URL(base);
  u.username = user;
  u.password = password;
  u.pathname = `/${database}`;
  return u.toString();
}

export default async function setup(project: TestProject) {
  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
  if (!adminUrl) {
    if (process.env.SCOUTRA_REQUIRE_DB_TESTS === '1') {
      throw new Error('TEST_DATABASE_ADMIN_URL manquant alors que SCOUTRA_REQUIRE_DB_TESTS=1');
    }
    console.warn(
      '\n⚠ Tests d’intégration Postgres IGNORÉS : définir TEST_DATABASE_ADMIN_URL (voir README).\n',
    );
    project.provide('db', { available: false, appUrl: '', authUrl: '', migratorUrl: '' });
    return;
  }

  const dbName = `scoutra_test_${randomBytes(4).toString('hex')}`;
  const pw = {
    migrator: randomBytes(18).toString('hex'),
    app: randomBytes(18).toString('hex'),
    auth: randomBytes(18).toString('hex'),
  };
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  const ensureRole = async (name: string, password: string, extra: string) => {
    const { rowCount } = await admin.query('select 1 from pg_roles where rolname = $1', [name]);
    // Identifiants fixes (pas d'entrée utilisateur) ; mot de passe via format() côté serveur.
    const verb = rowCount ? 'ALTER' : 'CREATE';
    const { rows } = await admin.query<{ q: string }>(
      `select format('${verb} ROLE %I LOGIN PASSWORD %L ${extra}', $1::text, $2::text) as q`,
      [name, password],
    );
    await admin.query(rows[0]!.q);
  };
  await ensureRole('scoutra_migrator', pw.migrator, 'NOSUPERUSER NOBYPASSRLS');
  await ensureRole('scoutra_app', pw.app, 'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE');
  await ensureRole('scoutra_auth', pw.auth, 'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE');
  await admin.query(`CREATE DATABASE ${dbName} OWNER scoutra_migrator`);
  await admin.end();

  const info: TestDbInfo = {
    available: true,
    migratorUrl: withCreds(adminUrl, 'scoutra_migrator', pw.migrator, dbName),
    appUrl: withCreds(adminUrl, 'scoutra_app', pw.app, dbName),
    authUrl: withCreds(adminUrl, 'scoutra_auth', pw.auth, dbName),
  };
  await runMigrations(info.migratorUrl);
  await installQueueSchema(info.migratorUrl);
  const seed = createDb(info.migratorUrl, { max: 1 });
  await seedPlaybooks(seed.db, PLAYBOOKS);
  await seedPlaybooks(seed.db, PLAYBOOKS); // idempotent
  await seed.close();
  project.provide('db', info);

  return async () => {
    const c = new pg.Client({ connectionString: adminUrl });
    await c.connect();
    await c.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await c.end();
  };
}
