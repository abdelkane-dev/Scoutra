import { z } from 'zod';
import { listStages, replaceStages } from '@scoutra/crm';
import { withTenant } from '@scoutra/db';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

const view = (s: {
  key: string;
  labelFr: string;
  labelEn: string;
  kind: string;
  position: number;
}) => ({
  key: s.key,
  label: { fr: s.labelFr, en: s.labelEn },
  kind: s.kind,
  position: s.position,
});

/** Étapes du pipeline (créées par défaut au premier accès). */
export const GET = apiRoute({ action: 'pipeline:read' }, async ({ ctx }) => {
  const db = await appDb();
  const stages = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
    listStages(tx, ctx.orgId),
  );
  return json({ items: stages.map(view) });
});

const body = z
  .object({
    stages: z
      .array(
        z
          .object({
            key: z.string().regex(/^[a-z0-9_]{2,40}$/),
            label: z
              .object({
                fr: z.string().trim().min(1).max(60),
                en: z.string().trim().min(1).max(60),
              })
              .strict(),
            kind: z.enum(['open', 'won', 'lost']),
          })
          .strict(),
      )
      .min(2)
      .max(15)
      .refine((a) => new Set(a.map((s) => s.key)).size === a.length, 'clés uniques'),
  })
  .strict();

/** Configuration des étapes (chef d'équipe) : ordre = position ; `new` obligatoire. */
export const PUT = apiRoute({ action: 'pipeline:manage', body }, async ({ body, ctx }) => {
  const db = await appDb();
  const stages = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
    replaceStages(
      tx,
      ctx.orgId,
      body.stages.map((s) => ({
        key: s.key,
        labelFr: s.label.fr,
        labelEn: s.label.en,
        kind: s.kind,
      })),
    ),
  );
  return json({ items: stages.map(view) });
});
