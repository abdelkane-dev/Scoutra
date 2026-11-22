import type { RawCandidate, SourceConnector } from '../types';
import { ConnectorError } from '../types';
import { clip, countryName, entityQueries, normalizeDomain, parseJson } from '../util';

/** Champs demandés (SKU Text Search Enterprise : téléphone et site inclus). */
export const PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.websiteUri',
  'places.internationalPhoneNumber',
  'places.primaryType',
  'places.businessStatus',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
].join(',');

interface Place {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  websiteUri?: string;
  internationalPhoneNumber?: string;
  primaryType?: string;
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
}

export const googlePlacesConnector: SourceConnector = {
  manifest: {
    code: 'google_places',
    name: { fr: 'Google Places API (New)', en: 'Google Places API (New)' },
    version: '1',
    role: 'search',
    prospectKinds: ['company', 'nonprofit', 'public_buyer'],
    models: 'all',
    countries: 'WORLD',
    legalStatus: 'official_api',
    defaultLegalBasis: 'legitimate_interest',
    costMicroUsdPerRequest: 35_000, // Text Search Enterprise : 35 $ / 1 000 requêtes
    costTier: 'paid',
    requiresKey: 'google_places',
    rateLimit: { perSecond: 5 },
    availableIn: ['saas', 'license'],
    signals: ['recent_reviews', 'no_website'],
    legalNotes:
      'API officielle Google (conditions Google Maps Platform : affichage et durée de conservation limités ; pas d’aspiration de Google Maps).',
  },
  buildQueries(spec) {
    return entityQueries(spec, 'WORLD', { maxKeywords: 3, maxPlaces: 4, limit: 20 });
  },
  async search(q, ctx) {
    const key = ctx.key('google_places');
    if (!key) throw new ConnectorError('google_places', 'auth', false);
    const res = await ctx.http.request('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': key,
        'x-goog-fieldmask': PLACES_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: `${q.text} ${q.city ?? countryName(q.country, 'en')}`,
        regionCode: q.country,
        pageSize: Math.min(q.limit, 20),
      }),
    });
    const data = parseJson<{ places?: Place[] }>('google_places', res);
    const out: RawCandidate[] = [];
    for (const p of data.places ?? []) {
      const name = clip(p.displayName?.text, 300);
      if (!name || !p.id || p.businessStatus === 'CLOSED_PERMANENTLY') continue;
      const website = normalizeDomain(p.websiteUri);
      out.push({
        sourceCode: 'google_places',
        sourceUrl: p.googleMapsUri,
        externalId: `gplace:${p.id}`,
        kind: 'company',
        displayName: name,
        countryCode: q.country,
        city: q.city,
        address: clip(p.formattedAddress, 300),
        websiteDomain: website,
        phones: p.internationalPhoneNumber ? [p.internationalPhoneNumber] : [],
        emails: [],
        category: clip(p.primaryType, 100),
        signals: website ? [] : [{ key: 'no_website' }],
        attributes: { rating: p.rating ?? null, ratingCount: p.userRatingCount ?? null },
        legalBasis: 'legitimate_interest',
      });
    }
    return { candidates: out, billableRequests: 1 };
  },
};
