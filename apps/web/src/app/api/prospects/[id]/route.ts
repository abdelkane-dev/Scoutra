import { z } from 'zod';
import { dataScope } from '@scoutra/auth';
import { AppError } from '@scoutra/core';
import { decryptSecret, type EncryptedSecret } from '@scoutra/crypto';
import { and, desc, eq, schema, withTenant, writeAudit } from '@scoutra/db';
import { cryptoKeys, scopeOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

function mask(channel: string, v: string): string {
  if (channel === 'email') {
    const [l = '', d = ''] = v.split('@');
    return `${l.slice(0, 1)}•••@${d}`;
  }
  return `${v.slice(0, 4)}•••${v.slice(-2)}`;
}

/**
 * Fiche prospect : preuves PAR CHAMP (source, URL, date, base légale, licence), score expliqué,
 * décisions du garde-fou par canal, coordonnées (en clair seulement si le prospect est livré,
 * consultation journalisée) et messages rédigés.
 */
export const GET = apiRoute(
  { action: 'prospect:read', params: z.object({ id: z.uuid() }) },
  async ({ req, params, ctx }) => {
    const owner = scopeOf(ctx, dataScope(ctx.role));
    const db = await appDb();
    const { keyring } = cryptoKeys();
    const out = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, async (tx) => {
      const p = schema.prospects;
      const [pr] = await tx
        .select()
        .from(p)
        .where(owner ? and(eq(p.id, params.id), eq(p.ownerUserId, owner)) : eq(p.id, params.id));
      if (!pr) throw new AppError('not_found');
      const evidence = await tx
        .select()
        .from(schema.evidence)
        .where(eq(schema.evidence.prospectId, pr.id));
      const contacts = await tx
        .select()
        .from(schema.contacts)
        .where(eq(schema.contacts.prospectId, pr.id));
      const messages = await tx
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.prospectId, pr.id))
        .orderBy(desc(schema.messages.createdAt));
      const reveal = !!pr.deliveredAt;
      const contactViews = contacts.map((c) => {
        let value: string | null;
        try {
          value = decryptSecret(
            c.valueEncrypted as EncryptedSecret,
            { orgId: ctx.orgId, purpose: `contact:${c.channel}` },
            keyring,
          );
        } catch {
          value = null;
        }
        return {
          id: c.id,
          channel: c.channel,
          value: value && (reveal ? value : mask(c.channel, value)),
          revealed: reveal && !!value,
          verificationStatus: c.verificationStatus,
          verifiedAt: c.verifiedAt,
          isRoleAddress: c.isRoleAddress,
          evidence: evidence.filter((e) => e.contactId === c.id).map((e) => e.id),
        };
      });
      if (reveal && contacts.length)
        await writeAudit(tx, {
          orgId: ctx.orgId,
          actorType: 'user',
          actorUserId: ctx.user.id,
          action: 'prospect.contacts_viewed',
          targetType: 'prospect',
          targetId: pr.id,
          userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? undefined,
        });
      const byField: Record<string, unknown[]> = {};
      for (const e of evidence) {
        (byField[e.fieldPath] ??= []).push({
          id: e.id,
          source: e.sourceCode,
          url: e.sourceUrl,
          collectedAt: e.collectedAt,
          legalBasis: e.legalBasis,
          license: e.sourceLicense,
          snippet: e.snippet,
        });
      }
      return {
        prospect: {
          id: pr.id,
          campaignId: pr.campaignId,
          kind: pr.kind,
          model: pr.prospectingModel,
          displayName: pr.displayName,
          countryCode: pr.countryCode,
          city: pr.city,
          websiteDomain: pr.websiteDomain,
          status: pr.status,
          rejectionReason: pr.rejectionReason,
          attributes: pr.attributes,
          sourceCodes: pr.sourceCodes,
          ownerUserId: pr.ownerUserId,
          deliveredAt: pr.deliveredAt,
          createdAt: pr.createdAt,
        },
        score: { value: pr.score, reasons: pr.scoreReasons },
        channels: pr.channelDecisions,
        evidence: byField,
        contacts: contactViews,
        messages: messages.map((m) => ({
          id: m.id,
          channel: m.channel,
          language: m.language,
          subject: m.subject,
          body: m.body,
          footer: m.footer,
          quality: m.quality,
          generatedBy: m.generatedBy,
          status: m.status,
          createdAt: m.createdAt,
        })),
      };
    });
    return json(out);
  },
);
