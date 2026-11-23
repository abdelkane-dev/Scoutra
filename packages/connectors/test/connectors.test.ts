import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { TargetSpec } from '@scoutra/core';
import {
  CircuitBreaker,
  ConnectorError,
  companiesHouseConnector,
  crtshConnector,
  frRechercheEntreprisesConnector,
  googlePlacesConnector,
  normalizeDomain,
  osmConnector,
  overpassQuery,
  readWebsite,
  robotsAllows,
  selectConnectors,
  webSearchConnector,
  type ConnectorCtx,
  type HttpRequest,
} from '../src';

const fx = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');

type Route = [RegExp, number, string];
function ctxWith(routes: Route[], keys: Record<string, string> = {}, config = {}) {
  const calls: { url: string; req?: HttpRequest; internal: boolean }[] = [];
  const answer = (url: string, req: HttpRequest | undefined, internal: boolean) => {
    calls.push({ url, req, internal });
    const r = routes.find(([re]) => re.test(url));
    if (!r) return Promise.reject(new Error(`aucune réponse enregistrée pour ${url}`));
    return Promise.resolve({
      status: r[1],
      text: () => r[2],
      json: <T>() => JSON.parse(r[2]) as T,
    });
  };
  const ctx: ConnectorCtx = {
    http: { request: (u, r) => answer(u, r, false), internal: (u, r) => answer(u, r, true) },
    key: (p) => keys[p],
    config,
    now: () => new Date('2026-11-22T00:00:00Z'),
  };
  return { ctx, calls };
}

const spec: TargetSpec = {
  model: 'b2b',
  kinds: ['company'],
  summary: 'Entreprises du BTP à Dakar',
  language: 'fr',
  countries: ['SN'],
  regions: ['Dakar'],
  keywords: ['BTP', 'construction'],
  sectors: ['f_construction'],
  roles: [],
  signals: [],
  exclusions: [],
  channels: ['email', 'phone'],
};

describe('recherche web (Serper, SearXNG)', () => {
  it('Serper : clé en en-tête, domaines d’entreprise seulement, dédoublonnés', async () => {
    const { ctx, calls } = ctxWith([[/serper/, 200, fx('serper.json')]], { serper: 'k-test' });
    const c = webSearchConnector('serper');
    const [q] = c.buildQueries(spec);
    const r = await c.search(q!, ctx, spec);
    expect(calls[0]!.req?.headers?.['x-api-key']).toBe('k-test');
    expect(calls[0]!.url).not.toContain('k-test');
    expect(r.candidates.map((x) => x.websiteDomain)).toEqual([
      'btp-dakar.example.sn',
      'batir.example.sn',
    ]);
    expect(r.billableRequests).toBe(1);
  });

  it('sans clé : erreur non réessayable (le planificateur l’écarte)', async () => {
    const { ctx } = ctxWith([]);
    const c = webSearchConnector('serper');
    await expect(c.search(c.buildQueries(spec)[0]!, ctx)).rejects.toMatchObject({
      code: 'auth',
      retryable: false,
    });
  });

  it('B2C : requêtes site: sur les réseaux, résultat = titre/extrait/URL/date uniquement', async () => {
    const b2c: TargetSpec = {
      ...spec,
      model: 'b2c',
      kinds: ['person'],
      regions: ['Abidjan'],
      countries: ['CI'],
      keywords: ['plombier'],
    };
    const c = webSearchConnector('searxng');
    const qs = c.buildQueries(b2c).filter((q) => q.intent === 'public_signals');
    expect(qs.length).toBeGreaterThan(0);
    expect(qs[0]!.text).toContain('site:facebook.com');
    const { ctx, calls } = ctxWith(
      [[/searx/, 200, fx('searxng-social.json')]],
      {},
      { searxngUrl: 'http://searxng:8080' },
    );
    const r = await c.search(qs[0]!, ctx, b2c);
    expect(calls[0]!.internal).toBe(true);
    expect(r.candidates).toHaveLength(2);
    const p = r.candidates[0]!;
    expect(p).toMatchObject({
      kind: 'person',
      emails: [],
      phones: [],
      attributes: { platform: 'facebook', publicSignalOnly: true },
    });
    expect(p.signals[0]!.key).toBe('public_request');
  });

  it('SearXNG non configuré : indisponible', async () => {
    const c = webSearchConnector('searxng');
    await expect(c.search(c.buildQueries(spec)[0]!, ctxWith([]).ctx)).rejects.toBeInstanceOf(
      ConnectorError,
    );
  });
});

