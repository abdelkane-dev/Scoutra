import { z } from 'zod';
import { dataScope } from '@scoutra/auth';
import { AppError } from '@scoutra/core';
import { eq, readCampaignEvents, schema, withTenant } from '@scoutra/db';
import { loadCampaign, scopeOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute } from '@/server/http';
import { acquireStream, campaignListener } from '@/server/streams';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FINAL = new Set(['completed', 'cancelled', 'failed']);
/** Attente maximale entre deux relectures si aucune notification n'arrive (filet de sécurité). */
const FALLBACK_MS = 15_000;
const HEARTBEAT_MS = 20_000;
const MAX_MS = 10 * 60_000;

/**
 * Suivi en direct (Server-Sent Events). Reprise après coupure : en-tête `Last-Event-ID` (ou
 * `?lastEventId=`) → relecture depuis la table campaign_events, sous RLS. Battement de cœur
 * toutes les 20 s ; fermeture à la fin de la campagne ou après 10 min (le navigateur se reconnecte).
 */
export const GET = apiRoute(
  { action: 'campaign:read', params: z.object({ id: z.uuid() }) },
  async ({ req, params, ctx }) => {
    const owner = scopeOf(ctx, dataScope(ctx.role));
    const db = await appDb();
    const tenant = { orgId: ctx.orgId, userId: ctx.user.id };
    await withTenant(db, tenant, (tx) => loadCampaign(tx, params.id, owner));
    const release = acquireStream(ctx.orgId, ctx.user.id);
    if (!release) throw new AppError('rate_limited', 'flux SSE simultanés');
    const listener = campaignListener();
    const rawLast = req.headers.get('last-event-id') ?? req.nextUrl.searchParams.get('lastEventId');
    let last = rawLast && /^\d{1,15}$/.test(rawLast) ? Number(rawLast) : 0;
    const enc = new TextEncoder();
    const started = Date.now();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let lastBeat = Date.now();
        let wake: (() => void) | null = null;
        const unsubscribe = listener.subscribe(params.id, () => wake?.());
        const onAbort = () => wake?.();
        req.signal.addEventListener('abort', onAbort);
        const send = (s: string) => controller.enqueue(enc.encode(s));
        send(`retry: 3000\n\n`);
        try {
          while (!req.signal.aborted && Date.now() - started < MAX_MS) {
            const { events, status } = await withTenant(db, tenant, async (tx) => {
              const [c] = await tx
                .select({ status: schema.campaigns.status })
                .from(schema.campaigns)
                .where(eq(schema.campaigns.id, params.id));
              return { events: await readCampaignEvents(tx, params.id, last), status: c?.status };
            });
            for (const e of events) {
              last = e.id;
              send(
                `id: ${e.id}\nevent: ${e.type}\ndata: ${JSON.stringify({ ...(e.payload as object), at: e.createdAt })}\n\n`,
              );
            }
            if (!status || (FINAL.has(status) && events.length === 0)) break;
            if (Date.now() - lastBeat > HEARTBEAT_MS) {
              send(`: ping\n\n`);
              lastBeat = Date.now();
            }
            // Attente d'une notification (LISTEN/NOTIFY), d'un battement ou d'une coupure.
            await new Promise<void>((resolve) => {
              const t = setTimeout(done, Math.min(FALLBACK_MS, HEARTBEAT_MS));
              function done() {
                clearTimeout(t);
                wake = null;
                resolve();
              }
              wake = done;
            });
          }
        } catch {
          send(`event: error\ndata: {"code":"internal"}\n\n`);
        } finally {
          unsubscribe();
          req.signal.removeEventListener('abort', onAbort);
          release();
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      },
    });
  },
);
