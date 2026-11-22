import type { TargetSpec } from '@scoutra/core';
import type { ConnectorQuery, RawCandidate, SourceConnector } from '../types';
import {
  clip,
  entityQueries,
  escapeOverpass,
  escapeRegex,
  normalizeDomain,
  parseJson,
} from '../util';

/** Correspondance mots-clés (FR/EN) → étiquettes OSM. Hors liste : recherche par nom. */
const TAGS: [RegExp, string][] = [
  [/restaurant|resto|maquis/i, 'amenity=restaurant'],
  [/h[oô]tel/i, 'tourism=hotel'],
  [/pharmac/i, 'amenity=pharmacy'],
  [/[ée]cole|school/i, 'amenity=school'],
  [/universit/i, 'amenity=university'],
  [/clinique|clinic/i, 'amenity=clinic'],
  [/h[oô]pital|hospital/i, 'amenity=hospital'],
  [/dentist/i, 'amenity=dentist'],
  [/banque|bank/i, 'amenity=bank'],
  [/caf[ée]|coffee/i, 'amenity=cafe'],
  [/\bbar\b/i, 'amenity=bar'],
  [/garage|m[ée]canique|car repair/i, 'shop=car_repair'],
  [/coiff|hairdress/i, 'shop=hairdresser'],
  [/supermarch|supermarket/i, 'shop=supermarket'],
  [/boulanger|bakery/i, 'shop=bakery'],
  [/avocat|lawyer/i, 'office=lawyer'],
  [/comptab|accountant/i, 'office=accountant'],
  [/immobili|estate agent/i, 'office=estate_agent'],
  [/\bong\b|ngo|association/i, 'office=ngo'],
  [/assurance|insurance/i, 'office=insurance'],
  [/salle de sport|gym|fitness/i, 'leisure=fitness_centre'],
  [/v[eê]tement|clothes|boutique/i, 'shop=clothes'],
];

export function tagFor(keyword: string): string | undefined {
  return TAGS.find(([re]) => re.test(keyword))?.[1];
}

/** Requête Overpass QL (valeurs échappées, résultat borné). */
export function overpassQuery(q: ConnectorQuery): string {
  const area = q.city
    ? `area["ISO3166-1"="${q.country}"]->.c;area(area.c)["name"="${escapeOverpass(q.city)}"]->.a;`
    : `area["ISO3166-1"="${q.country}"]->.a;`;
  const tag = tagFor(q.text);
  const filter = tag
    ? `["${tag.split('=')[0]}"="${tag.split('=')[1]}"]`
    : `["name"~"${escapeOverpass(escapeRegex(q.text))}",i]`;
  return `[out:json][timeout:25];${area}nwr${filter}["name"](area.a);out center tags ${Math.min(q.limit * 3, 150)};`;
}

interface Element {
  type: string;
  id: number;
  tags?: Record<string, string>;
}

export const osmConnector: SourceConnector = {
  manifest: {
    code: 'osm_overpass',
    name: { fr: 'OpenStreetMap (Overpass)', en: 'OpenStreetMap (Overpass)' },
    version: '1',
    role: 'search',
    prospectKinds: ['company', 'nonprofit', 'public_buyer'],
    models: 'all',
    countries: 'WORLD',
    legalStatus: 'open_data',
    defaultLegalBasis: 'legitimate_interest',
    dataLicense: 'ODbL 1.0 — © les contributeurs OpenStreetMap',
    costMicroUsdPerRequest: 0,
    costTier: 'free',
    requiresKey: null,
    rateLimit: { perSecond: 1, perDay: 10_000 },
    availableIn: ['saas', 'license'],
    signals: ['no_website'],
    legalNotes:
      'Données ouvertes ODbL : attribution obligatoire. Usage commercial intensif : instance Overpass dédiée (SCOUTRA_OVERPASS_URL).',
  },
  buildQueries(spec: TargetSpec) {
    return entityQueries(spec, 'WORLD', { maxKeywords: 4, maxPlaces: 6, limit: 30 });
  },
  async search(q, ctx) {
    // Instance configurée par l'exploitant (recommandée) ou instance publique (limitée).
    const data$ = encodeURIComponent(overpassQuery(q));
    const res = ctx.config.overpassUrl
      ? await ctx.http.internal(`${ctx.config.overpassUrl}?data=${data$}`, { timeoutMs: 30_000 })
      : await ctx.http.request(`https://overpass-api.de/api/interpreter?data=${data$}`, {
          timeoutMs: 30_000,
        });
    const data = parseJson<{ elements?: Element[] }>('osm_overpass', res);
    const out: RawCandidate[] = [];
    for (const e of data.elements ?? []) {
      const t = e.tags ?? {};
      const name = clip(t.name, 300);
      if (!name) continue;
      const website = normalizeDomain(t.website ?? t['contact:website']);
      const phone = t.phone ?? t['contact:phone'];
      const email = t.email ?? t['contact:email'];
      out.push({
        sourceCode: 'osm_overpass',
        sourceUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`,
        externalId: `osm:${e.type}/${e.id}`,
        kind: t.office === 'ngo' ? 'nonprofit' : 'company',
        displayName: name,
        countryCode: q.country,
        city: clip(t['addr:city'], 200) ?? q.city,
        address: clip([t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '), 300),
        websiteDomain: website,
        phones: phone ? [phone.split(';')[0]!.trim()] : [],
        emails: email ? [email.split(';')[0]!.trim()] : [],
        category: clip(t.amenity ?? t.shop ?? t.office ?? t.tourism ?? t.craft, 100),
        signals: website ? [] : [{ key: 'no_website' }],
        attributes: { openingHours: clip(t.opening_hours, 200) ?? null },
        legalBasis: 'legitimate_interest',
        dataLicense: 'ODbL',
      });
      if (out.length >= q.limit) break;
    }
    return { candidates: out, billableRequests: 0 };
  },
};
