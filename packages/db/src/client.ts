import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface DbHandle {
  db: Database;
  pool: pg.Pool;
  close: () => Promise<void>;
}

export interface CreateDbOptions {
  max?: number;
  applicationName?: string;
}

export function createDb(connectionString: string, opts: CreateDbOptions = {}): DbHandle {
  const pool = new pg.Pool({
    connectionString,
    max: opts.max ?? 10,
    application_name: opts.applicationName ?? 'scoutra',
    // Coupe les requêtes anormalement longues (protection contre les blocages).
    statement_timeout: 30_000,
    idle_in_transaction_session_timeout: 60_000,
  });
  const db = drizzle(pool, { schema });
  return { db, pool, close: () => pool.end() };
}

export class UnsafeDatabaseRoleError extends Error {
  constructor(role: string, reason: string) {
    super(
      `Refus de démarrer : le rôle Postgres « ${role} » ${reason}. Utiliser scoutra_app (voir README).`,
    );
    this.name = 'UnsafeDatabaseRoleError';
  }
}

/**
 * Vérifie au démarrage que le rôle de connexion ne peut PAS contourner la RLS
 * (ni superutilisateur, ni BYPASSRLS, ni propriétaire des tables métier).
 */
export async function assertRlsEnforcedRole(pool: pg.Pool): Promise<string> {
  const { rows } = await pool.query<{
    role: string;
    rolsuper: boolean;
    rolbypassrls: boolean;
    owns: boolean;
  }>(
    `select current_user as role, r.rolsuper, r.rolbypassrls,
            exists (select 1 from pg_tables t where t.schemaname = 'public' and t.tablename = 'prospects'
                    and t.tableowner = current_user) as owns
       from pg_roles r where r.rolname = current_user`,
  );
  const row = rows[0];
  if (!row) throw new UnsafeDatabaseRoleError('?', 'est introuvable');
  if (row.rolsuper) throw new UnsafeDatabaseRoleError(row.role, 'est superutilisateur');
  if (row.rolbypassrls) throw new UnsafeDatabaseRoleError(row.role, 'a BYPASSRLS');
  if (row.owns) throw new UnsafeDatabaseRoleError(row.role, 'est propriétaire des tables');
  return row.role;
}