describe('OpenStreetMap', () => {
  it('requête Overpass échappée ; étiquette OSM reconnue', () => {
    const q = overpassQuery({
      text: 'restaurant',
      country: 'SN',
      city: 'Da"kar',
      intent: 'entities',
      limit: 10,
    });
    expect(q).toContain('["amenity"="restaurant"]');
    expect(q).toContain('Da\\"kar');
    const q2 = overpassQuery({ text: 'a.b(c)', country: 'SN', intent: 'entities', limit: 10 });
    expect(q2).toContain('a\\\\.b\\\\(c\\\\)');
  });
  it('résultats : nom obligatoire, attribution ODbL, signal « pas de site »', async () => {
    const { ctx } = ctxWith([[/overpass/, 200, fx('overpass.json')]]);
    const r = await osmConnector.search(osmConnector.buildQueries(spec)[0]!, ctx);
    expect(r.candidates).toHaveLength(2);
    expect(r.candidates[0]).toMatchObject({
      websiteDomain: 'lebaobab.example.sn',
      dataLicense: 'ODbL',
      externalId: 'osm:node/101',
    });
    expect(r.candidates[1]!.signals[0]!.key).toBe('no_website');
  });
});

describe('Google Places (New)', () => {
  it('POST searchText avec masque de champs ; fermés écartés', async () => {
    const { ctx, calls } = ctxWith([[/places.googleapis.com/, 200, fx('places.json')]], {
      google_places: 'g',
    });
    const r = await googlePlacesConnector.search(googlePlacesConnector.buildQueries(spec)[0]!, ctx);
    expect(calls[0]!.req?.method).toBe('POST');
    expect(calls[0]!.req?.headers?.['x-goog-fieldmask']).toContain('places.websiteUri');
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0]).toMatchObject({
      externalId: 'gplace:ChIJ_fictif_1',
      phones: ['+221 33 900 00 00'],
    });
  });
  it('429 : erreur réessayable', async () => {
    const { ctx } = ctxWith([[/places/, 429, '{}']], { google_places: 'g' });
    await expect(
      googlePlacesConnector.search(googlePlacesConnector.buildQueries(spec)[0]!, ctx),
    ).rejects.toMatchObject({ retryable: true });
  });
});

describe('registres publics', () => {
  it('Companies House : GB seulement, signal entreprise récente', async () => {
    expect(companiesHouseConnector.buildQueries(spec)).toHaveLength(0);
    const uk: TargetSpec = {
      ...spec,
      countries: ['GB'],
      regions: [],
      signals: [{ key: 'new_company', required: false }],
    };
    const qs = companiesHouseConnector.buildQueries(uk);
    const { ctx, calls } = ctxWith([[/company-information/, 200, fx('companies-house.json')]], {
      companies_house: 'ch',
    });
    const r = await companiesHouseConnector.search(qs[0]!, ctx);
    expect(calls[0]!.url).toContain('incorporated_from=2026-05-26');
    expect(calls[0]!.req?.headers?.authorization).toMatch(/^Basic /);
    expect(r.candidates[0]!.signals.map((s) => s.key)).toEqual(['new_company']);
    expect(r.candidates[1]!.signals).toEqual([]);
  });
  it('France : entrepreneurs individuels et non diffusibles exclus ; associations typées', async () => {
    const fr: TargetSpec = { ...spec, countries: ['FR'], regions: ['Lyon'] };
    const { ctx } = ctxWith([[/recherche-entreprises/, 200, fx('recherche-entreprises.json')]]);
    const r = await frRechercheEntreprisesConnector.search(
      frRechercheEntreprisesConnector.buildQueries(fr)[0]!,
      ctx,
    );
    expect(r.candidates.map((c) => c.registryId)).toEqual(['000000001', '000000004']);
    expect(r.candidates[1]!.kind).toBe('nonprofit');
  });
});

