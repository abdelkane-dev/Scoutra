import { z } from 'zod';
import { schema, withTenant, writeAudit } from '@scoutra/db';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Demande d'assistance (enregistrée ; aucune pièce jointe, texte borné). */
export const POST = apiRoute(
  {
    action: 'org:read',
    body: z
      .object({
        category: z.enum(['question', 'bug', 'billing', 'privacy', 'other']),
        subject: z.string().trim().min(3).max(200),
        message: z.string().trim().min(10).max(5000),
      })
      .strict(),
    rateLimit: { max: 5, windowMs: 3_600_000 },
  },
  async ({ body, ctx }) => {
    const db = await appDb();
    const [r] = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
      const rows = await tx
        .insert(schema.supportRequests)
        .values({ organizationId: ctx.orgId, userId: ctx.user.id, ...body })
        .returning();
      await writeAudit(tx, {
        orgId: ctx.orgId,
        actorType: 'user',
        actorUserId: ctx.user.id,
        action: 'support.requested',
        targetType: 'support_request',
        targetId: rows[0]!.id,
        metadata: { category: body.category },
      });
      return rows;
    });
    return json({ id: r!.id, status: r!.status, createdAt: r!.createdAt }, { status: 201 });
  },
);
