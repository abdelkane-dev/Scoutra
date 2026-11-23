import { looksLikePersonName, type IsoCountry } from '@scoutra/core';
import type { RawCandidate, SourceConnector } from '../types';
import { escapeRegex, normalizeDomain, parseJson, places } from '../util';

/** Domaine national de premier niveau d'un pays (GB → uk). */
export function ccTld(country: IsoCountry): string {
  return country === 'GB' ? 'uk' : country.toLowerCase();
}

/** Certificate Transparency (crt.sh) : nouveaux domaines = entreprises récentes. */
export const crtshConnector: SourceConnector = {
  manifest: {
    code: 'crtsh',
    name: {
      fr: 'Nouveaux domaines (Certificate Transparency)',
      en: 'New domains (Certificate Transparency)',
    },
    version: '1',
    role: 'search',
    prospectKinds: ['company'],
    models: 'all',
    countries: 'WORLD',
    legalStatus: 'open_data',
    defaultLegalBasis: 'legitimate_interest',
    costMicroUsdPerRequest: 0,
    costTier: 'free',
    requiresKey: null,
    rateLimit: { perSecond: 0.2 },
    availableIn: ['saas', 'license'],
    signals: ['new_domain'],
    legalNotes:
      'Données techniques publiques (journaux de certificats). Aucune donnée de personne ; respecter les limites de crt.sh.',
  },
  buildQueries(spec) {
    const countries = [...new Set(places(spec, 6).map((p) => p.country))];
    return spec.keywords
      .filter((k) => !looksLikePersonName(k))
      .slice(0, 2)
      .flatMap((kw) =>
        countries.map((country) => ({
          text: kw
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '')
            .slice(0, 30),
          country,
          intent: 'entities' as const,
          signal: 'new_domain' as const,
          limit: 30,
        })),
      )
      .filter((q) => q.text.length >= 3);
  },
  async search(q, ctx) {
    const tld = ccTld(q.country);
    const res = await ctx.http.request(
      `https://crt.sh/?q=${encodeURIComponent(`%${q.text}%.${tld}`)}&output=json&exclude=expired`,
      { timeoutMs: 30_000 },
    );
    const rows = parseJson<{ name_value?: string; not_before?: string }[]>('crtsh', res);
    const cutoff = new Date(ctx.now().getTime() - 90 * 86_400_000);
    const re = new RegExp(`\\.${escapeRegex(tld)}$`);
    const byDomain = new Map<string, string>();
    for (const r of Array.isArray(rows) ? rows : []) {
      if (!r.not_before || new Date(r.not_before) < cutoff) continue;
      for (const raw of (r.name_value ?? '').split('\n')) {
        if (raw.includes('*')) continue;
        const d = normalizeDomain(raw);
        if (!d || !re.test(d) || !d.includes(q.text)) continue;
        const parts = d.split('.');
        const base = parts
          .slice(-(['co', 'com', 'org', 'gouv', 'ac'].includes(parts.at(-2)!) ? 3 : 2))
          .join('.');
        const prev = byDomain.get(base);
        if (!prev || r.not_before < prev) byDomain.set(base, r.not_before);
      }
    }
    const out: RawCandidate[] = [...byDomain.entries()].slice(0, q.limit).map(([domain, at]) => ({
      sourceCode: 'crtsh',
      sourceUrl: `https://crt.sh/?q=${encodeURIComponent(domain)}`,
      externalId: `domain:${domain}`,
      kind: 'company',
      displayName: domain,
      countryCode: q.country,
      websiteDomain: domain,
      phones: [],
      emails: [],
      signals: [{ key: 'new_domain', observedAt: at }],
      attributes: { firstCertificateAt: at },
      legalBasis: 'legitimate_interest',
    }));
    return { candidates: out, billableRequests: 0 };
  },
};
