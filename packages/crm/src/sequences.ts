import { z } from 'zod';
import { legalFooter, type ComplianceDecision } from '@scoutra/compliance';
import { AppError } from '@scoutra/core';
import { and, eq, schema, sql, type Transaction } from '@scoutra/db';
import { logActivity } from './activity';
import type { Actor } from './prospects';

/**
 * Séquences : relances PLANIFIÉES qui créent des tâches ou des brouillons pour l'utilisateur.
 * Aucun envoi automatique (ni email, ni message sur une plateforme). Une réponse saisie arrête
 * la séquence du prospect.
 */
export const sequenceStepSchema = z
  .object({
    day: z.int().min(0).max(365),
    channel: z.enum(['email', 'phone', 'whatsapp', 'linkedin_manual', 'other']),
    kind: z.enum(['task', 'draft']),
    title: z.string().trim().min(1).max(200),
    /** Modèle du brouillon ({{name}} remplacé par le nom du prospect). */
    template: z.string().trim().max(2000).optional(),
  })
  .strict();
export const sequenceInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    status: z.enum(['active', 'paused', 'archived']).default('active'),
    steps: z.array(sequenceStepSchema).min(1).max(20),
  })
  .strict()
  .refine((s) => s.steps.every((st, i) => i === 0 || st.day >= s.steps[i - 1]!.day), {
    message: 'jours croissants',
    path: ['steps'],
  });
export type SequenceStep = z.infer<typeof sequenceStepSchema>;

const DAY = 86_400_000;

export async function enroll(
  tx: Transaction,
  actor: Actor,
  sequenceId: string,
  prospectId: string,
): Promise<boolean> {
  const [seq] = await tx.select().from(schema.sequences).where(eq(schema.sequences.id, sequenceId));
  if (!seq || seq.status !== 'active') throw new AppError('conflict', 'séquence inactive');
  const steps = seq.steps as SequenceStep[];
  const rows = await tx
    .insert(schema.sequenceEnrollments)
    .values({
      organizationId: actor.orgId,
      sequenceId,
      prospectId,
      stepIndex: 0,
      nextRunAt: new Date(Date.now() + steps[0]!.day * DAY),
      enrolledBy: actor.userId,
    })
    .onConflictDoNothing()
    .returning({ id: schema.sequenceEnrollments.id });
  if (rows.length)
    await logActivity(tx, {
      orgId: actor.orgId,
      prospectId,
      actorUserId: actor.userId,
      type: 'sequence_enrolled',
      payload: { sequenceId },
    });
  return rows.length > 0;
}

/**
 * Exécute l'étape due d'une inscription : crée une tâche (ou un brouillon si le canal email est
 * autorisé par le garde-fou pour ce prospect), puis planifie l'étape suivante.
 */
export async function runEnrollmentStep(
  tx: Transaction,
  orgId: string,
  enrollmentId: string,
  now = new Date(),
): Promise<'done' | 'skipped'> {
  const [e] = await tx
    .select()
    .from(schema.sequenceEnrollments)
    .where(eq(schema.sequenceEnrollments.id, enrollmentId))
    .for('update');
  if (!e || e.status !== 'active' || !e.nextRunAt || e.nextRunAt > now) return 'skipped';
  const [seq] = await tx
    .select()
    .from(schema.sequences)
    .where(eq(schema.sequences.id, e.sequenceId));
  const [p] = await tx.select().from(schema.prospects).where(eq(schema.prospects.id, e.prospectId));
  if (!seq || !p) return 'skipped';
  if (seq.status !== 'active') {
    await tx
      .update(schema.sequenceEnrollments)
      .set({ nextRunAt: new Date(now.getTime() + DAY) })
      .where(eq(schema.sequenceEnrollments.id, e.id));
    return 'skipped';
  }
  const steps = seq.steps as SequenceStep[];
  const step = steps[e.stepIndex];
  if (!step) {
    await tx
      .update(schema.sequenceEnrollments)
      .set({ status: 'completed', nextRunAt: null })
      .where(eq(schema.sequenceEnrollments.id, e.id));
    return 'skipped';
  }
  const decisions = (p.channelDecisions ?? []) as (ComplianceDecision & { outcome: string })[];
  const emailOk = decisions.find(
    (d) => d.channel === 'email' && d.outcome !== 'deny' && d.outcome !== 'manual_only',
  );
  if (step.kind === 'draft' && step.channel === 'email' && emailOk) {
    const [org] = await tx.select({ name: schema.organizations.name }).from(schema.organizations);
    const body = (step.template ?? step.title).replaceAll('{{name}}', p.displayName).slice(0, 2000);
    await tx.insert(schema.messages).values({
      organizationId: orgId,
      prospectId: p.id,
      campaignId: p.campaignId,
      channel: 'email',
      language: 'fr',
      subject: step.title.slice(0, 200),
      body,
      footer: legalFooter(emailOk.conditions?.footer, 'fr', { name: org?.name ?? '' }).slice(
        0,
        1000,
      ),
      generatedBy: 'user',
      status: 'draft',
      complianceDecision: emailOk,
    });
  } else {
    await tx.insert(schema.tasks).values({
      organizationId: orgId,
      prospectId: p.id,
      assigneeUserId: p.ownerUserId,
      title: step.title,
      kind:
        step.channel === 'other' ? 'follow_up' : step.channel === 'phone' ? 'call' : step.channel,
      dueAt: now,
      source: 'sequence',
      enrollmentId: e.id,
    });
  }
  const next = steps[e.stepIndex + 1];
  await tx
    .update(schema.sequenceEnrollments)
    .set(
      next
        ? {
            stepIndex: e.stepIndex + 1,
            nextRunAt: new Date(e.createdAt.getTime() + next.day * DAY),
          }
        : { stepIndex: e.stepIndex + 1, status: 'completed', nextRunAt: null },
    )
    .where(eq(schema.sequenceEnrollments.id, e.id));
  return 'done';
}

/** Une réponse saisie arrête les séquences du prospect. */
export async function stopSequencesOnReply(tx: Transaction, prospectId: string): Promise<void> {
  await tx
    .update(schema.sequenceEnrollments)
    .set({ status: 'replied', nextRunAt: null })
    .where(
      and(
        eq(schema.sequenceEnrollments.prospectId, prospectId),
        eq(schema.sequenceEnrollments.status, 'active'),
      ),
    );
}

/** Étapes dues, toutes organisations (identifiants seulement). */
export async function dueEnrollments(db: {
  execute: Transaction['execute'];
}): Promise<{ organizationId: string; enrollmentId: string }[]> {
  const res = await db.execute<{ organization_id: string; enrollment_id: string }>(
    sql`select organization_id, enrollment_id from app_due_enrollments()`,
  );
  return res.rows.map((r) => ({
    organizationId: r.organization_id,
    enrollmentId: r.enrollment_id,
  }));
}
