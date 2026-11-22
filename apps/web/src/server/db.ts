import 'server-only';
import { assertRlsEnforcedRole, createDb, type DbHandle } from '@scoutra/db';
import { getEnv } from './env';

interface Pools {
  app: DbHandle;
  auth: DbHandle;
  ready?: Promise<void>;
}

// Conservé sur globalThis pour survivre au rechargement à chaud en développement.
const g = globalThis as typeof globalThis & { __scoutraPools?: Pools };

function pools(): Pools {
  if (!g.__scoutraPools) {
    const env = getEnv();
    g.__scoutraPools = {
      app: createDb(env.DATABASE_URL, { max: 10, applicationName: 'scoutra-web' }),
      auth: createDb(env.DATABASE_AUTH_URL, { max: 5, applicationName: 'scoutra-auth' }),
    };
  }
  return g.__scoutraPools;
}

/** Vérifie une fois que le rôle applicatif ne contourne pas la RLS. */
export function ensureDbReady(): Promise<void> {
  const p = pools();
  p.ready ??= assertRlsEnforcedRole(p.app.pool).then(() => undefined);
  return p.ready;
}

/** Base métier (rôle scoutra_app) : toujours via withTenant(). */
export async function appDb() {
  await ensureDbReady();
  return pools().app.db;
}

/** Base d'identité (rôle scoutra_auth) : réservée à Better Auth. */
export function authDb() {
  return pools().auth.db;
}
