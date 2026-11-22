import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadEnv, migrateEnvSchema } from '@scoutra/config';
import { MIGRATIONS_DIR, runMigrations } from '@scoutra/db/migrate';
import { installQueueSchema } from '@scoutra/queue';

/** Tâche ponctuelle : migrations SQL + schéma de file, avec le rôle propriétaire uniquement. */
async function main() {
  const env = loadEnv(migrateEnvSchema);
  // Bundle (dist/) : migrations copiées à côté ; en développement : celles du paquet db.
  const bundled = fileURLToPath(new URL('./migrations', import.meta.url));
  const dir =
    process.env.SCOUTRA_MIGRATIONS_DIR ?? (existsSync(bundled) ? bundled : MIGRATIONS_DIR);
  await runMigrations(env.DATABASE_MIGRATOR_URL, dir);
  await installQueueSchema(env.DATABASE_MIGRATOR_URL);
  console.info('[migrate] base à jour');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
