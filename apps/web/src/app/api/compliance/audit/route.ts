import { z } from 'zod';
import { memberNames } from '@scoutra/crm';
import { desc, eq, lt, and, schema, withTenant } from '@scoutra/db';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';
import { parseQuery } from '@/server/query';

export const dynamic = 'force-dynamic';

const query = z
  .object({
    action: z
      .string()
      .regex(/^[a-z0-9_.]{2,100}$/)
      .optional(),
    before: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();

/** Journal d'audit (admin, 2FA), du plus récent au plus ancien ; pagination par `before`. */
export const GET = apiRoute({ action: 'audit:read' }, async ({ req, ctx }) => {
  const q = parseQuery(req, query);
  const db = await appDb();
  const out = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
    const names = await memberNames(tx);
    const rows = await tx
      .select()
      .from(schema.auditLog)
      .where(
        and(
          q.action ? eq(schema.auditLog.action, q.action) : undefined,
          q.before ? lt(schema.auditLog.id, q.before) : undefined,
        ),
      )
      .orderBy(desc(schema.auditLog.id))
      .limit(q.limit);
    return rows.map((r) => ({
      id: r.id,
      at: r.createdAt,
      actorType: r.actorType,
      actor: r.actorUserId ? (names.get(r.actorUserId)?.name ?? null) : r.actorType,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      metadata: r.metadata,
    }));
  });
  return json({ items: out, nextBefore: out.length === q.limit ? out.at(-1)!.id : null });
});
