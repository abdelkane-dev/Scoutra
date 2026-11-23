import { mergeCandidates, dedupeKey } from '@scoutra/agents';
import { ConnectorError, connectorByCode, type RawCandidate } from '@scoutra/connectors';
import { isIndividualKind } from '@scoutra/core';
import { encryptSecret, keyedHash, normalizeContactValue } from '@scoutra/crypto';
import {
  and,
  eq,
  inArray,
  recordUsage,
  schema,
  sql,
  withTenant,
  type Transaction,
} from '@scoutra/db';
import {
  campaignCostMode,
  prospectProcessJob,
  publishTenantJob,
  type JobPayload,
  type searchRunJob,
} from '@scoutra/queue';
import { emit, latestSpec } from './context';
import { connectorCtx, resolveKeys, type CampaignDeps } from './deps';

export class RetryLaterError extends Error {
  code = 'rate_limited';
}

/** Enregistre une valeur de contact chiffrée (enveloppe) + empreinte, sauf si dans la liste d'opposition. */
export async function insertContact(
  deps: CampaignDeps,
  tx: Transaction,
  o: {
    orgId: string;
    prospectId: string;
    channel: 'email' | 'phone';
    value: string;
    source: { code: string; url?: string; legalBasis: string; country: string; license?: string };
  },
): Promise<string | null> {
  const normalized = normalizeContactValue(o.channel, o.value);
  if (!normalized) return null;
  const valueHash = keyedHash(normalized, deps.hashKey, `contact:${o.channel}`);
  const [blocked] = await tx
    .select({ id: schema.suppressionList.id })
    .from(schema.suppressionList)
    .where(
      and(
        eq(schema.suppressionList.valueHash, valueHash),
        eq(schema.suppressionList.channel, o.channel),
      ),
    );
  if (blocked) return null;
  const [row] = await tx
    .insert(schema.contacts)
    .values({
      organizationId: o.orgId,
      prospectId: o.prospectId,
      channel: o.channel,
      valueEncrypted: encryptSecret(
        normalized,
        { orgId: o.orgId, purpose: `contact:${o.channel}` },
        deps.keyring,
      ),
      valueHash,
    })
    .onConflictDoNothing()
    .returning({ id: schema.contacts.id });
  if (!row) return null;
  await tx.insert(schema.evidence).values({
    organizationId: o.orgId,
    prospectId: o.prospectId,
    contactId: row.id,
    fieldPath: `contact.${o.channel}`,
    sourceCode: o.source.code,
    sourceUrl: o.source.url?.slice(0, 2048),
    collectedAt: deps.now(),
    legalBasis: o.source.legalBasis as 'legitimate_interest',
    countryCode: o.source.country,
    sourceLicense: o.source.license,
  });
  return row.id;
}

/** Preuves PAR CHAMP pour chaque source ayant fourni l'entité. */
async function insertEvidence(
  deps: CampaignDeps,
  tx: Transaction,
  orgId: string,
  prospectId: string,
  sources: RawCandidate[],
) {
  const rows = [];
  for (const s of sources) {
    const base = {
      organizationId: orgId,
      prospectId,
      sourceCode: s.sourceCode,
      sourceUrl: s.sourceUrl?.slice(0, 2048),
      collectedAt: deps.now(),
      legalBasis: s.legalBasis,
      countryCode: s.countryCode,
      sourceLicense: s.dataLicense,
    };
    rows.push({ ...base, fieldPath: 'display_name', snippet: s.snippet?.slice(0, 500) });
    if (s.websiteDomain) rows.push({ ...base, fieldPath: 'website_domain' });
    if (s.registryId) rows.push({ ...base, fieldPath: 'attributes.registry_id' });
    for (const sig of s.signals)
      rows.push({
        ...base,
        fieldPath: `signals.${sig.key}`,
        sourceUrl: (sig.url ?? s.sourceUrl)?.slice(0, 2048),
        snippet: sig.snippet?.slice(0, 500),
      });
  }
  if (rows.length) await tx.insert(schema.evidence).values(rows);
}

