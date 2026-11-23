import { z } from 'zod';
import { AppError } from '@scoutra/core';
import { and, desc, eq, inArray, schema, sql, type Transaction } from '@scoutra/db';
import { logActivity } from './activity';
import { runAutomations } from './automations';
import type { Actor } from './prospects';
import { stopSequencesOnReply } from './sequences';

/**
 * Messages : AUCUN envoi automatique. L'utilisateur copie le brouillon, l'envoie lui-même, puis
 * saisit le statut (à envoyer, copié, envoyé à la main, répondu, écarté) et, s'il le souhaite,
 * le texte de la réponse reçue. La boîte unifiée est construite à partir de ces saisies.
 */
export const MESSAGE_STATUSES = [
  'draft',
  'to_send',
  'copied',
  'sent_manually',
  'replied',
  'discarded',
] as const;

export const messagePatchSchema = z
  .object({
    status: z.enum(MESSAGE_STATUSES).optional(),
    subject: z.string().trim().max(200).nullable().optional(),
    body: z.string().trim().min(1).max(4000).optional(),
    /** Texte de la réponse reçue (saisie manuelle), avec le statut `replied`. */
    replyText: z.string().trim().min(1).max(4000).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'au moins un champ')
  .refine((v) => !v.replyText || v.status === 'replied', {
    message: 'replyText avec status replied',
    path: ['replyText'],
  });
export type MessagePatch = z.infer<typeof messagePatchSchema>;

/** Message de l'organisation dont le prospect est visible par l'acteur, sinon 404. */
export async function loadVisibleMessage(tx: Transaction, actor: Actor, id: string) {
  const [row] = await tx
    .select({
      m: schema.messages,
      ownerUserId: schema.prospects.ownerUserId,
      stageKey: schema.prospects.stageKey,
    })
    .from(schema.messages)
    .innerJoin(schema.prospects, eq(schema.prospects.id, schema.messages.prospectId))
    .where(
      and(
        eq(schema.messages.id, id),
        actor.ownerOnly ? eq(schema.prospects.ownerUserId, actor.ownerOnly) : undefined,
      ),
    );
  if (!row) throw new AppError('not_found');
  return row;
}

export async function patchMessage(tx: Transaction, actor: Actor, id: string, p: MessagePatch) {
  const { m, stageKey } = await loadVisibleMessage(tx, actor, id);
  const set: Partial<typeof schema.messages.$inferInsert> = {};
  if (p.body !== undefined) {
    if (m.status === 'sent_manually' || m.status === 'replied')
      throw new AppError('conflict', 'message déjà envoyé');
    set.body = p.body;
  }
  if (p.subject !== undefined) set.subject = p.subject;
  if (p.status && p.status !== m.status) {
    set.status = p.status;
    if (p.status === 'sent_manually') set.sentAt = new Date();
    if (p.status === 'replied') set.repliedAt = new Date();
  }
  if (Object.keys(set).length)
    await tx.update(schema.messages).set(set).where(eq(schema.messages.id, id));
  if (set.status) {
    await logActivity(tx, {
      orgId: actor.orgId,
      prospectId: m.prospectId,
      actorUserId: actor.userId,
      type: 'message_status',
      payload: { messageId: id, from: m.status, to: set.status, channel: m.channel },
    });
    // Premier envoi : le prospect passe à « contacté » s'il était encore « nouveau ».
    if (set.status === 'sent_manually' && stageKey === 'new')
      await tx
        .update(schema.prospects)
        .set({ stageKey: 'contacted', stageChangedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(schema.prospects.id, m.prospectId));
    if (set.status === 'replied') {
      if (p.replyText)
        await logActivity(tx, {
          orgId: actor.orgId,
          prospectId: m.prospectId,
          actorUserId: actor.userId,
          type: 'reply_logged',
          payload: { messageId: id, channel: m.channel, text: p.replyText },
        });
      await stopSequencesOnReply(tx, m.prospectId);
      await runAutomations(tx, actor.orgId, { type: 'replied', prospectId: m.prospectId });
    }
  }
  const [after] = await tx.select().from(schema.messages).where(eq(schema.messages.id, id));
  return after!;
}

export interface ThreadItem {
  from: 'me' | 'them';
  kind: 'draft' | 'sent' | 'reply';
  body: string;
  subject: string | null;
  channel: string;
  status?: string;
  messageId?: string;
  at: Date;
}

/** Boîte unifiée : un fil par prospect, construit à partir des messages et des réponses saisies. */
export async function listThreads(
  tx: Transaction,
  actor: Actor,
  o: { limit: number; status?: 'replied' | 'to_send' | 'sent_manually' },
) {
  const p = schema.prospects;
  const latest = await tx
    .select({
      prospectId: schema.messages.prospectId,
      lastAt: sql<Date>`max(coalesce(${schema.messages.repliedAt}, ${schema.messages.sentAt}, ${schema.messages.createdAt}))`,
    })
    .from(schema.messages)
    .innerJoin(p, eq(p.id, schema.messages.prospectId))
    .where(
      and(
        actor.ownerOnly ? eq(p.ownerUserId, actor.ownerOnly) : undefined,
        o.status
          ? eq(schema.messages.status, o.status)
          : sql`${schema.messages.status} <> 'discarded'`,
      ),
    )
    .groupBy(schema.messages.prospectId)
    .orderBy(desc(sql`2`))
    .limit(o.limit);
  const ids = latest.map((l) => l.prospectId);
  if (!ids.length) return [];
  const prospects = await tx
    .select({ id: p.id, name: p.displayName, cc: p.countryCode })
    .from(p)
    .where(inArray(p.id, ids));
  const msgs = await tx
    .select()
    .from(schema.messages)
    .where(inArray(schema.messages.prospectId, ids))
    .orderBy(desc(schema.messages.createdAt));
  const replies = await tx
    .select()
    .from(schema.prospectActivities)
    .where(
      and(
        inArray(schema.prospectActivities.prospectId, ids),
        eq(schema.prospectActivities.type, 'reply_logged'),
      ),
    );
  return latest.map((l) => {
    const pm = msgs.filter((m) => m.prospectId === l.prospectId && m.status !== 'discarded');
    const items: ThreadItem[] = [
      ...pm.map((m) => ({
        from: 'me' as const,
        kind: (m.status === 'sent_manually' || m.status === 'replied'
          ? 'sent'
          : 'draft') as ThreadItem['kind'],
        body: m.body,
        subject: m.subject,
        channel: m.channel,
        status: m.status,
        messageId: m.id,
        at: m.sentAt ?? m.createdAt,
      })),
      ...replies
        .filter((r) => r.prospectId === l.prospectId)
        .map((r) => {
          const pl = r.payload as { text?: string; channel?: string };
          return {
            from: 'them' as const,
            kind: 'reply' as const,
            body: pl.text ?? '',
            subject: null,
            channel: pl.channel ?? 'email',
            at: r.createdAt,
          };
        }),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());
    const last = items[items.length - 1];
    const pr = prospects.find((x) => x.id === l.prospectId);
    return {
      prospectId: l.prospectId,
      prospectName: pr?.name ?? '',
      countryCode: pr?.cc ?? null,
      channel: last?.channel ?? 'email',
      lastAt: l.lastAt,
      subject: pm.find((m) => m.subject)?.subject ?? null,
      preview: (last?.body ?? '').slice(0, 160),
      awaitingAction: last?.from === 'them' || pm.some((m) => m.status === 'to_send'),
      items,
    };
  });
}
