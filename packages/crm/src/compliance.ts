import { z } from 'zod';
import { AppError, isIndividualKind } from '@scoutra/core';
import { keyedHash, normalizeContactValue } from '@scoutra/crypto';
import { and, eq, inArray, schema, sql, writeAudit, type Transaction } from '@scoutra/db';

/**
 * Conformité : oppositions (liste de suppression, empreintes seulement) et demandes des
 * personnes concernées (effacement en cascade, opposition, accès) avec délai légal suivi.
 */
export const suppressionInputSchema = z
  .object({
    kind: z.enum(['email', 'phone', 'domain']),
    value: z.string().trim().min(3).max(320),
    reason: z.enum(['opt_out', 'erasure', 'bounce', 'complaint']).default('opt_out'),
    note: z.string().trim().max(200).optional(),
  })
  .strict();

export function maskHint(kind: 'email' | 'phone' | 'domain', v: string): string {
  if (kind === 'domain') return v;
  if (kind === 'email') {
    const [l = '', d = ''] = v.split('@');
    return `${l.slice(0, 1)}•••@${d}`.slice(0, 120);
  }
  return `•••${v.slice(-2)}`;
}

/** Valeur normalisée + empreinte (même calcul que l'insertion des contacts). */
export function subjectHash(kind: 'email' | 'phone' | 'domain', value: string, hashKey: Buffer) {
  if (kind === 'domain') {
    const d = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]!;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d))
      throw new AppError('invalid_input', 'domaine', [{ path: 'value', code: 'invalid_domain' }]);
    return { normalized: d, hash: keyedHash(d, hashKey, 'domain'), channel: 'email' as const };
  }
  const normalized = normalizeContactValue(kind, value);
  if (kind === 'email' && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(normalized))
    throw new AppError('invalid_input', 'email', [{ path: 'value', code: 'invalid_email' }]);
  if (kind === 'phone' && !/^\+?\d{6,16}$/.test(normalized))
    throw new AppError('invalid_input', 'téléphone', [{ path: 'value', code: 'invalid_phone' }]);
  return { normalized, hash: keyedHash(normalized, hashKey, `contact:${kind}`), channel: kind };
}

/**
 * Ajoute une opposition et applique ses effets : coordonnées correspondantes supprimées ; pour un
 * domaine, prospects de ce domaine marqués « opposition ». La valeur n'est jamais stockée.
 */
export async function addSuppression(
  tx: Transaction,
  o: { orgId: string; userId: string; hashKey: Buffer },
  i: z.infer<typeof suppressionInputSchema>,
) {
  const s = subjectHash(i.kind, i.value, o.hashKey);
  const [row] = await tx
    .insert(schema.suppressionList)
    .values({
      organizationId: o.orgId,
      valueHash: s.hash,
      channel: s.channel,
      reason: i.reason,
      valueKind: i.kind,
      displayHint: maskHint(i.kind, s.normalized),
      note: i.note,
      createdBy: o.userId,
    })
    .onConflictDoNothing()
    .returning();
  let contactsDeleted = 0;
  let prospectsSuppressed = 0;
  if (i.kind === 'domain') {
    const rows = await tx
      .update(schema.prospects)
      .set({ status: 'suppressed', rejectionReason: 'opposition', updatedAt: sql`now()` })
      .where(eq(schema.prospects.websiteDomain, s.normalized))
      .returning({ id: schema.prospects.id });
    prospectsSuppressed = rows.length;
    if (rows.length)
      contactsDeleted = (
        await tx
          .delete(schema.contacts)
          .where(
            inArray(
              schema.contacts.prospectId,
              rows.map((r) => r.id),
            ),
          )
          .returning({ id: schema.contacts.id })
      ).length;
  } else {
    contactsDeleted = (
      await tx
        .delete(schema.contacts)
        .where(and(eq(schema.contacts.valueHash, s.hash), eq(schema.contacts.channel, i.kind)))
        .returning({ id: schema.contacts.id })
    ).length;
  }
  await writeAudit(tx, {
    orgId: o.orgId,
    actorType: 'user',
    actorUserId: o.userId,
    action: 'compliance.suppression_added',
    targetType: 'suppression',
    targetId: row?.id ?? 'existing',
    metadata: { kind: i.kind, reason: i.reason, contactsDeleted, prospectsSuppressed },
  });
  return { id: row?.id ?? null, duplicate: !row, contactsDeleted, prospectsSuppressed };
}