/** Agent Recherche : exécute une requête d'un connecteur, insère les candidats dédoublonnés. */
export async function handleSearch(
  deps: CampaignDeps,
  p: JobPayload<typeof searchRunJob>,
  signal?: AbortSignal,
) {
  const orgId = p.organizationId;
  const connector = connectorByCode(p.connector);
  if (!connector) return { skipped: 'unknown_connector' };
  const ctx = await withTenant(deps.db, { orgId }, async (tx) => {
    const [c] = await tx
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, p.campaignId));
    if (!c || c.status !== 'running') return null;
    return { c, spec: await latestSpec(tx, p.campaignId) };
  });
  if (!ctx?.spec) return { skipped: true };
  // Assez de candidats : on n'interroge plus (coût maîtrisé).
  if (ctx.c.candidatesCount >= ctx.c.maxProspects * 4) return { skipped: 'enough_candidates' };
  // Réservation consommée ou nombre demandé livré : plus aucune requête (constat 4).
  if (
    ctx.c.deliveredCount >= ctx.c.maxProspects ||
    (deps.mode === 'saas' && ctx.c.reservedMc > 0 && ctx.c.consumedMc >= ctx.c.reservedMc)
  )
    return { skipped: 'budget_reached' };
  const query = connector.buildQueries(ctx.spec.spec)[p.queryIndex];
  if (!query) return { skipped: 'no_query' };
  if (!deps.breaker.canCall(p.connector)) return { skipped: 'circuit_open' };
  const mode = await withTenant(deps.db, { orgId }, (tx) =>
    campaignCostMode(tx, deps.mode, ctx.c, deps.now()),
  );
  const tier = connector.manifest.costTier;
  if ((mode === 'free_only' && tier !== 'free') || (mode === 'economy' && tier === 'paid'))
    return { skipped: 'cost_guard' };
  if (!deps.limiter(p.connector, connector.manifest.rateLimit.perSecond))
    throw new RetryLaterError('limite de débit');

  const key = await resolveKeys(deps, orgId);
  let result;
  try {
    result = await connector.search(query, connectorCtx(deps, key, signal), ctx.spec.spec);
    deps.breaker.success(p.connector);
  } catch (err) {
    if (err instanceof ConnectorError && !err.retryable) {
      // Erreur non réessayable (clé refusée, requête invalide) : on continue sans cette source.
      await withTenant(deps.db, { orgId }, (tx) =>
        emit(tx, orgId, p.campaignId, 'campaign.warning', {
          code: 'source_failed',
          connector: p.connector,
          reason: err.code,
        }),
      );
      return { failed: err.code };
    }
    deps.breaker.failure(p.connector);
    throw err;
  }
  const groups = mergeCandidates(result.candidates);
  const created: string[] = [];
  await withTenant(deps.db, { orgId }, async (tx) => {
    if (result.billableRequests > 0)
      await recordUsage(tx, {
        orgId,
        campaignId: p.campaignId,
        kind: 'connector',
        provider: p.connector,
        source: p.connector,
        units: result.billableRequests,
        costMicroUsd: result.billableRequests * connector.manifest.costMicroUsdPerRequest,
      });
    const keys = groups.map((g) => g.key);
    const existing = keys.length
      ? new Set(
          (
            await tx
              .select({ k: schema.prospects.dedupeKey })
              .from(schema.prospects)
              .where(inArray(schema.prospects.dedupeKey, keys))
          ).map((r) => r.k),
        )
      : new Set<string>();
    let duplicates = 0;
    for (const g of groups) {
      if (existing.has(g.key)) {
        duplicates++;
        continue;
      }
      const c = g.primary;
      const [row] = await tx
        .insert(schema.prospects)
        .values({
          organizationId: orgId,
          campaignId: p.campaignId,
          kind: c.kind,
          prospectingModel: ctx.spec!.spec.model,
          displayName: c.displayName.slice(0, 300),
          countryCode: c.countryCode,
          city: c.city?.slice(0, 200),
          websiteDomain: c.websiteDomain,
          dedupeKey: dedupeKey(c),
          ownerUserId: ctx.c.createdBy,
          sourceCodes: [...new Set(g.sources.map((s) => s.sourceCode))],
          attributes: {
            ...c.attributes,
            category: c.category ?? null,
            address: c.address ?? null,
            registryId: c.registryId ?? null,
            externalId: c.externalId ?? null,
            sourceUrl: c.sourceUrl ?? null,
            snippet: c.snippet ?? null,
            publishedAt: c.publishedAt ?? null,
            signals: c.signals.map((s) => ({
              key: s.key,
              observedAt: s.observedAt ?? null,
              url: s.url ?? null,
            })),
          },
        })
        .onConflictDoNothing()
        .returning({ id: schema.prospects.id });
      if (!row) {
        duplicates++;
        continue;
      }
      await insertEvidence(deps, tx, orgId, row.id, g.sources);
      const src = {
        code: c.sourceCode,
        url: c.sourceUrl,
        legalBasis: c.legalBasis,
        country: c.countryCode,
        license: c.dataLicense,
      };
      // Personne physique : aucune coordonnée collectée (minimisation, constat 1).
      const individual = isIndividualKind(c.kind);
      if (!individual)
        for (const e of c.emails.slice(0, 3))
          await insertContact(deps, tx, {
            orgId,
            prospectId: row.id,
            channel: 'email',
            value: e,
            source: src,
          });
      if (!individual)
        for (const ph of c.phones.slice(0, 2))
          await insertContact(deps, tx, {
            orgId,
            prospectId: row.id,
            channel: 'phone',
            value: ph,
            source: src,
          });
      created.push(row.id);
      await emit(tx, orgId, p.campaignId, 'prospect.created', {
        prospectId: row.id,
        source: c.sourceCode,
      });
    }
    await tx
      .update(schema.campaigns)
      .set({
        candidatesCount: sql`${schema.campaigns.candidatesCount} + ${created.length}`,
        duplicatesCount: sql`${schema.campaigns.duplicatesCount} + ${duplicates}`,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.campaigns.id, p.campaignId));
  });
  for (const prospectId of created) {
    await publishTenantJob(
      deps.boss,
      deps.db,
      prospectProcessJob,
      { organizationId: orgId, campaignId: p.campaignId, prospectId },
      {
        refType: 'campaign',
        refId: p.campaignId,
        singletonKey: `process:${prospectId}`,
      },
    );
  }
  return { created: created.length, candidates: result.candidates.length };
}
