import {
  draftMessage,
  extractSiteFacts,
  legalAudience,
  playbookFor,
  scoreProspect,
  verifyEmail,
  verifyPhone,
  type Draft,
  type ScoringInput,
} from '@scoutra/agents';
import { DELIVERY_CREDITS, MILLICREDITS_PER_CREDIT, type DeliveryQuality } from '@scoutra/billing';
import { allowedChannels, type ComplianceDecision } from '@scoutra/compliance';
import { readWebsite, websiteManifest } from '@scoutra/connectors';
import {
  isIndividualKind,
  type ContactChannel,
  type SignalKey,
  type VerificationStatus,
} from '@scoutra/core';
import { decryptSecret, type EncryptedSecret } from '@scoutra/crypto';
import { consumeCredits, count, eq, gte, recordUsage, schema, sql, withTenant } from '@scoutra/db';
import type { JobPayload, prospectProcessJob } from '@scoutra/queue';
import { emit, latestSpec, loadOrg, planFor, recordLlm } from './context';
import { connectorCtx, resolveKeys, type CampaignDeps } from './deps';
import { insertContact } from './search';

const CHANNEL_PRIORITY: ContactChannel[] = [
  'email',
  'phone',
  'whatsapp',
  'website_form',
  'social_page',
];

/**
 * Un prospect : enrichissement → vérification → garde-fou → notation → livraison (débit de la
 * réservation, idempotent) → rédaction. Pas de résultat = pas de débit : un prospect écarté
 * (score, aucun canal autorisé, budget épuisé) ne consomme rien.
 */
