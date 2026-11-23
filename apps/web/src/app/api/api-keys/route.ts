import { z } from 'zod';
import { encryptSecret } from '@scoutra/crypto';
import { desc, schema, withTenant, writeAudit } from '@scoutra/db';
import { cryptoKeys } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Fournisseurs dont l'organisation peut fournir SA clé (sinon clé plateforme / mode dégradé). */
const PROVIDERS = ['serper', 'brave', 'tavily', 'google_places', 'companies_house'] as const;

const view = (k: typeof schema.apiCredentials.$inferSelect) => ({
  id: k.id,
  provider: k.provider,
  label: k.label,
  last4: k.last4,
  createdAt: k.createdAt,
  lastUsedAt: k.lastUsedAt,
  revokedAt: k.revokedAt,
});

/** Clés d'API de l'organisation (masquées : seuls les 4 derniers caractères). */
export const GET = apiRoute({ action: 'apikey:manage' }, async ({ ctx }) => {
  const db = await appDb();
  const rows = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
    tx.select().from(schema.apiCredentials).orderBy(desc(schema.apiCredentials.createdAt)),
  );
  return json({ items: rows.map(view), providers: PROVIDERS });
});

/** Ajout d'une clé : chiffrée par enveloppe (AES-256-GCM, clé maître), jamais renvoyée. */
export const POST = apiRoute(
  {
    action: 'apikey:manage',
    body: z
      .object({
        provider: z.enum(PROVIDERS),
        label: z.string().trim().min(1).max(100),
        key: z
          .string()
          .trim()
          .min(8)
          .max(500)
          .regex(/^[\x21-\x7e]+$/, 'caractères imprimables sans espace'),
      })
      .strict(),
    rateLimit: { max: 10, windowMs: 60_000 },
  },
  async ({ body, ctx }) => {
    const db = await appDb();
    const sealed = encryptSecret(
      body.key,
      { orgId: ctx.orgId, purpose: `api_credential:${body.provider}` },
      cryptoKeys().keyring,
    );
    const row = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
      const [k] = await tx
        .insert(schema.apiCredentials)
        .values({
          organizationId: ctx.orgId,
          provider: body.provider,
          label: body.label,
          ciphertext: sealed.ciphertext,
          wrappedDek: sealed.wrappedDek,
          keyVersion: sealed.keyVersion,
          last4: body.key.slice(-4),
          createdBy: ctx.user.id,
        })
        .returning();
      await writeAudit(tx, {
        orgId: ctx.orgId,
        actorType: 'user',
        actorUserId: ctx.user.id,
        action: 'apikey.created',
        targetType: 'api_credential',
        targetId: k!.id,
        metadata: { provider: body.provider },
      });
      return k!;
    });
    return json(view(row), { status: 201 });
  },
);
