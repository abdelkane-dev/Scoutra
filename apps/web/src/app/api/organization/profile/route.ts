import { orgProfileSchema } from '@scoutra/core';
import { eq, schema, withTenant, writeAudit } from '@scoutra/db';
import { apiRoute, json } from '@/server/http';
import { appDb } from '@/server/db';

export const dynamic = 'force-dynamic';

/**
 * Profil de l'organisation (onboarding) : type de compte + secteurs. owner/admin uniquement
 * (action org:profile). Le pays d'établissement n'est PAS modifiable ici.
 */
export const PUT = apiRoute(
  { action: 'org:profile', body: orgProfileSchema, rateLimit: { max: 20, windowMs: 60_000 } },
  async ({ body, ctx }) => {
    const db = await appDb();
    await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
      await tx
        .update(schema.organizations)
        .set({ accountType: body.accountType, sectors: body.sectors })
        .where(eq(schema.organizations.id, ctx.orgId));
      await writeAudit(tx, {
        orgId: ctx.orgId,
        actorType: 'user',
        actorUserId: ctx.user.id,
        action: 'org.profile_updated',
        targetType: 'organization',
        targetId: ctx.orgId,
        metadata: { accountType: body.accountType, sectors: body.sectors },
      });
    });
    return json({ accountType: body.accountType, sectors: body.sectors });
  },
);
