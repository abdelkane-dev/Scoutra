import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './client';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));

/** Applique les migrations SQL avec le rôle PROPRIÉTAIRE (scoutra_migrator), jamais le rôle applicatif. */
export async function runMigrations(
  migratorUrl: string,
  migrationsFolder = MIGRATIONS_DIR,
): Promise<void> {
  const handle = createDb(migratorUrl, { max: 1, applicationName: 'scoutra-migrate' });
  try {
    await migrate(handle.db, { migrationsFolder });
  } finally {
    await handle.close();
  }
}
