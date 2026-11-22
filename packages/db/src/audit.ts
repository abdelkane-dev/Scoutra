import { z } from 'zod';
import type { Transaction } from './client';
import { auditLog } from './schema';

export const auditEntrySchema = z.object({
  orgId: z.uuid(),
  actorType: z.enum(['user', 'system', 'agent']),
  actorUserId: z.uuid().optional(),
  action: z.string().regex(/^[a-z][a-z0-9_.:-]{1,99}$/),
  targetType: z.string().max(100).optional(),
  targetId: z.string().max(100).optional(),
  ipHash: z.string().length(64).optional(),
  userAgent: z.string().max(300).optional(),
  /** Métadonnées SANS donnée personnelle ni secret. */
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type AuditEntry = z.input<typeof auditEntrySchema>;

/** Ajoute une ligne au journal d'audit (à appeler dans une transaction withTenant). */
export async function writeAudit(tx: Transaction, entry: AuditEntry): Promise<void> {
  const e = auditEntrySchema.parse(entry);
  await tx.insert(auditLog).values({
    organizationId: e.orgId,
    actorType: e.actorType,
    actorUserId: e.actorUserId,
    action: e.action,
    targetType: e.targetType,
    targetId: e.targetId,
    ipHash: e.ipHash,
    userAgent: e.userAgent,
    metadata: e.metadata,
  });
}
