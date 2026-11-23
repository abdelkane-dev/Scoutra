import { automationInputSchema, validateAutomationRefs } from '@scoutra/crm';
import { desc, schema, withTenant } from '@scoutra/db';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

const view = (a: typeof schema.automations.$inferSelect) => ({
  id: a.id,
  name: a.name,
  enabled: a.enabled,
  trigger: a.trigger,
  triggerArg: a.triggerArg,
  action: a.action,
  actionArg: a.actionArg,
  runs: a.runs,
  lastRunAt: a.lastRunAt,
});

/** Automatisations internes (déclencheur → action), sans aucun envoi de message. */
export const GET = apiRoute({ action: 'automation:read' }, async ({ ctx }) => {
  const db = await appDb();
  const rows = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
    tx.select().from(schema.automations).orderBy(desc(schema.automations.createdAt)),
  );
  return json({ items: rows.map(view) });
});

export const POST = apiRoute(
  { action: 'automation:manage', body: automationInputSchema },
  async ({ body, ctx }) => {
    const db = await appDb();
    const [a] = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
      await validateAutomationRefs(tx, ctx.orgId, body);
      return tx
        .insert(schema.automations)
        .values({ organizationId: ctx.orgId, ...body, createdBy: ctx.user.id })
        .returning();
    });
    return json(view(a!), { status: 201 });
  },
);