describe('crt.sh (nouveaux domaines)', () => {
  it('domaines récents seulement, sans jokers, domaine de base', async () => {
    const s = { ...spec, keywords: ['bati'] };
    const { ctx } = ctxWith([[/crt\.sh/, 200, fx('crtsh.json')]]);
    const r = await crtshConnector.search(crtshConnector.buildQueries(s)[0]!, ctx);
    expect(r.candidates.map((c) => c.websiteDomain).sort()).toEqual([
      'bati-store.sn',
      'batiplus.sn',
    ]);
    expect(r.candidates[0]!.signals[0]!.key).toBe('new_domain');
  });
});

describe('lecture de site web', () => {
  it('robots.txt respecté', () => {
    expect(robotsAllows('User-agent: *\nDisallow: /contact', '/contact')).toBe(false);
    expect(robotsAllows('User-agent: *\nDisallow: /contact', '/')).toBe(true);
    expect(robotsAllows('User-agent: autre\nDisallow: /', '/')).toBe(true);
  });
  it('emails du domaine seulement, téléphone, signaux, texte sans scripts', async () => {
    const { ctx } = ctxWith([
      [/robots\.txt/, 200, 'User-agent: *\nDisallow: /mentions-legales'],
      [/batir\.example\.sn\/$/, 200, fx('site-home.html')],
      [/./, 404, ''],
    ]);
    const f = await readWebsite('https://www.batir.example.sn', ctx);
    expect(f).toMatchObject({
      reachable: true,
      title: 'Bâtir SARL',
      emails: ['contact@batir.example.sn'],
      phones: ['+221338000001'],
    });
    expect(f!.signals.map((s) => s.key).sort()).toEqual(['hiring', 'outdated_website']);
    expect(f!.pages[0]!.text).not.toContain('var x');
    expect(await readWebsite('facebook.com', ctx)).toBeNull();
  });
});

describe('sélection des sources (mode dégradé, garde-fou, disjoncteur)', () => {
  const base = { spec, mode: 'saas' as const, config: {}, costMode: 'normal' as const };
  it('sans aucune clé : sources gratuites seulement, mode dégradé signalé', () => {
    const s = selectConnectors({ ...base, hasKey: () => false });
    expect(s.selected.map((c) => c.manifest.code)).toEqual(['osm_overpass', 'crtsh']);
    expect(s.degraded).toBe(true);
    expect(s.excluded).toContainEqual({ code: 'google_places', reason: 'missing_key' });
    expect(s.excluded).toContainEqual({ code: 'search_searxng', reason: 'missing_service' });
  });
  it('un seul moteur web ; économie (70 %) écarte Places ; gratuit seul à 100 %', () => {
    const all = selectConnectors({
      ...base,
      hasKey: () => true,
      config: { searxngUrl: 'http://s' },
    });
    expect(all.selected.filter((c) => c.manifest.code.startsWith('search_'))).toHaveLength(1);
    expect(all.degraded).toBe(false);
    const eco = selectConnectors({
      ...base,
      hasKey: () => true,
      costMode: 'economy',
      searchProviders: ['serper'],
    });
    expect(eco.selected.map((c) => c.manifest.code)).toContain('search_serper');
    expect(eco.selected.map((c) => c.manifest.code)).not.toContain('google_places');
    const free = selectConnectors({ ...base, hasKey: () => true, costMode: 'free_only' });
    expect(free.selected.every((c) => c.manifest.costTier === 'free')).toBe(true);
  });
  it('disjoncteur ouvert : source écartée puis réessayée après le délai', () => {
    let t = 0;
    const b = new CircuitBreaker({ threshold: 2, windowMs: 1000, cooldownMs: 5000 }, () => t);
    b.failure('osm_overpass');
    b.failure('osm_overpass');
    const s = selectConnectors({ ...base, hasKey: () => false, breaker: b });
    expect(s.excluded).toContainEqual({ code: 'osm_overpass', reason: 'circuit_open' });
    t = 6000;
    expect(b.state('osm_overpass')).toBe('half_open');
    b.success('osm_overpass');
    expect(b.state('osm_overpass')).toBe('closed');
  });
  it('playbook : seules ses sources sont retenues', () => {
    const s = selectConnectors({
      ...base,
      hasKey: () => true,
      playbookConnectors: ['osm_overpass'],
    });
    expect(s.selected.map((c) => c.manifest.code)).toEqual(['osm_overpass']);
  });
});

