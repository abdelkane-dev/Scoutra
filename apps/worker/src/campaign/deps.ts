import { promises as dns } from 'node:dns';
import type { LlmClient } from '@scoutra/ai';
import type { VerifyDeps } from '@scoutra/agents';
import { PLATFORM_KEYS, type AgentsEnv } from '@scoutra/config';
import {
  CircuitBreaker,
  createHttpClient,
  type ConnectorConfig,
  type ConnectorCtx,
  type HttpClient,
  type SearchProvider,
} from '@scoutra/connectors';
import { SlidingWindowLimiter, type ScoutraMode } from '@scoutra/core';
import { createKeyring, decodeMasterKey, decryptSecret, type Keyring } from '@scoutra/crypto';
import { isNull, schema, withTenant, type Database } from '@scoutra/db';
import type { Boss } from '@scoutra/queue';

/** Dépendances injectées des tâches de campagne (remplaçables en test : HTTP, IA, DNS, horloge). */
export interface CampaignDeps {
  db: Database;
  boss: Boss;
  llm: LlmClient;
  http: HttpClient;
  config: ConnectorConfig;
  searchProviders: readonly SearchProvider[];
  mode: ScoutraMode;
  breaker: CircuitBreaker;
  /** Limites de débit par fournisseur (processus du worker). */
  limiter(connector: string, perSecond: number): boolean;
  keyring: Keyring;
  hashKey: Buffer;
  platformKey(provider: string): string | undefined;
  verify: VerifyDeps;
  now(): Date;
}

export function connectorConfigFrom(env: AgentsEnv): ConnectorConfig {
  return {
    searxngUrl: env.SCOUTRA_SEARXNG_URL,
    overpassUrl: env.SCOUTRA_OVERPASS_URL,
    crawl4aiUrl: env.SCOUTRA_CRAWL4AI_URL,
  };
}

export function createCampaignDeps(o: {
  env: AgentsEnv & {
    SCOUTRA_MASTER_KEY: string;
    SCOUTRA_MASTER_KEY_VERSION: number;
    SCOUTRA_HASH_KEY: string;
    SCOUTRA_MODE: ScoutraMode;
  };
  db: Database;
  boss: Boss;
  llm: LlmClient;
}): CampaignDeps {
  const config = connectorConfigFrom(o.env);
  const http = createHttpClient(config);
  const limiters = new Map<string, SlidingWindowLimiter>();
  const reacherUrl = o.env.SCOUTRA_REACHER_URL;
  return {
    db: o.db,
    boss: o.boss,
    llm: o.llm,
    http,
    config,
    searchProviders: o.env.SCOUTRA_SEARCH_PROVIDERS,
    mode: o.env.SCOUTRA_MODE,
    breaker: new CircuitBreaker(),
    limiter(connector, perSecond) {
      let l = limiters.get(connector);
      if (!l) {
        // Fenêtre de 10 s : au moins 1 requête autorisée par fenêtre.
        l = new SlidingWindowLimiter(Math.max(1, Math.floor(perSecond * 10)), 10_000);
        limiters.set(connector, l);
      }
      return l.take(connector);
    },
    keyring: createKeyring(o.env.SCOUTRA_MASTER_KEY_VERSION, {
      [o.env.SCOUTRA_MASTER_KEY_VERSION]: o.env.SCOUTRA_MASTER_KEY,
    }),
    hashKey: decodeMasterKey(o.env.SCOUTRA_HASH_KEY),
    platformKey: (p) => {
      const k = PLATFORM_KEYS[p];
      return k ? (o.env[k] as string | undefined) : undefined;
    },
    verify: {
      resolveMx: async (d) => (await dns.resolveMx(d)).map((m) => m.exchange),
      ...(reacherUrl
        ? {
            reacher: async (email: string) => {
              const res = await http.internal(`${reacherUrl.replace(/\/$/, '')}/v0/check_email`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ to_email: email }),
                timeoutMs: 30_000,
              });
              const r = res.json<{ is_reachable?: string }>();
              const map: Record<string, 'safe' | 'invalid' | 'risky' | 'unknown'> = {
                safe: 'safe',
                invalid: 'invalid',
                risky: 'risky',
              };
              return map[r.is_reachable ?? ''] ?? 'unknown';
            },
          }
        : {}),
    },
    now: () => new Date(),
  };
}

/**
 * Clés d'une organisation : clés du client (api_credentials, chiffrées par enveloppe) puis clés
 * plateforme (SaaS) ou de l'installation (licence). Jamais journalisées ni envoyées à un LLM.
 */
export async function resolveKeys(
  deps: CampaignDeps,
  orgId: string,
): Promise<(p: string) => string | undefined> {
  const rows = await withTenant(deps.db, { orgId }, (tx) =>
    tx
      .select({
        provider: schema.apiCredentials.provider,
        ciphertext: schema.apiCredentials.ciphertext,
        wrappedDek: schema.apiCredentials.wrappedDek,
        keyVersion: schema.apiCredentials.keyVersion,
      })
      .from(schema.apiCredentials)
      .where(isNull(schema.apiCredentials.revokedAt)),
  );
  const own = new Map<string, string>();
  for (const r of rows) {
    try {
      own.set(
        r.provider,
        decryptSecret(
          { v: 1, keyVersion: r.keyVersion, wrappedDek: r.wrappedDek, ciphertext: r.ciphertext },
          { orgId, purpose: `api_credential:${r.provider}` },
          deps.keyring,
        ),
      );
    } catch {
      /* clé illisible (rotation incomplète) : ignorée */
    }
  }
  return (p) => own.get(p) ?? deps.platformKey(p);
}

export function connectorCtx(
  deps: CampaignDeps,
  key: (p: string) => string | undefined,
  signal?: AbortSignal,
): ConnectorCtx {
  return { http: deps.http, key, config: deps.config, signal, now: deps.now };
}
