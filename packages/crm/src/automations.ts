import { z } from 'zod';
import { AppError, SIGNAL_KEYS } from '@scoutra/core';
import { eq, schema, sql, type Transaction } from '@scoutra/db';
import { logActivity, memberNames } from './activity';
import { assertStage } from './stages';

/**
 * Automatisations INTERNES (règle déclencheur → action) : assigner, créer une tâche, changer
 * d'étape, notifier. Aucun envoi de message : Scoutra ne contacte jamais personne à la place de
 * l'utilisateur. Les actions d'une automatisation ne redéclenchent pas d'automatisation.
 */
export const AUTOMATION_TRIGGERS = [
  'delivered',
  'score_above',
  'signal',
  'replied',
  'stage_changed',
] as const;
export const AUTOMATION_ACTIONS = ['assign', 'create_task', 'move_stage', 'notify'] as const;

export const automationInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    enabled: z.boolean().default(true),
    trigger: z.enum(AUTOMATION_TRIGGERS),
    triggerArg: z.string().trim().max(100).default(''),
    action: z.enum(AUTOMATION_ACTIONS),
    actionArg: z.string().trim().max(200).default(''),
  })
  .strict()
  .superRefine((a, ctx) => {
    if (a.trigger === 'score_above' && !/^\d{1,3}$/.test(a.triggerArg))
      ctx.addIssue({ code: 'custom', path: ['triggerArg'], message: 'score attendu (0-100)' });
    if (a.trigger === 'signal' && !(SIGNAL_KEYS as readonly string[]).includes(a.triggerArg))
      ctx.addIssue({ code: 'custom', path: ['triggerArg'], message: 'signal inconnu' });
    if (a.action === 'create_task' && !a.actionArg)
      ctx.addIssue({ code: 'custom', path: ['actionArg'], message: 'titre de tâche requis' });
    if ((a.action === 'move_stage' || a.action === 'assign') && !a.actionArg)
      ctx.addIssue({ code: 'custom', path: ['actionArg'], message: 'argument requis' });
  });
export type AutomationInput = z.infer<typeof automationInputSchema>;

/** Vérifie les arguments qui dépendent de l'organisation (étape existante, membre existant). */
export async function validateAutomationRefs(
  tx: Transaction,
  orgId: string,
  a: AutomationInput,
): Promise<void> {
  if (a.action === 'move_stage') await assertStage(tx, orgId, a.actionArg);
  if (a.action === 'assign' || (a.action === 'notify' && a.actionArg && a.actionArg !== 'owner')) {
    if (!(await memberNames(tx)).has(a.actionArg))
      throw new AppError('invalid_input', 'membre inconnu', [
        { path: 'actionArg', code: 'unknown_member' },
      ]);
  }
}

export type AutomationEvent =
  | { type: 'delivered'; prospectId: string; score: number; signals: string[] }
  | { type: 'replied'; prospectId: string }
  | { type: 'stage_changed'; prospectId: string; stage: string };

function matches(rule: typeof schema.automations.$inferSelect, e: AutomationEvent): boolean {
  if (e.type === 'delivered') {
    if (rule.trigger === 'delivered') return true;
    if (rule.trigger === 'score_above') return e.score >= Number(rule.triggerArg);
    if (rule.trigger === 'signal') return e.signals.includes(rule.triggerArg);
    return false;
  }
  if (e.type === 'replied') return rule.trigger === 'replied';
  return rule.trigger === 'stage_changed' && (!rule.triggerArg || rule.triggerArg === e.stage);
}

/** Exécute les règles actives correspondant à l'événement ; renvoie le nombre d'actions. */
export async function runAutomations(
  tx: Transaction,
  orgId: string,
  e: AutomationEvent,
): Promise<number> {
  const rules = await tx
    .select()
    .from(schema.automations)
    .where(eq(schema.automations.enabled, true));
  let n = 0;
  for (const r of rules) {
    if (!matches(r, e)) continue;
    const [p] = await tx
      .select({
        id: schema.prospects.id,
        owner: schema.prospects.ownerUserId,
        name: schema.prospects.displayName,
      })
      .from(schema.prospects)
      .where(eq(schema.prospects.id, e.prospectId));
    if (!p) continue;
    if (r.action === 'move_stage') {
      await tx
        .update(schema.prospects)
        .set({ stageKey: r.actionArg, stageChangedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(schema.prospects.id, p.id));
    } else if (r.action === 'assign') {
      await tx
        .update(schema.prospects)
        .set({ ownerUserId: r.actionArg, updatedAt: sql`now()` })
        .where(eq(schema.prospects.id, p.id));
    } else if (r.action === 'create_task') {
      await tx.insert(schema.tasks).values({
        organizationId: orgId,
        prospectId: p.id,
        assigneeUserId: p.owner,
        title: r.actionArg.slice(0, 200),
        kind: 'follow_up',
        dueAt: new Date(Date.now() + 86_400_000),
        source: 'automation',
      });
    } else if (r.action === 'notify') {
      const userId = r.actionArg && r.actionArg !== 'owner' ? r.actionArg : p.owner;
      if (userId)
        await tx.insert(schema.notifications).values({
          organizationId: orgId,
          userId,
          title: `${r.name} : ${p.name}`.slice(0, 200),
          link: `/prospects/${p.id}`,
        });
    }
    await logActivity(tx, {
      orgId,
      prospectId: p.id,
      type: 'automation',
      payload: { automationId: r.id, action: r.action, arg: r.actionArg },
    });
    await tx
      .update(schema.automations)
      .set({ runs: sql`${schema.automations.runs} + 1`, lastRunAt: sql`now()` })
      .where(eq(schema.automations.id, r.id));
    n++;
  }
  return n;
}
