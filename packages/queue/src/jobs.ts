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

/** Charge utile des tâches MÉTIER : organisation + identifiant de suivi (tenant_jobs, RLS). */
const tracked = z.object({ organizationId: z.uuid(), trackingId: z.uuid() });
const campaignRef = tracked.extend({ campaignId: z.uuid() });

/** Interprétation du texte libre en profil de cible (agent Interprète). */
export const campaignInterpretJob = defineJob({
  name: 'campaign.interpret',
  schema: campaignRef.extend({ locale: z.enum(['fr', 'en']) }).strict(),
  queue: { retryLimit: 2, retryDelay: 10, retryBackoff: true, expireInSeconds: 180 },
});

/** Planification : réservation des crédits, requêtes par connecteur (fan-out). */
export const campaignPlanJob = defineJob({
  name: 'campaign.plan',
  schema: campaignRef.strict(),
  queue: { retryLimit: 2, retryDelay: 10, retryBackoff: true, expireInSeconds: 120 },
});

/** Une requête d'un connecteur (agent Recherche) : insère les candidats dédoublonnés. */
export const searchRunJob = defineJob({
  name: 'search.run',
  schema: campaignRef
    .extend({
      connector: z.string().regex(/^[a-z0-9_]{2,40}$/),
      queryIndex: z.int().min(0).max(500),
    })
    .strict(),
  queue: { retryLimit: 3, retryDelay: 15, retryBackoff: true, expireInSeconds: 120 },
});

/** Un prospect : enrichissement → vérification → notation → rédaction (étapes idempotentes). */
export const prospectProcessJob = defineJob({
  name: 'prospect.process',
  schema: campaignRef.extend({ prospectId: z.uuid() }).strict(),
  queue: { retryLimit: 3, retryDelay: 15, retryBackoff: true, expireInSeconds: 300 },
});

/** Clôture : statut final, remboursement de la réservation non consommée. */
export const campaignFinalizeJob = defineJob({
  name: 'campaign.finalize',
  schema: campaignRef.strict(),
  queue: { retryLimit: 5, retryDelay: 10, retryBackoff: true, expireInSeconds: 60 },
});

/** Étape due d'une séquence : crée une tâche ou un brouillon (jamais d'envoi). */
export const sequenceStepJob = defineJob({
  name: 'sequence.step',
  schema: tracked.extend({ enrollmentId: z.uuid() }).strict(),
  queue: { retryLimit: 3, retryDelay: 30, retryBackoff: true, expireInSeconds: 60 },
});

export const ALL_JOBS = [
  pingJob,
  campaignInterpretJob,
  campaignPlanJob,
  searchRunJob,
  prospectProcessJob,
  campaignFinalizeJob,
  sequenceStepJob,
] as const;

export type JobPayload<J extends JobDefinition<z.ZodType>> = z.infer<J['schema']>;
