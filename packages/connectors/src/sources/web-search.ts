import type { ProspectKind, TargetSpec } from '@scoutra/core';
import { PROSPECTING_MODELS } from '@scoutra/core';
import type {
  ConnectorCtx,
  ConnectorManifest,
  ConnectorQuery,
  RawCandidate,
  SearchResult,
  SourceConnector,
} from '../types';
import { ConnectorError } from '../types';
import {
  clip,
  countryName,
  entityQueries,
  isCompanyDomain,
  normalizeDomain,
  parseJson,
  places,
} from '../util';

/**
 * Recherche web via l'API d'un moteur (Serper, Brave, Tavily) ou SearXNG auto-hébergé.
 * Signaux publics indexés (Facebook, Instagram, TikTok, LinkedIn, Reddit, forums) par requêtes
 * `site:` : on ne garde que titre, extrait, URL et date. JAMAIS de connexion à une plateforme,
 * jamais de lecture de profil : l'utilisateur ouvre lui-même le lien.
 */
export type SearchProvider = 'serper' | 'brave' | 'tavily' | 'searxng';

interface Hit {
  title: string;
  url: string;
  snippet?: string;
  date?: string;
}

export const SOCIAL_SITES = [
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'linkedin.com/posts',
  'reddit.com',
  'x.com',
] as const;

const REQUEST_PHRASES: Record<'fr' | 'en', string[]> = {
  fr: ['"je cherche"', '"qui connaît"', '"recommandez"', '"besoin d\'un"'],
  en: ['"looking for"', '"can anyone recommend"', '"need a"', '"recommendations for"'],
};

function platformOf(url: string): string {
  const d = normalizeDomain(url) ?? '';
  const site = SOCIAL_SITES.find((s) => d.endsWith(s.split('/')[0]!));
  return site ? site.split('.')[0]! : 'web';
}

const COST: Record<SearchProvider, number> = {
  serper: 1000, // ≈ 0,001 $ / requête (docs/offres/credits.md §1.2)
  brave: 5000,
  tavily: 8000,
  searxng: 0,
};

function manifest(provider: SearchProvider): ConnectorManifest {
  const names: Record<SearchProvider, string> = {
    serper: 'Serper (Google)',
    brave: 'Brave Search',
    tavily: 'Tavily',
    searxng: 'SearXNG',
  };
  return {
    code: `search_${provider}`,
    name: { fr: `Recherche web — ${names[provider]}`, en: `Web search — ${names[provider]}` },
    version: '1',
    role: 'search',
    prospectKinds: ['company', 'person', 'creator', 'listing', 'nonprofit', 'public_buyer'],
    models: 'all',
    countries: 'WORLD',
    legalStatus: provider === 'searxng' ? 'public_web' : 'official_api',
    defaultLegalBasis: 'legitimate_interest',
    costMicroUsdPerRequest: COST[provider],
    costTier: provider === 'searxng' ? 'free' : provider === 'serper' ? 'cheap' : 'paid',
    requiresKey: provider === 'searxng' ? null : provider,
    ...(provider === 'searxng' ? { requiresServiceUrl: 'searxng' as const } : {}),
    rateLimit: { perSecond: provider === 'brave' ? 20 : 5 },
    availableIn: ['saas', 'license'],
    signals: [
      'public_request',
      'hiring',
      'funding',
      'product_launch',
      'event_participation',
      'active_listing',
    ],
    legalNotes:
      'Résultats de moteur de recherche (contenu public indexé). Seuls titre, extrait, URL et date sont conservés ; aucune connexion aux plateformes.',
  };
}

/** Requêtes : découverte d'entités + signaux publics « je cherche » si le modèle vise des particuliers. */
export function buildSearchQueries(spec: TargetSpec): ConnectorQuery[] {
  const lang = spec.language;
  const qs = entityQueries(spec, 'WORLD', { maxKeywords: 3, maxPlaces: 4, limit: 10 }).map((q) => ({
    ...q,
    text: [q.text, q.city ?? countryName(q.country, lang)].join(' '),
  }));
  const model = PROSPECTING_MODELS.find((m) => m.code === spec.model);
  const wantsPublic =
    model?.involvesIndividuals || spec.signals.some((s) => s.key === 'public_request');
  if (wantsPublic) {
    const sites = SOCIAL_SITES.map((s) => `site:${s}`).join(' OR ');
    for (const kw of spec.keywords.slice(0, 2)) {
      for (const p of places(spec, 3)) {
        const where = p.city ?? countryName(p.country, lang);
        qs.push({
          text: `(${sites}) (${REQUEST_PHRASES[lang].join(' OR ')}) ${kw} ${where}`,
          country: p.country,
          city: p.city,
          intent: 'public_signals',
          signal: 'public_request',
          limit: 10,
        });
      }
    }
  }
  return qs;
}

