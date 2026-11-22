import { PgBoss } from 'pg-boss';
import type { z } from 'zod';
import { ALL_JOBS, type JobDefinition } from './jobs';

export const QUEUE_SCHEMA = 'pgboss';
export type Boss = PgBoss;

export class InvalidJobPayloadError extends Error {
  constructor(job: string) {
    super(`Charge utile invalide pour la tâche ${job}`);
    this.name = 'InvalidJobPayloadError';
  }
}

/**
 * Installe (ou met à jour) le schéma pg-boss et crée les files, avec le rôle PROPRIÉTAIRE,
 * puis donne au rôle applicatif uniquement les droits d'utilisation (pas de DDL).
 */
export async function installQueueSchema(
  migratorUrl: string,
  appRole = 'scoutra_app',
): Promise<void> {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(appRole)) throw new Error('Nom de rôle invalide');
  const boss = new PgBoss({
    connectionString: migratorUrl,
    schema: QUEUE_SCHEMA,
    migrate: true,
    supervise: false,
    schedule: false,
  });
  boss.on('error', () => undefined);
  await boss.start();
  try {
    for (const job of ALL_JOBS) {
      const existing = await boss.getQueue(job.name);
      if (!existing) await boss.createQueue(job.name, job.queue);
      else await boss.updateQueue(job.name, job.queue);
    }
    // Identifiants SQL validés ci-dessus (regex) : pas de donnée utilisateur ici.
    const stmts = [
      `GRANT USAGE ON SCHEMA ${QUEUE_SCHEMA} TO ${appRole}`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${QUEUE_SCHEMA} TO ${appRole}`,
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${QUEUE_SCHEMA} TO ${appRole}`,
      `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${QUEUE_SCHEMA} TO ${appRole}`,
    ];
    const db = boss.getDb();
    for (const s of stmts) await db.executeSql(s);
  } finally {
    await boss.stop({ graceful: false });
  }
}

export interface CreateBossOptions {
  /** true pour le worker (maintenance), false pour le web qui ne fait que publier. */
  supervise?: boolean;
}

/** Client pg-boss pour le rôle applicatif : jamais de migration de schéma. */
export function createBoss(appUrl: string, opts: CreateBossOptions = {}): PgBoss {
  return new PgBoss({
    connectionString: appUrl,
    schema: QUEUE_SCHEMA,
    migrate: false,
    supervise: opts.supervise ?? false,
    schedule: false,
    max: 5,
  });
}

/** Publie une tâche après validation stricte de la charge utile. */
export async function publish<S extends z.ZodType>(
  boss: PgBoss,
  job: JobDefinition<S>,
  payload: z.input<S>,
  options: { singletonKey?: string } = {},
): Promise<string> {
  const parsed = job.schema.safeParse(payload);
  if (!parsed.success) throw new InvalidJobPayloadError(job.name);
  const id = await boss.send(job.name, parsed.data as object, options);
  if (!id) throw new Error(`Tâche ${job.name} non créée (doublon singleton ?)`);
  return id;
}

/**
 * Enregistre un consommateur. La charge utile est REVALIDÉE à la réception : une tâche
 * forgée ou corrompue échoue sans exécuter le gestionnaire.
 */
export async function work<S extends z.ZodType>(
  boss: PgBoss,
  job: JobDefinition<S>,
  handler: (payload: z.infer<S>, meta: { jobId: string }) => Promise<unknown>,
): Promise<string> {
  return boss.work(job.name, { batchSize: 1 }, async ([j]) => {
    if (!j) return undefined;
    const parsed = job.schema.safeParse(j.data);
    if (!parsed.success) throw new InvalidJobPayloadError(job.name);
    return handler(parsed.data, { jobId: j.id });
  });
}

/** Lit l'état d'une tâche en vérifiant qu'elle appartient bien à l'organisation demandée. */
export async function getJobForOrg(
  boss: PgBoss,
  job: JobDefinition<z.ZodType>,
  jobId: string,
  orgId: string,
): Promise<{ id: string; state: string; output: unknown; createdOn: Date } | null> {
  const found = await boss.getJobById(job.name, jobId);
  if (!found) return null;
  const data = found.data as { organizationId?: unknown } | null;
  if (data?.organizationId !== orgId) return null; // même réponse que « introuvable » (pas d'oracle)
  return { id: found.id, state: found.state, output: found.output, createdOn: found.createdOn };
}
