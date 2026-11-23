import { z } from 'zod';
import { AppError } from '@scoutra/core';
import { sequenceStepSchema } from '@scoutra/crm';
import { eq, schema, withTenant } from '@scoutra/db';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

const body = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    status: z.enum(['active', 'paused', 'archived']).optional(),
    steps: z.array(sequenceStepSchema).min(1).max(20).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'au moins un champ');

/** Modification (nom, statut, étapes) ; les inscriptions en cours suivent les nouvelles étapes. */
export const PATCH = apiRoute(
  { action: 'sequence:manage', params: z.object({ id: z.uuid() }), body },
  async ({ params, body, ctx }) => {
    const db = await appDb();
    const [s] = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      tx.update(schema.sequences).set(body).where(eq(schema.sequences.id, params.id)).returning(),
    );
    if (!s) throw new AppError('not_found');
    return json({ id: s.id, name: s.name, status: s.status, steps: s.steps });
  },
);