export async function handleProcess(
  deps: CampaignDeps,
  p: JobPayload<typeof prospectProcessJob>,
  signal?: AbortSignal,
) {
  const orgId = p.organizationId;
  const loaded = await withTenant(deps.db, { orgId }, async (tx) => {
    const [c] = await tx
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, p.campaignId));
    const [pr] = await tx
      .select()
      .from(schema.prospects)
      .where(eq(schema.prospects.id, p.prospectId));
    if (!c || !pr || c.status !== 'running' || pr.campaignId !== c.id) return null;
    if (pr.status !== 'found') return null; // déjà traité (reprise)
    return {
      c,
      pr,
      spec: await latestSpec(tx, c.id),
      org: await loadOrg(tx),
      plan: await planFor(tx, deps.now()),
    };
  });
  if (!loaded?.spec) return { skipped: true };
  const { c, pr, org } = loaded;
  const spec = loaded.spec.spec;
  const playbook = playbookFor(spec.model);
  const economy = c.costMode !== 'normal';
  const key = await resolveKeys(deps, orgId);

  // 1. Enrichissement (site public)
  const attrs = (pr.attributes ?? {}) as Record<string, unknown>;
  // Personne physique : pas de lecture de site ni de collecte de coordonnées (constat 1).
  const individual = isIndividualKind(pr.kind);
  const site =
    pr.websiteDomain && !individual
      ? await readWebsite(pr.websiteDomain, connectorCtx(deps, key, signal))
      : null;
  const ai =
    site && !economy ? await extractSiteFacts(site, deps.llm, signal).catch(() => null) : null;

  // 2. Contacts du site + vérification
  const verified = await withTenant(deps.db, { orgId }, async (tx) => {
    if (site) {
      await recordUsage(tx, {
        orgId,
        campaignId: c.id,
        kind: 'crawl',
        provider: 'website',
        source: 'website',
        units: site.fetchedPages,
        costMicroUsd: site.fetchedPages * websiteManifest.costMicroUsdPerRequest,
      });
      const src = {
        code: 'website',
        url: `https://${site.domain}/`,
        legalBasis: 'legitimate_interest',
        country: pr.countryCode,
      };
      for (const e of site.emails.slice(0, 3))
        await insertContact(deps, tx, {
          orgId,
          prospectId: pr.id,
          channel: 'email',
          value: e,
          source: src,
        });
      for (const ph of site.phones.slice(0, 2))
        await insertContact(deps, tx, {
          orgId,
          prospectId: pr.id,
          channel: 'phone',
          value: ph,
          source: src,
        });
      await recordLlm(tx, orgId, c.id, 'enrichment', ai?.usage, deps.llm.provider);
    }
    return tx.select().from(schema.contacts).where(eq(schema.contacts.prospectId, pr.id));
  });
  const contacts: {
    id: string;
    channel: ContactChannel;
    status: VerificationStatus;
    isRole: boolean;
  }[] = [];
  for (const ct of verified) {
    let value: string;
    try {
      value = decryptSecret(
        ct.valueEncrypted as EncryptedSecret,
        { orgId, purpose: `contact:${ct.channel}` },
        deps.keyring,
      );
    } catch {
      continue;
    }
    if (ct.channel === 'email') {
      const r = await verifyEmail(value, deps.verify);
      contacts.push({ id: ct.id, channel: 'email', status: r.status, isRole: r.isRoleAddress });
    } else if (ct.channel === 'phone') {
      const r = verifyPhone(value, pr.countryCode);
      contacts.push({
        id: ct.id,
        channel: 'phone',
        status: r.valid ? 'valid' : 'invalid',
        isRole: false,
      });
    }
  }

  // 3. Garde-fou juridique (déterministe) AVANT toute proposition de canal
  const audience = legalAudience(playbook, pr.kind);
  const candidates = new Set<ContactChannel>();
  for (const ct of contacts)
    if (ct.status !== 'invalid' && ct.status !== 'disposable') candidates.add(ct.channel);
  if (site?.reachable) candidates.add('website_form');
  if (attrs.publicSignalOnly || (site?.socialLinks.length ?? 0) > 0) candidates.add('social_page');
  const wanted = new Set<ContactChannel>([...playbook.channels, ...spec.channels]);
  const decisions = allowedChannels(
    { recipientCountry: pr.countryCode, senderCountry: org.countryCode, audience },
    [...candidates].filter((ch) => wanted.has(ch)),
  );

  // 4. Notation hybride
  const signals = (
    (attrs.signals as { key: SignalKey; observedAt?: string | null }[] | undefined) ?? []
  ).map((s) => ({ key: s.key, observedAt: s.observedAt ?? undefined }));
  for (const s of site?.signals ?? []) signals.push({ key: s.key, observedAt: s.observedAt });
  const evidenceCount = await withTenant(deps.db, { orgId }, async (tx) => {
    const [r] = await tx
      .select({ n: count() })
      .from(schema.evidence)
      .where(eq(schema.evidence.prospectId, pr.id));
    return r?.n ?? 0;
  });
  const allowedSet = new Set(decisions.map((d) => d.channel));
  const scoringInput: ScoringInput = {
    spec,
    now: deps.now(),
    prospect: {
      kind: pr.kind,
      displayName: pr.displayName,
      countryCode: pr.countryCode,
      city: pr.city,
      category: (attrs.category as string | null) ?? ai?.facts.category ?? null,
      description:
        ai?.facts.summary ?? site?.description ?? (attrs.snippet as string | null) ?? null,
      signals,
      contacts: [
        ...contacts
          .filter((ct) => allowedSet.has(ct.channel))
          .map((ct) => ({
            channel: ct.channel,
            status: ct.channel === 'phone' ? ('valid_phone' as const) : ct.status,
          })),
        ...decisions
          .filter((d) => d.decision.outcome === 'manual_only')
          .map((d) => ({ channel: d.channel, status: 'manual' as const })),
      ],
      evidenceCount,
      websiteReachable: site?.reachable,
    },
  };
  const scored = await scoreProspect(scoringInput, deps.llm, { allowAi: !economy, signal }).catch(
    async () => scoreProspect(scoringInput, deps.llm, { allowAi: false }),
  );

  // 5. Livraison (débit) puis rédaction
  const quality = c.quality as DeliveryQuality;
  let outcome:
    | 'delivered'
    | 'low_score'
    | 'no_allowed_channel'
    | 'excluded'
    | 'budget_exhausted'
    | 'quota_reached' = 'delivered';
  if (scored.result.disqualified) outcome = 'excluded';
  else if (decisions.length === 0) outcome = 'no_allowed_channel';
  else if (scored.result.score < playbook.rules.minScore) outcome = 'low_score';

  let draft: Draft | null = null;
  let channelDecision: ComplianceDecision | null = null;
  if (outcome === 'delivered') {
    outcome = await withTenant(deps.db, { orgId }, async (tx) => {
      const [fresh] = await tx
        .select({ delivered: schema.campaigns.deliveredCount })
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, c.id));
      if ((fresh?.delivered ?? 0) >= c.maxProspects) return 'quota_reached' as const;
      if (deps.mode === 'saas') {
        const dayStart = new Date(
          Date.UTC(deps.now().getUTCFullYear(), deps.now().getUTCMonth(), deps.now().getUTCDate()),
        );
        const [today] = await tx
          .select({ n: count() })
          .from(schema.prospects)
          .where(gte(schema.prospects.deliveredAt, dayStart));
        if ((today?.n ?? 0) >= loaded.plan.plan.dailyProspectCap) return 'quota_reached' as const;
        const r = await consumeCredits(tx, {
          orgId,
          campaignId: c.id,
          prospectId: pr.id,
          amountMc: DELIVERY_CREDITS[quality] * MILLICREDITS_PER_CREDIT,
          key: `deliver:${c.id}:${pr.id}`,
        });
        if (r === 'budget_exhausted') return 'budget_exhausted' as const;
      }
      await tx
        .update(schema.campaigns)
        .set({ deliveredCount: sql`${schema.campaigns.deliveredCount} + 1` })
        .where(eq(schema.campaigns.id, c.id));
      await tx
        .update(schema.prospects)
        .set({ deliveredAt: deps.now() })
        .where(eq(schema.prospects.id, pr.id));
      return 'delivered' as const;
    });
  }
  if (outcome === 'delivered') {
    const best = CHANNEL_PRIORITY.map((ch) => decisions.find((d) => d.channel === ch)).find(
      Boolean,
    )!;
    channelDecision = best.decision;
    const input = {
      channel: best.channel,
      language: spec.language,
      quality,
      decision: best.decision,
      sender: { name: org.name, offer: c.promptText.slice(0, 600) },
      prospect: {
        displayName: pr.displayName,
        category: scoringInput.prospect.category,
        city: pr.city,
        description: scoringInput.prospect.description,
        signals: signals.map((s) => s.key),
      },
      reasons: scored.result.reasons.map((r) => r.finding),
    };
    // Une erreur d'IA ne prive jamais d'un prospect payé : repli sur le modèle de message.
    draft = await draftMessage(input, deps.llm, signal).catch(() =>
      draftMessage(input, { ...deps.llm, available: false }),
    );
  }

  await withTenant(deps.db, { orgId }, async (tx) => {
    for (const ct of contacts)
      await tx
        .update(schema.contacts)
        .set({ verificationStatus: ct.status, verifiedAt: deps.now(), isRoleAddress: ct.isRole })
        .where(eq(schema.contacts.id, ct.id));
    await recordLlm(tx, orgId, c.id, 'scoring', scored.usage, deps.llm.provider);
    const delivered = outcome === 'delivered';
    await tx
      .update(schema.prospects)
      .set({
        status: delivered ? 'drafted' : 'rejected',
        rejectionReason: delivered ? null : outcome,
        score: scored.result.score,
        scoreReasons: scored.result.reasons,
        channelDecisions: decisions.map((d) => ({
          channel: d.channel,
          outcome: d.decision.outcome,
          conditions: d.decision.conditions,
          ruleIds: d.decision.ruleIds,
          rulesetVersions: d.decision.rulesetVersions,
          reasons: d.decision.reasons,
          warnings: d.decision.warnings,
        })),
        attributes: {
          ...attrs,
          ...(ai ? { siteFacts: ai.facts } : {}),
          ...(site
            ? {
                siteTitle: site.title ?? null,
                siteDescription: site.description ?? null,
                https: site.https,
              }
            : {}),
        },
        updatedAt: deps.now(),
      })
      .where(eq(schema.prospects.id, pr.id));
    if (!delivered)
      await tx
        .update(schema.campaigns)
        .set({ rejectedCount: sql`${schema.campaigns.rejectedCount} + 1` })
        .where(eq(schema.campaigns.id, c.id));
    if (draft && channelDecision) {
      const [m] = await tx
        .insert(schema.messages)
        .values({
          organizationId: orgId,
          prospectId: pr.id,
          campaignId: c.id,
          channel: channelDecision.channel,
          language: spec.language,
          subject: draft.subject,
          body: draft.body,
          footer: draft.footer,
          quality,
          generatedBy: draft.generatedBy,
          model: draft.usage?.model,
          complianceDecision: channelDecision,
        })
        .returning({ id: schema.messages.id });
      await recordLlm(tx, orgId, c.id, 'drafting', draft.usage, deps.llm.provider);
      await emit(tx, orgId, c.id, 'message.drafted', { prospectId: pr.id, messageId: m!.id });
    }
    await emit(tx, orgId, c.id, 'prospect.updated', {
      prospectId: pr.id,
      status: delivered ? 'drafted' : 'rejected',
      score: scored.result.score,
      reason: delivered ? null : outcome,
    });
  });
  return { outcome, score: scored.result.score };
}
