import type { RawCandidate, SourceConnector } from '../types';
import { ConnectorError } from '../types';
import { clip, entityQueries, parseJson } from '../util';

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (now: Date, n: number) => new Date(now.getTime() - n * 86_400_000);

/** Registre britannique (API gratuite avec clé, 600 requêtes / 5 min). */
export const companiesHouseConnector: SourceConnector = {
  manifest: {
    code: 'uk_companies_house',
    name: { fr: 'Registre britannique (Companies House)', en: 'UK Companies House' },
    version: '1',
    role: 'search',
    prospectKinds: ['company', 'nonprofit'],
    models: 'all',
    countries: ['GB'],
    legalStatus: 'official_api',
    defaultLegalBasis: 'legitimate_interest',
    dataLicense: 'Open Government Licence v3.0',
    costMicroUsdPerRequest: 0,
    costTier: 'free',
    requiresKey: 'companies_house',
    rateLimit: { perSecond: 2 },
    availableIn: ['saas', 'license'],
    signals: ['new_company', 'insolvency'],
    legalNotes:
      'Registre public officiel (OGL). Les dirigeants (personnes physiques) ne sont pas collectés.',
  },
  buildQueries(spec) {
    const wantsNew = spec.signals.some((s) => s.key === 'new_company');
    return entityQueries(spec, ['GB'], { maxKeywords: 4, maxPlaces: 4, limit: 50 }).map((q) => ({
      ...q,
      signal: wantsNew ? ('new_company' as const) : undefined,
    }));
  },
  async search(q, ctx) {
    const key = ctx.key('companies_house');
    if (!key) throw new ConnectorError('uk_companies_house', 'auth', false);
    const params = new URLSearchParams({
      company_name_includes: q.text,
      company_status: 'active',
      size: String(Math.min(q.limit, 100)),
    });
    if (q.city) params.set('location', q.city);
    if (q.signal === 'new_company')
      params.set('incorporated_from', isoDate(daysAgo(ctx.now(), 180)));
    const res = await ctx.http.request(
      `https://api.company-information.service.gov.uk/advanced-search/companies?${params}`,
      { headers: { authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}` } },
    );
    if (res.status === 404) return { candidates: [], billableRequests: 0 };
    const data = parseJson<{
      items?: {
        company_name?: string;
        company_number?: string;
        company_status?: string;
        date_of_creation?: string;
        sic_codes?: string[];
        registered_office_address?: { locality?: string; postal_code?: string };
      }[];
    }>('uk_companies_house', res);
    const out: RawCandidate[] = [];
    for (const c of data.items ?? []) {
      const name = clip(c.company_name, 300);
      if (!name || !c.company_number) continue;
      const recent = c.date_of_creation && new Date(c.date_of_creation) >= daysAgo(ctx.now(), 365);
      out.push({
        sourceCode: 'uk_companies_house',
        sourceUrl: `https://find-and-update.company-information.service.gov.uk/company/${c.company_number}`,
        externalId: `gb-ch:${c.company_number}`,
        registryId: c.company_number,
        kind: 'company',
        displayName: name,
        countryCode: 'GB',
        city: clip(c.registered_office_address?.locality, 200),
        phones: [],
        emails: [],
        category: c.sic_codes?.[0],
        signals: recent ? [{ key: 'new_company', observedAt: c.date_of_creation }] : [],
        attributes: {
          sicCodes: (c.sic_codes ?? []).join(','),
          createdOn: c.date_of_creation ?? null,
        },
        legalBasis: 'legitimate_interest',
        dataLicense: 'OGL-UK-3.0',
      });
    }
    return { candidates: out, billableRequests: 0 };
  },
};

/** API Recherche d'entreprises (France, gratuite, sans clé, ≈ 7 requêtes/s). */
export const frRechercheEntreprisesConnector: SourceConnector = {
  manifest: {
    code: 'fr_recherche_entreprises',
    name: { fr: 'Annuaire des entreprises (France)', en: 'French company registry (API)' },
    version: '1',
    role: 'search',
    prospectKinds: ['company', 'nonprofit'],
    models: 'all',
    countries: ['FR'],
    legalStatus: 'open_data',
    defaultLegalBasis: 'legitimate_interest',
    dataLicense: 'Licence Ouverte Etalab 2.0',
    costMicroUsdPerRequest: 0,
    costTier: 'free',
    requiresKey: null,
    rateLimit: { perSecond: 5 },
    availableIn: ['saas', 'license'],
    signals: ['new_company'],
    legalNotes:
      'Données publiques (Licence Ouverte). Entrepreneurs individuels et entités « non diffusibles » exclus ; dirigeants non collectés.',
  },
  buildQueries(spec) {
    return entityQueries(spec, ['FR'], { maxKeywords: 4, maxPlaces: 4, limit: 25 });
  },
  async search(q, ctx) {
    const params = new URLSearchParams({
      q: [q.text, q.city].filter(Boolean).join(' '),
      per_page: String(Math.min(q.limit, 25)),
      etat_administratif: 'A',
    });
    const res = await ctx.http.request(
      `https://recherche-entreprises.api.gouv.fr/search?${params}`,
    );
    const data = parseJson<{
      results?: {
        siren?: string;
        nom_complet?: string;
        date_creation?: string;
        tranche_effectif_salarie?: string | null;
        activite_principale?: string;
        est_entrepreneur_individuel?: boolean;
        statut_diffusion?: string;
        siege?: { libelle_commune?: string; adresse?: string; code_postal?: string };
        complements?: { est_association?: boolean };
      }[];
    }>('fr_recherche_entreprises', res);
    const out: RawCandidate[] = [];
    for (const r of data.results ?? []) {
      const name = clip(r.nom_complet, 300);
      if (!name || !r.siren) continue;
      if (
        r.est_entrepreneur_individuel ||
        r.statut_diffusion === 'P' ||
        /NON-DIFFUSIBLE/i.test(name)
      )
        continue;
      const recent = r.date_creation && new Date(r.date_creation) >= daysAgo(ctx.now(), 365);
      out.push({
        sourceCode: 'fr_recherche_entreprises',
        sourceUrl: `https://annuaire-entreprises.data.gouv.fr/entreprise/${r.siren}`,
        externalId: `fr-siren:${r.siren}`,
        registryId: r.siren,
        kind: r.complements?.est_association ? 'nonprofit' : 'company',
        displayName: name,
        countryCode: 'FR',
        city: clip(r.siege?.libelle_commune, 200),
        address: clip(r.siege?.adresse, 300),
        phones: [],
        emails: [],
        category: r.activite_principale,
        signals: recent ? [{ key: 'new_company', observedAt: r.date_creation }] : [],
        attributes: {
          naf: r.activite_principale ?? null,
          sizeBand: r.tranche_effectif_salarie ?? null,
          createdOn: r.date_creation ?? null,
        },
        legalBasis: 'legitimate_interest',
        dataLicense: 'Etalab-2.0',
      });
    }
    return { candidates: out, billableRequests: 0 };
  },
};
