import { AppError } from '@scoutra/core';
import { and, eq, schema, withTenant, writeAudit, type Database } from '@scoutra/db';
import type { JobPayload, pingJob } from '@scoutra/queue';

export interface PingResult {
  pong: true;
  organizationId: string;
  at: string;
}

/**
 * Tâche de démonstration. Ne fait JAMAIS confiance à la charge utile seule : rouvre une
 * transaction withTenant sur l'organisation de la tâche, vérifie que l'organisation existe
 * et que le demandeur en est bien membre, puis écrit une ligne d'audit (RLS appliquée).
 */
export async function handlePing(
  db: Database,
  payload: JobPayload<typeof pingJob>,
  jobId: string,
): Promise<PingResult> {
  return withTenant(
    db,
    { orgId: payload.organizationId, userId: payload.requestedBy },
    async (tx) => {
      const [org] = await tx.select({ id: schema.organizations.id }).from(schema.organizations);
      if (!org || org.id !== payload.organizationId)
        throw new AppError('not_found', 'Organisation inconnue');
      const [member] = await tx
        .select({ id: schema.members.id })
        .from(schema.members)
        .where(
          and(
            eq(schema.members.organizationId, payload.organizationId),
            eq(schema.members.userId, payload.requestedBy),
          ),
        );
      if (!member)
        throw new AppError('forbidden', 'Le demandeur n’est pas membre de l’organisation');
      await writeAudit(tx, {
        orgId: payload.organizationId,
        actorType: 'system',
        actorUserId: payload.requestedBy,
        action: 'queue.ping',
        targetType: 'job',
        targetId: jobId,
        metadata: { messageLength: payload.message.length },
      });
      return { pong: true, organizationId: payload.organizationId, at: new Date().toISOString() };
    },
  );
}
