import type { PgBoss } from 'pg-boss';
import { z } from 'zod';
import { and, eq, inArray, schema, sql, withTenant, type Database } from '@scoutra/db';
import { InvalidJobPayloadError } from './boss';
import type { JobDefinition } from './jobs';

/**
 * Tâches MÉTIER multi-locataires (décision « file pg-boss », README) :
 * 1. toute charge utile porte `organizationId` + `trackingId` (Zod à l'envoi ET à la réception) ;
 * 2. une ligne `tenant_jobs` (RLS FORCE) est créée dans l'organisation AVANT l'envoi ;
 * 3. le worker rouvre `withTenant(organizationId)` et refuse la tâche si la ligne de suivi n'existe
 *    pas dans CETTE organisation (tâche forgée ou mélangée) ou si elle est annulée ;
 * 4. l'état est lu uniquement via `tenant_jobs` sous RLS (`getTenantJob`), jamais dans pg-boss.
 */
export const trackedPayload = z.object({
  organizationId: z.uuid(),
  trackingId: z.uuid(),
});
export type TrackedPayload = z.infer<typeof trackedPayload>;

export class ForeignOrMissingJobError extends Error {
  constructor(job: string) {
    super(`Tâche ${job} sans suivi dans son organisation : refusée`);
    this.name = 'ForeignOrMissingJobError';
  }
}

export interface PublishTenantOptions {
  userId?: string;
  refType?: string;
  refId?: string;
  singletonKey?: string;
  startAfter?: number | Date;
}

/** Crée la ligne de suivi (RLS) puis envoie la tâche. Retourne l'identifiant de suivi. */
export async function publishTenantJob<S extends z.ZodType<TrackedPayload>>(
  boss: PgBoss,
  db: Database,
  job: JobDefinition<S>,
  payload: Omit<z.input<S>, 'trackingId'>,
  opts: PublishTenantOptions = {},
): Promise<string> {
  const orgId = (payload as unknown as { organizationId: string }).organizationId;
  const trackingId = await withTenant(db, { orgId, userId: opts.userId }, async (tx) => {
    const [row] = await tx
      .insert(schema.tenantJobs)
      .values({
        organizationId: orgId,
        kind: job.name,
        refType: opts.refType,
        refId: opts.refId,
        createdBy: opts.userId,
      })
      .returning({ id: schema.tenantJobs.id });
    return row!.id;
  });
  const parsed = job.schema.safeParse({ ...payload, trackingId });
  if (!parsed.success) {
    await markTenantJob(db, orgId, trackingId, 'failed', 'invalid_payload');
    throw new InvalidJobPayloadError(job.name);
  }
  const bossId = await boss.send(job.name, parsed.data as object, {
    singletonKey: opts.singletonKey,
    startAfter: opts.startAfter,
  });
  await withTenant(db, { orgId }, (tx) =>
    tx
      .update(schema.tenantJobs)
      .set(
        bossId
          ? { bossJobId: bossId, updatedAt: new Date() }
          : { status: 'cancelled', errorCode: 'duplicate', finishedAt: new Date() },
      )
      .where(eq(schema.tenantJobs.id, trackingId)),
  );
  return trackingId;
}

type Status = (typeof schema.tenantJobStatus.enumValues)[number];

async function markTenantJob(
  db: Database,
  orgId: string,
  id: string,
  status: Status,
  errorCode?: string,
) {
  const final = status === 'completed' || status === 'failed' || status === 'cancelled';
  await withTenant(db, { orgId }, (tx) =>
    tx
      .update(schema.tenantJobs)
      .set({
        status,
        errorCode: errorCode ?? null,
        updatedAt: new Date(),
        ...(final ? { finishedAt: new Date() } : {}),
        ...(status === 'active' ? { attempts: sql`${schema.tenantJobs.attempts} + 1` } : {}),
      })
      .where(eq(schema.tenantJobs.id, id)),
  );
}

export interface TenantJobMeta {
  bossJobId: string;
  trackingId: string;
  attempt: number;
  signal: AbortSignal;
}

