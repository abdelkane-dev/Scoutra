import { z } from 'zod';

/** Toute charge utile de tâche porte l'organisation : le worker rouvre withTenant avec. */
export const tenantPayload = z.object({
  organizationId: z.uuid(),
});

export interface JobDefinition<S extends z.ZodType> {
  name: string;
  schema: S;
  /** Options de file pg-boss (reprises, expiration). */
  queue: { retryLimit: number; retryDelay: number; retryBackoff: boolean; expireInSeconds: number };
}

function defineJob<S extends z.ZodType<{ organizationId: string }>>(
  def: JobDefinition<S>,
): JobDefinition<S> {
  if (!/^[a-z][a-z0-9.]{1,49}$/.test(def.name))
    throw new Error(`Nom de tâche invalide : ${def.name}`);
  return def;
}

/** Tâche de démonstration de bout en bout : web → file → worker → audit (dans l'organisation). */
export const pingJob = defineJob({
  name: 'system.ping',
  schema: tenantPayload
    .extend({
      requestedBy: z.uuid(),
      message: z.string().trim().min(1).max(200),
    })
    .strict(),
  queue: { retryLimit: 2, retryDelay: 5, retryBackoff: true, expireInSeconds: 60 },
});

export const ALL_JOBS = [pingJob] as const;

export type JobPayload<J extends JobDefinition<z.ZodType>> = z.infer<J['schema']>;
