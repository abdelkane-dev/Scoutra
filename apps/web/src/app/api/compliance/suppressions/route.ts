import { addSuppression, memberNames, suppressionInputSchema } from '@scoutra/crm';
import { desc, schema, withTenant } from '@scoutra/db';
import { cryptoKeys } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Liste d'opposition (indices masqués : la valeur n'est jamais stockée). */
export const GET = apiRoute({ action: 'compliance:read' }, async ({ ctx }) => {
  const db = await appDb();
  const items = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
    const names = await memberNames(tx);
    const rows = await tx
      .select()
      .from(schema.suppressionList)
      .orderBy(desc(schema.suppressionList.createdAt))
      .limit(500);
    return rows.map((r) => ({
      id: r.id,
      kind: r.valueKind,
      hint: r.displayHint,
      reason: r.reason,
      note: r.note,
      by: r.createdBy ? (names.get(r.createdBy)?.name ?? null) : 'system',
      at: r.createdAt,
    }));
  });
  return json({ items });
});

/**
 * Ajout d'une opposition (tout commercial peut enregistrer une demande de désinscription) :
 * coordonnées correspondantes supprimées, domaine entier possible, jamais recollecté.
 */
export const POST = apiRoute(
  { action: 'prospect:write', body: suppressionInputSchema },
  async ({ body, ctx }) => {
    const db = await appDb();
    const r = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      addSuppression(
        tx,
        { orgId: ctx.orgId, userId: ctx.user.id, hashKey: cryptoKeys().hashKey },
        body,
      ),
    );
    return json(r, { status: r.duplicate ? 200 : 201 });
  },
);
