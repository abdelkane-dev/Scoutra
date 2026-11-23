import { and, desc, eq, isNull, schema, withTenant } from '@scoutra/db';
import { apiRoute, json } from '@/server/http';
import { appDb } from '@/server/db';

export const dynamic = 'force-dynamic';

/** Mes notifications (automatisations « notifier »), 100 dernières. */
export const GET = apiRoute({ action: 'org:read' }, async ({ ctx }) => {
  const db = await appDb();
  const { items, unread } = await withTenant(
    db,
    { orgId: ctx.orgId, userId: ctx.user.id },
    async (tx) => {
      const mine = eq(schema.notifications.userId, ctx.user.id);
      const items = await tx
        .select()
        .from(schema.notifications)
        .where(mine)
        .orderBy(desc(schema.notifications.createdAt))
        .limit(100);
      const unread = (
        await tx
          .select({ id: schema.notifications.id })
          .from(schema.notifications)
          .where(and(mine, isNull(schema.notifications.readAt)))
      ).length;
      return { items, unread };
    },
  );
  return json({
    unread,
    items: items.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      link: n.link,
      read: !!n.readAt,
      at: n.createdAt,
    })),
  });
});