describe('normalisation de domaine (propriété)', () => {
  it('idempotente et sans www.', () => {
    fc.assert(
      fc.property(fc.domain(), (d) => {
        const n = normalizeDomain(`https://www.${d}/x`);
        if (n) {
          expect(normalizeDomain(n)).toBe(n);
          expect(n.startsWith('www.')).toBe(false);
        }
      }),
    );
  });
});

describe('revue étape 2, constat 2 : analyse HTML linéaire', async () => {
  const { parseHtml, MAX_HTML_BYTES } = await import('../src');
  it('pages piégées de 3 Mo analysées en temps borné', () => {
    const traps = [
      '<script>' + 'a'.repeat(3_000_000),
      '<' + 'meta name="description" content="'.repeat(80_000),
      'x@'.repeat(1_500_000),
      '<a href="' + 'tel:1'.repeat(600_000),
      '<!--' + '-'.repeat(3_000_000),
      '©' + ' 2020-'.repeat(500_000),
    ];
    for (const html of traps) {
      const t0 = performance.now();
      const p = parseHtml(html);
      expect(performance.now() - t0).toBeLessThan(1500);
      expect(p.text.length).toBeLessThanOrEqual(MAX_HTML_BYTES);
    }
  });
  it('titre, description, texte sans script, liens tel/mailto', () => {
    const p = parseHtml(
      '<title>A &amp; B</title><meta name="description" content="Desc"><script>x=1</script><p>Bonjour <b>monde</b></p><a href="tel:+221 33">t</a><a href="mailto:a@b.sn">m</a>',
    );
    expect(p).toMatchObject({ title: 'A & B', description: 'Desc', text: 'Bonjour monde t m' });
    expect(p.hrefs).toEqual(['tel:+221 33', 'mailto:a@b.sn']);
  });
});

describe('constat 8 (étape 2) : aucune requête sur un nom de personne', () => {
  it('mots-clés ressemblant à un nom de personne ou à un pseudo écartés de toutes les sources', () => {
    const s = {
      ...spec,
      model: 'b2c' as const,
      kinds: ['person' as const],
      keywords: ['Moussa Diallo', '@pseudo', 'plombier'],
    };
    for (const c of [webSearchConnector('searxng'), osmConnector, crtshConnector]) {
      const texts = c
        .buildQueries(s)
        .map((q) => q.text)
        .join(' | ');
      expect(texts).not.toContain('Moussa');
      expect(texts).not.toContain('@pseudo');
    }
  });
});

describe('constat 10 (étape 2) : robots.txt conforme RFC 9309', async () => {
  const { robotsPolicy } = await import('../src');
  it('5xx / injoignable = tout interdit ; 4xx = permis ; Allow le plus long l’emporte ; jokers', () => {
    expect(robotsPolicy('a.sn', { status: 503, body: '' })('/')).toBe(false);
    expect(robotsPolicy('a.sn', 'unreachable')('/contact')).toBe(false);
    expect(robotsPolicy('a.sn', { status: 404, body: '' })('/contact')).toBe(true);
    const p = robotsPolicy('a.sn', {
      status: 200,
      body: 'User-agent: *\nDisallow: /\nAllow: /contact\nDisallow: /*.pdf$',
    });
    expect(p('/contact')).toBe(true);
    expect(p('/')).toBe(false);
    const q = robotsPolicy('a.sn', {
      status: 200,
      body: 'User-agent: ScoutraBot\nDisallow: /prive\n\nUser-agent: *\nDisallow: /',
    });
    expect(q('/')).toBe(true);
    expect(q('/prive/x')).toBe(false);
  });
  it('robots.txt en erreur serveur : aucune page lue', async () => {
    const { ctx, calls } = ctxWith([
      [/robots\.txt/, 500, ''],
      [/./, 200, '<p>contact@x.sn</p>'],
    ]);
    const f = await readWebsite('x.sn', ctx);
    expect(f!.reachable).toBe(false);
    expect(calls.filter((c) => !c.url.endsWith('/robots.txt'))).toHaveLength(0);
  });
});
