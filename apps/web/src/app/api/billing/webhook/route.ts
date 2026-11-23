import { NextResponse, type NextRequest } from 'next/server';
import { applyBillingEvent } from '@scoutra/queue';
import { appDb } from '@/server/db';
import { getPaymentProvider } from '@/server/payments';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BODY = 64 * 1024;
const reply = (status: number, body: unknown) =>
  NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });

/**
 * Webhook du prestataire de paiement. Public par nature (appelé par le prestataire, sans session
 * ni en-tête Origin) : l'authenticité repose UNIQUEMENT sur la signature vérifiée par
 * l'adaptateur ; l'application est idempotente (rejeu sans double crédit).
 */
export async function POST(req: NextRequest) {
  const provider = getPaymentProvider();
  if (!provider) return reply(404, { error: { code: 'not_found' } });
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY) return reply(413, { error: { code: 'invalid_input' } });
  const raw = await req.text();
  if (Buffer.byteLength(raw) > MAX_BODY) return reply(413, { error: { code: 'invalid_input' } });
  let event;
  try {
    event = await provider.parseWebhook(raw, req.headers);
  } catch {
    return reply(400, { error: { code: 'invalid_signature' } });
  }
  if (!event) return reply(200, { received: true, ignored: true });
  try {
    const r = await applyBillingEvent(await appDb(), event);
    return reply(200, { received: true, result: r });
  } catch {
    console.error('[billing] échec du traitement d’un événement de paiement');
    return reply(500, { error: { code: 'internal' } });
  }
}
