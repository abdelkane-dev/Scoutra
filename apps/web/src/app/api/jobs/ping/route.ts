import { z } from 'zod';
import { pingJob, publish } from '@scoutra/queue';
import { apiRoute, json } from '@/server/http';
import { getBoss } from '@/server/queue';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ message: z.string().trim().min(1).max(200) }).strict();

/** Démonstration de bout en bout : publie une tâche « ping » pour l'organisation active. */
export const POST = apiRoute(
  { action: 'job:ping', body: bodySchema, rateLimit: { max: 20, windowMs: 60_000 } },
  async ({ body, ctx }) => {
    const jobId = await publish(await getBoss(), pingJob, {
      organizationId: ctx.orgId,
      requestedBy: ctx.user.id,
      message: body.message,
    });
    return json({ jobId }, { status: 202 });
  },
);
