import { z } from 'zod';
import { dataScope } from '@scoutra/auth';
import { AppError, prospectingModelSchema } from '@scoutra/core';
import { and, count, desc, eq, gte, schema, withTenant } from '@scoutra/db';
import { LOCALE_COOKIE, negotiateLocale } from '@scoutra/i18n';
import { planFor, startInterpretation } from '@scoutra/queue';
import { campaignView, scopeOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { getEnv } from '@/server/env';
import { apiRoute, json } from '@/server/http';
import { parseQuery } from '@/server/query';
import { getBoss } from '@/server/queue';

export const dynamic = 'force-dynamic';

const STATUSES = [
  'interpreting',
  'awaiting_confirmation',
  'running',
  'cancelling',
  'cancelled',
  'completed',
  'failed',
] as const;

const listQuery = z
  .object({
    status: z.enum(STATUSES).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
  })
  .strict();

/** Liste des campagnes (membre : les siennes ; chef d'équipe, admin, lecture seule : toutes). */
export const GET = apiRoute({ action: 'campaign:read' }, async ({ req, ctx }) => {
  const q = parseQuery(req, listQuery);
  const owner = scopeOf(ctx, dataScope(ctx.role));
  const db = await appDb();
  const rows = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
    tx
      .select()
      .from(schema.campaigns)
      .where(
        and(
          owner ? eq(schema.campaigns.createdBy, owner) : undefined,
          q.status ? eq(schema.campaigns.status, q.status) : undefined,
        ),
      )
      .orderBy(desc(schema.campaigns.createdAt))
      .limit(q.limit + 1)
      .offset(q.offset),
  );
  return json({
    items: rows.slice(0, q.limit).map(campaignView),
    nextOffset: rows.length > q.limit ? q.offset + q.limit : null,
  });
});

const createBody = z
  .object({
    prompt: z.string().trim().min(10).max(2000),
    name: z.string().trim().min(1).max(200).optional(),
    /** Modèle imposé ; sinon l'Interprète le choisit. */
    model: prospectingModelSchema.optional(),
    maxProspects: z.int().min(5).max(1500).default(50),
    quality: z.enum(['standard', 'careful', 'premium']).default('standard'),
  })
  .strict();

/** Crée une campagne et lance l'interprétation (texte libre → fiche de cible + estimation). */
export const POST = apiRoute(
  { action: 'campaign:write', body: createBody, rateLimit: { max: 20, windowMs: 60_000 } },
  async ({ req, body, ctx }) => {
    const env = getEnv();
    const db = await appDb();
    const locale = negotiateLocale(
      req.headers.get('accept-language'),
      req.cookies.get(LOCALE_COOKIE)?.value,
    );
    const id = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
      if (env.SCOUTRA_MODE === 'saas') {
        const { plan } = await planFor(tx, new Date());
        if (body.maxProspects > plan.maxProspectsPerCampaign)
          throw new AppError('quota_exceeded', 'prospects par campagne');
        const dayStart = new Date(new Date().setUTCHours(0, 0, 0, 0));
        const [today] = await tx
          .select({ n: count() })
          .from(schema.campaigns)
          .where(gte(schema.campaigns.createdAt, dayStart));
        if ((today?.n ?? 0) >= plan.interpretationsPerDay)
          throw new AppError('quota_exceeded', 'interprétations par jour');
      }
      const [c] = await tx
        .insert(schema.campaigns)
        .values({
          organizationId: ctx.orgId,
          createdBy: ctx.user.id,
          name: body.name ?? body.prompt.slice(0, 80),
          promptText: body.prompt,
          prospectingModel: body.model ?? 'b2b',
          modelForced: !!body.model,
          status: 'interpreting',
          maxProspects: body.maxProspects,
          quality: body.quality,
        })
        .returning({ id: schema.campaigns.id });
      return c!.id;
    });
    await startInterpretation(await getBoss(), db, {
      orgId: ctx.orgId,
      userId: ctx.user.id,
      campaignId: id,
      locale: locale === 'en' ? 'en' : 'fr',
    });
    return json({ id, status: 'interpreting' }, { status: 202 });
  },
);
