import { loadEnv, migrateEnvSchema } from '@scoutra/config';
import { MIGRATIONS_DIR, runMigrations } from '@scoutra/db';
import { installQueueSchema } from '@scoutra/queue';

/** Tâche ponctuelle : migrations SQL + schéma de file, avec le rôle propriétaire uniquement. */
async function main() {
  const env = loadEnv(migrateEnvSchema);
  const dir = process.env.SCOUTRA_MIGRATIONS_DIR ?? MIGRATIONS_DIR;
  await runMigrations(env.DATABASE_MIGRATOR_URL, dir);
  await installQueueSchema(env.DATABASE_MIGRATOR_URL);
  console.info('[migrate] base à jour');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
