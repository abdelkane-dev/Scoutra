import { z } from 'zod';
import { processRequest } from '@scoutra/crm';
import { withTenant } from '@scoutra/db';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/**
 * Traitement (admin, 2FA) : effacement en cascade (coordonnées ; prospect PERSONNE supprimé
 * entièrement), opposition, accès (inventaire sans valeurs) ; ajout à la liste d'opposition.
 */
export const POST = apiRoute(
  { action: 'compliance:manage', params: z.object({ id: z.uuid() }) },
  async ({ params, ctx }) => {
    const db = await appDb();
    const r = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      processRequest(tx, { orgId: ctx.orgId, userId: ctx.user.id }, params.id),
    );
    return json({ id: r.id, status: r.status, completedAt: r.completedAt, result: r.result });
  },
);
