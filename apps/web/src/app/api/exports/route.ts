import { z } from 'zod';
import { decryptSecret, type EncryptedSecret } from '@scoutra/crypto';
import { allowedChannelsOf, canDisclose } from '@scoutra/agents';
import { memberNames, prospectWhere, savedFiltersSchema, toCsv } from '@scoutra/crm';
import { and, desc, eq, inArray, schema, sql, withTenant, writeAudit } from '@scoutra/db';
import { actorOf, cryptoKeys } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

const MAX_ROWS = 5000;

/** Historique des exports de l'organisation. */
export const GET = apiRoute({ action: 'prospect:export' }, async ({ ctx }) => {
  const db = await appDb();
  const out = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
    const names = await memberNames(tx);
    const rows = await tx
      .select()
      .from(schema.exportLogs)
      .orderBy(desc(schema.exportLogs.createdAt))
      .limit(100);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      format: r.format,
      rows: r.rows,
      by: r.userId ? (names.get(r.userId)?.name ?? null) : null,
      at: r.createdAt,
      filters: r.filters,
    }));
  });
  return json({ items: out });
});

/**
 * Export CSV des prospects LIVRÉS correspondant aux critères (5 000 lignes au plus). Formules
 * neutralisées ; coordonnées seulement pour les canaux autorisés par le garde-fou ; journalisé.
 */
export const POST = apiRoute(
  {
    action: 'prospect:export',
    body: z
      .object({
        name: z.string().trim().min(1).max(120),
        filters: savedFiltersSchema.default({}),
        listId: z.uuid().optional(),
        includeContacts: z.boolean().default(true),
      })
      .strict(),
    rateLimit: { max: 10, windowMs: 60_000 },
  },
  async ({ body, ctx }) => {
    const actor = actorOf(ctx);
    const { keyring } = cryptoKeys();
    const db = await appDb();
    const csv = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
      const p = schema.prospects;
      const rows = await tx
        .select()
        .from(p)
        .where(
          and(
            prospectWhere(actor, body.filters),
            body.listId
              ? inArray(
                  p.id,
                  tx
                    .select({ id: schema.prospectListItems.prospectId })
                    .from(schema.prospectListItems)
                    .where(eq(schema.prospectListItems.listId, body.listId)),
                )
              : undefined,
          ),
        )
        .orderBy(sql`${p.score} desc nulls last`)
        .limit(MAX_ROWS);
      const names = await memberNames(tx);
      const contacts =
        body.includeContacts && rows.length
          ? await tx
              .select()
              .from(schema.contacts)
              .where(
                inArray(
                  schema.contacts.prospectId,
                  rows.map((r) => r.id),
                ),
              )
          : [];
      const value = (r: (typeof rows)[number], channel: 'email' | 'phone') => {
        const allowed = allowedChannelsOf(r.channelDecisions);
        if (!canDisclose({ channel, delivered: !!r.deliveredAt, allowedChannels: allowed }))
          return '';
        const c = contacts.find(
          (x) =>
            x.prospectId === r.id && x.channel === channel && x.verificationStatus !== 'invalid',
        );
        if (!c) return '';
        try {
          return decryptSecret(
            c.valueEncrypted as EncryptedSecret,
            { orgId: ctx.orgId, purpose: `contact:${channel}` },
            keyring,
          );
        } catch {
          return '';
        }
      };
      const header = [
        'name',
        'kind',
        'country',
        'city',
        'website',
        'score',
        'stage',
        'qualification',
        'owner',
        'email',
        'phone',
        'sources',
        'delivered_at',
      ];
      const data = rows.map((r) => [
        r.displayName,
        r.kind,
        r.countryCode,
        r.city,
        r.websiteDomain,
        r.score,
        r.stageKey,
        r.qualification,
        r.ownerUserId ? (names.get(r.ownerUserId)?.name ?? '') : '',
        body.includeContacts ? value(r, 'email') : '',
        body.includeContacts ? value(r, 'phone') : '',
        r.sourceCodes.join(' '),
        r.deliveredAt,
      ]);
      const [log] = await tx
        .insert(schema.exportLogs)
        .values({
          organizationId: ctx.orgId,
          userId: ctx.user.id,
          name: body.name,
          format: 'csv',
          rows: data.length,
          filters: {
            ...body.filters,
            listId: body.listId ?? null,
            includeContacts: body.includeContacts,
          },
        })
        .returning();
      await writeAudit(tx, {
        orgId: ctx.orgId,
        actorType: 'user',
        actorUserId: ctx.user.id,
        action: 'prospect.export',
        targetType: 'export',
        targetId: log!.id,
        metadata: { rows: data.length, includeContacts: body.includeContacts },
      });
      return toCsv(header, data);
    });
    const filename = `${body.name.replace(/[^\w.-]+/g, '_').slice(0, 60) || 'export'}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  },
);
