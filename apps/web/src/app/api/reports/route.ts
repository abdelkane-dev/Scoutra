import { z } from 'zod';
import { can } from '@scoutra/auth';
import { buildReport } from '@scoutra/crm';
import { withTenant } from '@scoutra/db';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';
import { parseQuery } from '@/server/query';

export const dynamic = 'force-dynamic';

const query = z.object({ range: z.enum(['7d', '30d', '90d', '365d']).default('90d') }).strict();

/**
 * Rapports réels : entonnoir, réponses par canal, pays, semaines, crédits, et par membre pour
 * les rôles qui voient l'équipe (report:read_team). Un membre ne voit que ses chiffres.
 */
export const GET = apiRoute({ action: 'report:read_own' }, async ({ req, ctx }) => {
  const q = parseQuery(req, query);
  const team = can(ctx.role, 'report:read_team');
  const db = await appDb();
  const report = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
    buildReport(tx, ctx.orgId, {
      days: Number(q.range.replace('d', '')),
      ownerOnly: team ? null : ctx.user.id,
      team,
    }),
  );
  return json(report);
});
