import { z } from 'zod';
import { AppError } from '@scoutra/core';
import { automationInputSchema, validateAutomationRefs } from '@scoutra/crm';
import { eq, schema, withTenant } from '@scoutra/db';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Remplacement complet d'une règle (même schéma que la création) ou activation. */
export const PUT = apiRoute(
  { action: 'automation:manage', params: z.object({ id: z.uuid() }), body: automationInputSchema },
  async ({ params, body, ctx }) => {
    const db = await appDb();
    const [a] = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
      await validateAutomationRefs(tx, ctx.orgId, body);
      return tx
        .update(schema.automations)
        .set(body)
        .where(eq(schema.automations.id, params.id))
        .returning();
    });
    if (!a) throw new AppError('not_found');
    return json({
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
  },
);

export const DELETE = apiRoute(
  { action: 'automation:manage', params: z.object({ id: z.uuid() }) },
  async ({ params, ctx }) => {
    const db = await appDb();
    const rows = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      tx
        .delete(schema.automations)
        .where(eq(schema.automations.id, params.id))
        .returning({ id: schema.automations.id }),
    );
    if (!rows.length) throw new AppError('not_found');
    return json({ deleted: true });
  },
);