export const dsrInputSchema = z
  .object({
    type: z.enum(['erasure', 'opposition', 'access', 'rectification']),
    kind: z.enum(['email', 'phone']),
    value: z.string().trim().min(3).max(320),
    /** Date de réception (par défaut maintenant) : le délai légal court à partir d'elle. */
    receivedAt: z.iso.datetime().optional(),
  })
  .strict();

const LEGAL_DELAY_DAYS = 30;

export async function createRequest(
  tx: Transaction,
  o: { orgId: string; hashKey: Buffer },
  i: z.infer<typeof dsrInputSchema>,
) {
  const s = subjectHash(i.kind, i.value, o.hashKey);
  const received = i.receivedAt ? new Date(i.receivedAt) : new Date();
  const [r] = await tx
    .insert(schema.dataSubjectRequests)
    .values({
      organizationId: o.orgId,
      type: i.type,
      subjectHash: s.hash,
      subjectHint: maskHint(i.kind, s.normalized),
      receivedAt: received,
      dueAt: new Date(received.getTime() + LEGAL_DELAY_DAYS * 86_400_000),
      result: { kind: i.kind },
    })
    .returning();
  return r!;
}

/**
 * Traitement d'une demande. Effacement : coordonnées correspondantes supprimées ; un prospect
 * PERSONNE est supprimé entièrement (preuves, messages, historique, tâches en cascade) ; la
 * valeur est ajoutée à la liste d'opposition pour ne jamais être recollectée.
 */
export async function processRequest(
  tx: Transaction,
  o: { orgId: string; userId: string },
  id: string,
) {
  const [r] = await tx
    .select()
    .from(schema.dataSubjectRequests)
    .where(eq(schema.dataSubjectRequests.id, id))
    .for('update');
  if (!r) throw new AppError('not_found');
  if (r.status === 'done') throw new AppError('conflict', 'déjà traitée');
  const kind = ((r.result as { kind?: string }).kind ?? 'email') as 'email' | 'phone';
  const contacts = await tx
    .select({ id: schema.contacts.id, prospectId: schema.contacts.prospectId })
    .from(schema.contacts)
    .where(and(eq(schema.contacts.valueHash, r.subjectHash), eq(schema.contacts.channel, kind)));
  const prospectIds = [...new Set(contacts.map((c) => c.prospectId))];
  let result: Record<string, unknown> = {
    kind,
    contactsFound: contacts.length,
    prospectsFound: prospectIds.length,
  };
  if (r.type === 'erasure' || r.type === 'opposition') {
    if (contacts.length)
      await tx.delete(schema.contacts).where(
        inArray(
          schema.contacts.id,
          contacts.map((c) => c.id),
        ),
      );
    let prospectsDeleted = 0;
    if (r.type === 'erasure' && prospectIds.length) {
      const persons = await tx
        .select({ id: schema.prospects.id, kind: schema.prospects.kind })
        .from(schema.prospects)
        .where(inArray(schema.prospects.id, prospectIds));
      const ids = persons.filter((p) => isIndividualKind(p.kind)).map((p) => p.id);
      if (ids.length)
        prospectsDeleted = (
          await tx
            .delete(schema.prospects)
            .where(inArray(schema.prospects.id, ids))
            .returning({ id: schema.prospects.id })
        ).length;
    }
    await tx
      .insert(schema.suppressionList)
      .values({
        organizationId: o.orgId,
        valueHash: r.subjectHash,
        channel: kind,
        reason: r.type === 'erasure' ? 'erasure' : 'opt_out',
        valueKind: kind,
        displayHint: r.subjectHint,
        createdBy: o.userId,
      })
      .onConflictDoNothing();
    result = { ...result, contactsDeleted: contacts.length, prospectsDeleted, suppressed: true };
  }
  const [after] = await tx
    .update(schema.dataSubjectRequests)
    .set({ status: 'done', completedAt: new Date(), handledBy: o.userId, result })
    .where(eq(schema.dataSubjectRequests.id, id))
    .returning();
  await writeAudit(tx, {
    orgId: o.orgId,
    actorType: 'user',
    actorUserId: o.userId,
    action: `compliance.request_${r.type}`,
    targetType: 'data_subject_request',
    targetId: id,
    metadata: result,
  });
  return after!;
}
