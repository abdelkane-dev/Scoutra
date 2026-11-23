import { z } from 'zod';
import { usageOfError, type Usage } from '@scoutra/ai';
import { draftMessage } from '@scoutra/agents';
import type { ComplianceDecision } from '@scoutra/compliance';
import { AppError } from '@scoutra/core';
import { loadVisibleMessage } from '@scoutra/crm';
import { and, count, eq, recordUsage, schema, withTenant } from '@scoutra/db';
import { campaignCostMode, currentCostMode } from '@scoutra/queue';
import { actorOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { getEnv } from '@/server/env';
import { apiRoute, json } from '@/server/http';
import { llm } from '@/server/llm';

export const dynamic = 'force-dynamic';

/** Régénérations incluses par prospect (barème : 3), en plus du premier message. */
const MAX_AI_MESSAGES_PER_PROSPECT = 4;

const body = z
  .object({
    language: z.enum(['fr', 'en']).optional(),
    tone: z.string().trim().max(60).optional(),
  })
  .strict();

/**
 * Régénère un brouillon (même canal, même décision du garde-fou). L'ancien est écarté. Limite :
 * 3 régénérations par prospect ; au-delà du plafond de coût, message modèle sans IA.
 */
export const POST = apiRoute(
  {
    action: 'message:write',
    params: z.object({ id: z.uuid() }),
    body,
    rateLimit: { max: 20, windowMs: 60_000 },
  },
  async ({ params, body, ctx }) => {
    const db = await appDb();
    const actor = actorOf(ctx);
    const tenant = { orgId: ctx.orgId, userId: ctx.user.id };
    const prep = await withTenant(db, tenant, async (tx) => {
      const { m } = await loadVisibleMessage(tx, actor, params.id);
      if (m.status === 'sent_manually' || m.status === 'replied')
        throw new AppError('conflict', 'déjà envoyé');
      const [n] = await tx
        .select({ n: count() })
        .from(schema.messages)
        .where(
          and(eq(schema.messages.prospectId, m.prospectId), eq(schema.messages.generatedBy, 'ai')),
        );
      if ((n?.n ?? 0) >= MAX_AI_MESSAGES_PER_PROSPECT)
        throw new AppError('quota_exceeded', 'régénérations');
      const [p] = await tx
        .select()
        .from(schema.prospects)
        .where(eq(schema.prospects.id, m.prospectId));
      const [org] = await tx.select().from(schema.organizations);
      const [c] = m.campaignId
        ? await tx.select().from(schema.campaigns).where(eq(schema.campaigns.id, m.campaignId))
        : [];
      const mode = c
        ? await campaignCostMode(tx, getEnv().SCOUTRA_MODE, c, new Date())
        : await currentCostMode(tx, getEnv().SCOUTRA_MODE, new Date());
      return { m, p: p!, org: org!, c, mode };
    });
    const decision = prep.m.complianceDecision as ComplianceDecision;
    if (decision.outcome === 'deny') throw new AppError('forbidden', 'canal refusé');
    const attrs = (prep.p.attributes ?? {}) as Record<string, unknown>;
    const client = prep.mode === 'free_only' ? { ...llm(), available: false } : llm();
    const input = {
      channel: prep.m.channel,
      language: body.language ?? (prep.m.language === 'en' ? 'en' : 'fr'),
      quality: (prep.c?.quality ?? 'standard') as 'standard',
      decision,
      sender: {
        name: prep.org.name,
        offer: (prep.c?.promptText ?? '').slice(0, 600),
        tone: body.tone,
        linkDomains: prep.org.websiteDomain ? [prep.org.websiteDomain] : [],
      },
      prospect: {
        displayName: prep.p.displayName,
        category: (attrs.category as string | null) ?? null,
        city: prep.p.city,
        description: (attrs.siteDescription as string | null) ?? null,
        signals: ((attrs.signals as { key: string }[] | undefined) ?? []).map((s) => s.key),
      },
      reasons: ((prep.p.scoreReasons ?? []) as { finding: string }[]).map((r) => r.finding),
    } as const;
    let failedUsage: Usage | undefined;
    const draft = await draftMessage(input, client).catch((e: unknown) => {
      failedUsage = usageOfError(e);
      return draftMessage(input, { ...client, available: false });
    });
    const created = await withTenant(db, tenant, async (tx) => {
      await tx
        .update(schema.messages)
        .set({ status: 'discarded' })
        .where(eq(schema.messages.id, prep.m.id));
      const [row] = await tx
        .insert(schema.messages)
        .values({
          organizationId: ctx.orgId,
          prospectId: prep.m.prospectId,
          campaignId: prep.m.campaignId,
          channel: prep.m.channel,
          language: input.language,
          subject: draft.subject,
          body: draft.body,
          footer: draft.footer,
          quality: input.quality,
          generatedBy: draft.generatedBy,
          model: draft.usage?.model,
          complianceDecision: decision,
          createdBy: ctx.user.id,
        })
        .returning();
      for (const u of [draft.usage, failedUsage].filter(Boolean))
        await recordUsage(tx, {
          orgId: ctx.orgId,
          campaignId: prep.m.campaignId ?? undefined,
          kind: 'llm',
          provider: llm().provider,
          source: `drafting:regenerate`,
          inputTokens: u!.inputTokens,
          outputTokens: u!.outputTokens,
          costMicroUsd: u!.costMicroUsd,
        });
      return row!;
    });
    return json(
      {
        id: created.id,
        replaces: prep.m.id,
        channel: created.channel,
        subject: created.subject,
        body: created.body,
        footer: created.footer,
        generatedBy: created.generatedBy,
        status: created.status,
      },
      { status: 201 },
    );
  },
);
