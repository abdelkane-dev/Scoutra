import { z } from 'zod';
import { AppError } from '@scoutra/core';
import { getJobForOrg, pingJob } from '@scoutra/queue';
import { apiRoute, json } from '@/server/http';
import { getBoss } from '@/server/queue';

export const dynamic = 'force-dynamic';

/** État d'une tâche ping, seulement si elle appartient à l'organisation active. */
export const GET = apiRoute(
  { action: 'org:read', params: z.object({ jobId: z.uuid() }) },
  async ({ params, ctx }) => {
    const job = await getJobForOrg(await getBoss(), pingJob, params.jobId, ctx.orgId);
    if (!job) throw new AppError('not_found');
    return json({ id: job.id, state: job.state, output: job.output });
  },
);
