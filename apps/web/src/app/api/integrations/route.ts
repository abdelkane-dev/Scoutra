import { ALL_CONNECTORS, websiteManifest } from '@scoutra/connectors';
import { withTenant } from '@scoutra/db';
import { availableKeys } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { getEnv } from '@/server/env';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/**
 * Sources de données et leur état pour l'organisation : prête (gratuite ou clé présente), clé
 * manquante, service non configuré. Statut légal, coût et pays affichés (manifestes).
 */
export const GET = apiRoute({ action: 'org:read' }, async ({ ctx }) => {
  const env = getEnv();
  const db = await appDb();
  const keys = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
    availableKeys(tx),
  );
  const services: Record<string, string | undefined> = {
    searxng: env.SCOUTRA_SEARXNG_URL,
    overpass: env.SCOUTRA_OVERPASS_URL ?? 'public',
    crawl4ai: env.SCOUTRA_CRAWL4AI_URL,
  };
  const items = [...ALL_CONNECTORS.map((c) => c.manifest), websiteManifest].map((m) => {
    const status =
      m.requiresKey && !keys.has(m.requiresKey)
        ? 'missing_key'
        : m.requiresServiceUrl && !services[m.requiresServiceUrl]
          ? 'not_configured'
          : 'ready';
    return {
      code: m.code,
      name: m.name,
      role: m.role,
      status,
      requiresKey: m.requiresKey,
      legalStatus: m.legalStatus,
      costTier: m.costTier,
      countries: m.countries,
      dataLicense: m.dataLicense ?? null,
      legalNotes: m.legalNotes,
    };
  });
  return json({
    items,
    ai: { provider: env.SCOUTRA_AI_PROVIDER, available: env.SCOUTRA_AI_PROVIDER !== 'none' },
    verification: { reacher: !!env.SCOUTRA_REACHER_URL },
  });
});
