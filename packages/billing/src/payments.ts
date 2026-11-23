import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { PlanCode, PackConfig } from './plans';

/**
 * Interface de paiement ABSTRAITE (carte bancaire via un prestataire international, à choisir) :
 * abonnements, packs, webhooks signés et idempotents. Aucun prestataire n'est implémenté.
 */
export const billingEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('subscription.activated'),
    eventId: z.string().min(4).max(200),
    /** Date de l'événement chez le prestataire : sert à l'ordre (constat 9). */
    occurredAt: z.iso.datetime(),
    organizationId: z.uuid(),
    plan: z.enum(['research', 'pipeline']),
    seats: z.int().min(1).max(500),
    periodStart: z.iso.datetime(),
    periodEnd: z.iso.datetime(),
    providerRef: z.string().max(200),
  }),
  z.object({
    type: z.literal('subscription.renewed'),
    eventId: z.string().min(4).max(200),
    /** Date de l'événement chez le prestataire : sert à l'ordre (constat 9). */
    occurredAt: z.iso.datetime(),
    organizationId: z.uuid(),
    periodStart: z.iso.datetime(),
    periodEnd: z.iso.datetime(),
  }),
  z.object({
    type: z.literal('subscription.canceled'),
    eventId: z.string().min(4).max(200),
    /** Date de l'événement chez le prestataire : sert à l'ordre (constat 9). */
    occurredAt: z.iso.datetime(),
    organizationId: z.uuid(),
  }),
  z.object({
    type: z.literal('pack.purchased'),
    eventId: z.string().min(4).max(200),
    /** Date de l'événement chez le prestataire : sert à l'ordre (constat 9). */
    occurredAt: z.iso.datetime(),
    organizationId: z.uuid(),
    pack: z.enum(['pack_500', 'pack_2500', 'pack_10000']),
  }),
]);
export type BillingEvent = z.infer<typeof billingEventSchema>;

export interface CheckoutRequest {
  organizationId: string;
  item:
    { kind: 'plan'; plan: PlanCode; seats: number } | { kind: 'pack'; pack: PackConfig['code'] };
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentProvider {
  readonly code: string;
  createCheckout(req: CheckoutRequest): Promise<{ url: string }>;
  /** Vérifie la signature et traduit l'événement du prestataire ; null si ignoré. */
  parseWebhook(rawBody: string, headers: Headers): Promise<BillingEvent | null>;
  /** Moyen de paiement (masqué) et factures de l'organisation, lus chez le prestataire. */
  getCustomerOverview?(organizationId: string): Promise<CustomerOverview>;
}

export interface CustomerOverview {
  paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null;
  invoices: {
    id: string;
    date: string;
    amountUsd: number;
    status: 'paid' | 'open' | 'void';
    url?: string;
  }[];
}

/**
 * Vérification générique d'une signature HMAC-SHA256 horodatée (`t=<unix>,v1=<hex>` sur
 * `${t}.${body}`), comparaison à temps constant, fenêtre anti-rejeu. Les adaptateurs de
 * prestataire s'appuient dessus ou sur leur propre SDK.
 */
export function verifySignedPayload(
  rawBody: string,
  header: string | null,
  secret: string,
  opts: { toleranceSec?: number; now?: number } = {},
): boolean {
  if (!header || secret.length < 16) return false;
  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const [k, ...v] = kv.trim().split('=');
      return [k, v.join('=')];
    }),
  ) as Record<string, string | undefined>;
  const t = Number(parts.t);
  const sig = parts.v1;
  if (!Number.isInteger(t) || !sig || !/^[0-9a-f]{64}$/.test(sig)) return false;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > (opts.toleranceSec ?? 300)) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest();
  const got = Buffer.from(sig, 'hex');
  return got.length === expected.length && timingSafeEqual(got, expected);
}