async function fetchHits(
  provider: SearchProvider,
  q: ConnectorQuery,
  ctx: ConnectorCtx,
): Promise<Hit[]> {
  const code = `search_${provider}`;
  const gl = q.country.toLowerCase();
  if (provider === 'serper') {
    const key = ctx.key('serper');
    if (!key) throw new ConnectorError(code, 'auth', false);
    const res = await ctx.http.request('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'x-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ q: q.text, gl, num: q.limit }),
    });
    const data = parseJson<{
      organic?: { title?: string; link?: string; snippet?: string; date?: string }[];
    }>(code, res);
    return (data.organic ?? []).map((o) => ({
      title: o.title ?? '',
      url: o.link ?? '',
      snippet: o.snippet,
      date: o.date,
    }));
  }
  if (provider === 'brave') {
    const key = ctx.key('brave');
    if (!key) throw new ConnectorError(code, 'auth', false);
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q.text)}&country=${gl}&count=${Math.min(q.limit, 20)}`;
    const res = await ctx.http.request(url, {
      headers: { 'x-subscription-token': key, accept: 'application/json' },
    });
    const data = parseJson<{
      web?: { results?: { title?: string; url?: string; description?: string; age?: string }[] };
    }>(code, res);
    return (data.web?.results ?? []).map((o) => ({
      title: o.title ?? '',
      url: o.url ?? '',
      snippet: o.description,
      date: o.age,
    }));
  }
  if (provider === 'tavily') {
    const key = ctx.key('tavily');
    if (!key) throw new ConnectorError(code, 'auth', false);
    const res = await ctx.http.request('https://api.tavily.com/search', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        query: q.text,
        max_results: Math.min(q.limit, 20),
        search_depth: 'basic',
      }),
    });
    const data = parseJson<{
      results?: { title?: string; url?: string; content?: string; published_date?: string }[];
    }>(code, res);
    return (data.results ?? []).map((o) => ({
      title: o.title ?? '',
      url: o.url ?? '',
      snippet: o.content,
      date: o.published_date,
    }));
  }
  const base = ctx.config.searxngUrl;
  if (!base) throw new ConnectorError(code, 'unavailable', false);
  const res = await ctx.http.internal(
    `${base.replace(/\/$/, '')}/search?format=json&q=${encodeURIComponent(q.text)}`,
  );
  const data = parseJson<{
    results?: { title?: string; url?: string; content?: string; publishedDate?: string }[];
  }>(code, res);
  return (data.results ?? []).slice(0, q.limit).map((o) => ({
    title: o.title ?? '',
    url: o.url ?? '',
    snippet: o.content,
    date: o.publishedDate ?? undefined,
  }));
}

function toCandidate(
  provider: SearchProvider,
  q: ConnectorQuery,
  h: Hit,
  spec?: TargetSpec,
): RawCandidate | null {
  const code = `search_${provider}`;
  const title = clip(h.title, 300);
  if (!title || !/^https?:\/\//.test(h.url)) return null;
  const snippet = clip(h.snippet, 500);
  if (q.intent === 'public_signals') {
    const kind: ProspectKind =
      spec?.kinds.find((k) => k === 'listing' || k === 'creator') ?? 'person';
    return {
      sourceCode: code,
      sourceUrl: h.url,
      externalId: h.url,
      kind,
      displayName: title,
      countryCode: q.country,
      city: q.city,
      phones: [],
      emails: [],
      snippet,
      publishedAt: h.date,
      signals: [{ key: 'public_request', snippet, url: h.url, observedAt: h.date }],
      attributes: { platform: platformOf(h.url), publicSignalOnly: true },
      legalBasis: 'legitimate_interest',
    };
  }
  const domain = normalizeDomain(h.url);
  if (!isCompanyDomain(domain)) return null;
  return {
    sourceCode: code,
    sourceUrl: h.url,
    kind: spec?.kinds.includes('company') || !spec ? 'company' : spec.kinds[0]!,
    displayName: clip(title.split(/ [|–-] /)[0], 300) ?? title,
    countryCode: q.country,
    city: q.city,
    websiteDomain: domain,
    phones: [],
    emails: [],
    snippet,
    publishedAt: h.date,
    signals: [],
    attributes: {},
    legalBasis: 'legitimate_interest',
  };
}

export function webSearchConnector(provider: SearchProvider): SourceConnector {
  const m = manifest(provider);
  const run = async (
    q: ConnectorQuery,
    ctx: ConnectorCtx,
    spec?: TargetSpec,
  ): Promise<SearchResult> => {
    const hits = await fetchHits(provider, q, ctx);
    const seen = new Set<string>();
    const candidates: RawCandidate[] = [];
    for (const h of hits) {
      const c = toCandidate(provider, q, h, spec);
      const k = c?.websiteDomain ?? c?.sourceUrl;
      if (c && k && !seen.has(k)) {
        seen.add(k);
        candidates.push(c);
      }
    }
    return { candidates, billableRequests: 1 };
  };
  return {
    manifest: m,
    buildQueries: buildSearchQueries,
    search: run,
  };
}
