import { looksLikePersonName, type IsoCountry, type TargetSpec } from '@scoutra/core';
import { ConnectorError, type ConnectorQuery, type HttpResponse } from './types';

/** Domaines jamais retenus comme « site de l'entreprise » (réseaux, annuaires, places de marché). */
const NON_COMPANY_DOMAINS = [
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'reddit.com',
  'wikipedia.org',
  'google.com',
  'pagesjaunes.fr',
  'yelp.com',
  'tripadvisor.com',
  'tripadvisor.fr',
  'amazon.com',
  'jumia.com',
  'societe.com',
  'pappers.fr',
  'wa.me',
  'whatsapp.com',
];

/** Domaine normalisé (minuscule, sans www., sans port) ou undefined. */
export function normalizeDomain(input: string | undefined | null): string | undefined {
  if (!input) return undefined;
  let s = input.trim().toLowerCase();
  if (!s) return undefined;
  if (!/^https?:\/\//.test(s)) s = `https://${s}`;
  try {
    const host = new URL(s).hostname.replace(/^www\./, '').replace(/\.$/, '');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) || host.length > 253) return undefined;
    return host;
  } catch {
    return undefined;
  }
}

export function isCompanyDomain(domain: string | undefined): domain is string {
  if (!domain) return false;
  return !NON_COMPANY_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/** Contrôle de statut commun : 429/5xx = réessayable, 401/403 = clé, autre 4xx = requête. */
export function checkStatus(connector: string, res: HttpResponse): void {
  if (res.status >= 200 && res.status < 300) return;
  if (res.status === 429) throw new ConnectorError(connector, 'rate_limited', true);
  if (res.status >= 500) throw new ConnectorError(connector, 'unavailable', true);
  if (res.status === 401 || res.status === 403) throw new ConnectorError(connector, 'auth', false);
  throw new ConnectorError(connector, 'invalid_query', false);
}

export function parseJson<T>(connector: string, res: HttpResponse): T {
  checkStatus(connector, res);
  try {
    return res.json<T>();
  } catch {
    throw new ConnectorError(connector, 'bad_response', true);
  }
}

const regionNames = {
  fr: new Intl.DisplayNames(['fr'], { type: 'region' }),
  en: new Intl.DisplayNames(['en'], { type: 'region' }),
};
export function countryName(code: IsoCountry, lang: 'fr' | 'en'): string {
  return regionNames[lang].of(code) ?? code;
}

/** Couples (pays, ville?) bornés pour limiter le nombre de requêtes. */
export function places(spec: TargetSpec, max = 6): { country: IsoCountry; city?: string }[] {
  const out: { country: IsoCountry; city?: string }[] = [];
  for (const country of spec.countries) {
    if (spec.regions.length === 0) out.push({ country });
    else for (const city of spec.regions) out.push({ country, city });
  }
  return out.slice(0, max);
}

export function entityQueries(
  spec: TargetSpec,
  allowed: readonly string[] | 'WORLD',
  opts: { maxKeywords?: number; maxPlaces?: number; limit?: number } = {},
): ConnectorQuery[] {
  const qs: ConnectorQuery[] = [];
  const pl = places(spec, opts.maxPlaces ?? 6).filter(
    (p) => allowed === 'WORLD' || allowed.includes(p.country),
  );
  // Jamais de requête sur un nom de personne ou un pseudo (constat 8).
  const keywords = spec.keywords.filter((k) => !looksLikePersonName(k));
  for (const kw of keywords.slice(0, opts.maxKeywords ?? 4)) {
    for (const p of pl) {
      qs.push({
        text: kw,
        country: p.country,
        city: p.city,
        intent: 'entities',
        limit: opts.limit ?? 20,
      });
    }
  }
  return qs;
}

export const clip = (s: string | undefined | null, n: number): string | undefined => {
  if (!s) return undefined;
  const t = s.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, n) : undefined;
};

/** Échappe une valeur pour une chaîne Overpass QL ou une expression régulière. */
export function escapeOverpass(s: string): string {
  return s.replace(/[\\"]/g, (c) => `\\${c}`).replace(/[\n\r]/g, ' ');
}
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