/**
 * Consommateur d'une tâche métier : revalide la charge utile, vérifie la ligne de suivi DANS
 * l'organisation, met à jour l'état (actif, reprise, terminé, échec). Une tâche annulée est
 * ignorée sans exécuter le gestionnaire.
 */
export async function workTenant<S extends z.ZodType<TrackedPayload>>(
  boss: PgBoss,
  db: Database,
  job: JobDefinition<S>,
  handler: (payload: z.infer<S>, meta: TenantJobMeta) => Promise<unknown>,
  opts: { localConcurrency?: number } = {},
): Promise<string> {
  return boss.work(
    job.name,
    { batchSize: 1, includeMetadata: true, localConcurrency: opts.localConcurrency ?? 1 },
    async ([j]) => {
      if (!j) return undefined;
      const parsed = job.schema.safeParse(j.data);
      if (!parsed.success) throw new InvalidJobPayloadError(job.name);
      const p = parsed.data as TrackedPayload;
      const [row] = await withTenant(db, { orgId: p.organizationId }, (tx) =>
        tx
          .select({ status: schema.tenantJobs.status, kind: schema.tenantJobs.kind })
          .from(schema.tenantJobs)
          .where(eq(schema.tenantJobs.id, p.trackingId)),
      );
      if (!row || row.kind !== job.name) throw new ForeignOrMissingJobError(job.name);
      if (row.status === 'cancelled' || row.status === 'completed') return { skipped: row.status };
      await markTenantJob(db, p.organizationId, p.trackingId, 'active');
      try {
        const out = await handler(parsed.data, {
          bossJobId: j.id,
          trackingId: p.trackingId,
          attempt: j.retryCount,
          signal: j.signal,
        });
        await markTenantJob(db, p.organizationId, p.trackingId, 'completed');
        return out;
      } catch (err) {
        const last = j.retryCount >= j.retryLimit;
        const code = (err as { code?: unknown }).code;
        await markTenantJob(
          db,
          p.organizationId,
          p.trackingId,
          last ? 'failed' : 'retrying',
          typeof code === 'string' ? code.slice(0, 100) : 'error',
        );
        throw err;
      }
    },
  );
}

/** Lecture de l'état d'une tâche métier : UNIQUEMENT sous RLS (organisation courante). */
export async function getTenantJob(db: Database, orgId: string, trackingId: string) {
  const [row] = await withTenant(db, { orgId }, (tx) =>
    tx
      .select({
        id: schema.tenantJobs.id,
        kind: schema.tenantJobs.kind,
        status: schema.tenantJobs.status,
        attempts: schema.tenantJobs.attempts,
        errorCode: schema.tenantJobs.errorCode,
        createdAt: schema.tenantJobs.createdAt,
        finishedAt: schema.tenantJobs.finishedAt,
      })
      .from(schema.tenantJobs)
      .where(eq(schema.tenantJobs.id, trackingId)),
  );
  return row ?? null;
}

/**
 * Annule les tâches métier liées à une référence (ex. campagne) : suivi marqué `cancelled`
 * (le worker les ignore) puis annulation dans pg-boss des identifiants lus SOUS RLS.
 */
export async function cancelTenantJobs(
  boss: PgBoss,
  db: Database,
  orgId: string,
  ref: { refType: string; refId: string },
): Promise<number> {
  const rows = await withTenant(db, { orgId }, (tx) =>
    tx
      .update(schema.tenantJobs)
      .set({ status: 'cancelled', finishedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(schema.tenantJobs.refType, ref.refType),
          eq(schema.tenantJobs.refId, ref.refId),
          inArray(schema.tenantJobs.status, ['queued', 'retrying']),
        ),
      )
      .returning({ kind: schema.tenantJobs.kind, bossJobId: schema.tenantJobs.bossJobId }),
  );
  const byKind = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.bossJobId) continue;
    byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r.bossJobId]);
  }
  for (const [kind, ids] of byKind) await boss.cancel(kind, ids).catch(() => undefined);
  return rows.length;
}
