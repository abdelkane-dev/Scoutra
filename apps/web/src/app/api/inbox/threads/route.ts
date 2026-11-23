import { z } from 'zod';
import { listThreads } from '@scoutra/crm';
import { withTenant } from '@scoutra/db';
import { actorOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';
import { parseQuery } from '@/server/query';

export const dynamic = 'force-dynamic';

const query = z
  .object({
    status: z.enum(['replied', 'to_send', 'sent_manually']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

/** Boîte unifiée : un fil par prospect (brouillons, envois saisis, réponses saisies). */
export const GET = apiRoute({ action: 'message:read' }, async ({ req, ctx }) => {
  const q = parseQuery(req, query);
  const db = await appDb();
  const items = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
    listThreads(tx, actorOf(ctx), q),
  );
  return json({ items });
});
