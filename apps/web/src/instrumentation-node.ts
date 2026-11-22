import { ensureDbReady } from './server/db';
import { getEnv } from './server/env';

// Démarrage REFUSÉ (arrêt du processus) si un secret manque ou est faible, ou si le rôle
// Postgres peut contourner la RLS.
try {
  getEnv();
  await ensureDbReady();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
