import { createRequest, dsrInputSchema } from '@scoutra/crm';
import { desc, schema, withTenant } from '@scoutra/db';
import { cryptoKeys } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Demandes des personnes concernées (effacement, opposition, accès) et délai légal restant. */
export const GET = apiRoute({ action: 'compliance:read' }, async ({ ctx }) => {
  const db = await appDb();
  const rows = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
    tx
      .select()
      .from(schema.dataSubjectRequests)
      .orderBy(desc(schema.dataSubjectRequests.receivedAt))
      .limit(500),
  );
  const now = Date.now();
  return json({
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      requester: r.subjectHint,
      status: r.status,
      receivedAt: r.receivedAt,
      dueAt: r.dueAt,
      daysLeft:
        r.status === 'done' ? 0 : Math.max(0, Math.ceil((r.dueAt.getTime() - now) / 86_400_000)),
      completedAt: r.completedAt,
      result: r.result,
    })),
  });
});

/** Enregistre une demande reçue (tout commercial) ; le traitement est réservé aux admins. */
export const POST = apiRoute(
  { action: 'prospect:write', body: dsrInputSchema },
  async ({ body, ctx }) => {
    const db = await appDb();
    const r = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      createRequest(tx, { orgId: ctx.orgId, hashKey: cryptoKeys().hashKey }, body),
    );
    return json(
      { id: r.id, type: r.type, requester: r.subjectHint, status: r.status, dueAt: r.dueAt },
      { status: 201 },
    );
  },
);
