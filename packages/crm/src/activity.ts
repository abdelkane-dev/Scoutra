import { schema, sql, type Transaction } from '@scoutra/db';

export type ActivityType =
  | 'stage_changed'
  | 'owner_changed'
  | 'qualification_changed'
  | 'note'
  | 'message_status'
  | 'reply_logged'
  | 'task_created'
  | 'task_done'
  | 'sequence_enrolled'
  | 'list_added'
  | 'automation';

/** Historique d'un prospect (ajout seul). */
export async function logActivity(
  tx: Transaction,
  a: {
    orgId: string;
    prospectId: string;
    actorUserId?: string | null;
    type: ActivityType;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.insert(schema.prospectActivities).values({
    organizationId: a.orgId,
    prospectId: a.prospectId,
    actorUserId: a.actorUserId ?? null,
    type: a.type,
    payload: a.payload ?? {},
  });
}

/** Noms des membres de l'organisation courante (fonction SQL filtrée par organisation). */
export async function memberNames(
  tx: Transaction,
): Promise<Map<string, { name: string; role: string }>> {
  const res = await tx.execute<{ user_id: string; name: string; role: string }>(
    sql`select user_id, name, role from app_org_member_names()`,
  );
  return new Map(res.rows.map((r) => [r.user_id, { name: r.name, role: r.role }]));
}
