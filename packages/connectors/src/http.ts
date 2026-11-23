import { assertSafeUrl, safeFetch } from '@scoutra/core';
import type { ConnectorConfig, HttpClient, HttpResponse } from './types';

function wrap(status: number, body: string): HttpResponse {
  return { status, text: () => body, json: <T>() => JSON.parse(body) as T };
}

/**
 * Client HTTP de production :
 * - `request` : TOUTE URL externe passe par safeFetch (garde SSRF, E5) ;
 * - `internal` : uniquement les services dont l'URL de base est fixée par l'exploitant
 *   (SearXNG, Overpass dédié) ; toute autre URL est refusée.
 */
export function createHttpClient(config: ConnectorConfig): HttpClient {
  const internalBases = [
    config.searxngUrl,
    config.overpassUrl,
    config.crawl4aiUrl,
    config.reacherUrl,
  ]
    .filter((u): u is string => !!u)
    .map((u) => new URL(u));
  return {
    async request(url, req = {}) {
      const res = await safeFetch(url, {
        method: req.method ?? 'GET',
        headers: req.headers,
        body: req.body,
        timeoutMs: req.timeoutMs ?? 15_000,
        totalTimeoutMs: (req.timeoutMs ?? 15_000) + 10_000,
        maxBytes: 3 * 1024 * 1024,
      });
      return wrap(res.status, res.body.toString('utf8'));
    },
    async internal(url, req = {}) {
      const u = new URL(url);
      const ok = internalBases.some(
        (b) => b.origin === u.origin && u.pathname.startsWith(b.pathname.replace(/\/$/, '')),
      );
      if (!ok) {
        // Pas un service configuré : traité comme une URL externe ordinaire.
        assertSafeUrl(url);
        return this.request(url, req);
      }
      const res = await fetch(u, {
        method: req.method ?? 'GET',
        headers: req.headers,
        body: req.body,
        redirect: 'error',
        signal: AbortSignal.timeout(req.timeoutMs ?? 20_000),
      });
      const text = await res.text();
      return wrap(res.status, text.slice(0, 3 * 1024 * 1024));
    },
  };
}
