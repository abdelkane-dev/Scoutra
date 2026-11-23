import { Parser } from 'htmlparser2';
import type { CandidateSignal, ConnectorCtx, ConnectorManifest } from '../types';
import { clip, isCompanyDomain, normalizeDomain } from '../util';

export const websiteManifest: ConnectorManifest = {
  code: 'website',
  name: { fr: 'Site web de l’entité', en: 'Entity website' },
  version: '1',
  role: 'enrich',
  prospectKinds: ['company', 'nonprofit', 'public_buyer', 'creator'],
  models: 'all',
  countries: 'WORLD',
  legalStatus: 'public_web',
  defaultLegalBasis: 'legitimate_interest',
  costMicroUsdPerRequest: 300,
  costTier: 'free',
  requiresKey: null,
  rateLimit: { perSecond: 1 },
  availableIn: ['saas', 'license'],
  signals: ['hiring', 'outdated_website', 'no_website'],
  legalNotes:
    'Pages publiques uniquement, robots.txt respecté, 4 pages maximum (accueil, contact, à propos, mentions légales), aucune authentification contournée.',
};

export interface WebsiteFacts {
  domain: string;
  reachable: boolean;
  robotsDisallowed: boolean;
  https: boolean;
  title?: string;
  description?: string;
  /** Texte nettoyé par page (borné), DONNÉE externe non fiable pour les agents IA. */
  pages: { url: string; text: string }[];
  emails: string[];
  phones: string[];
  socialLinks: string[];
  signals: CandidateSignal[];
  fetchedPages: number;
}

const PATHS = ['/', '/contact', '/a-propos', '/mentions-legales', '/about', '/contact-us'];
const MAX_TEXT = 6000;

/** Règles robots.txt (User-agent: * ou ScoutraBot), sous-ensemble prudent : Disallow seulement. */
export function robotsAllows(robots: string, path: string): boolean {
  let applies = false;
  const disallow: string[] = [];
  for (const line of robots.split(/\r?\n/)) {
    const [k, ...rest] = line.split(':');
    const key = k?.trim().toLowerCase();
    const val = rest.join(':').trim();
    if (key === 'user-agent') applies = val === '*' || /scoutrabot/i.test(val);
    else if (applies && key === 'disallow' && val) disallow.push(val);
  }
  return !disallow.some((d) => path.startsWith(d));
}

/** Taille maximale de HTML analysée par page (revue étape 2, constat 2). */
export const MAX_HTML_BYTES = 300 * 1024;

export interface ParsedHtml {
  text: string;
  title?: string;
  description?: string;
  hrefs: string[];
  /** Contenu des scripts JSON-LD (données structurées), borné. */
  ldJson: string;
}

/**
 * Analyse HTML LINÉAIRE (htmlparser2, automate à états) : aucune expression régulière sur le
 * balisage, entrée tronquée à 300 Ko, sorties bornées. Une page piégée ne peut plus geler le
 * worker (revue étape 2, constat 2).
 */
export function parseHtml(rawHtml: string): ParsedHtml {
  const html = rawHtml.length > MAX_HTML_BYTES ? rawHtml.slice(0, MAX_HTML_BYTES) : rawHtml;
  const text: string[] = [];
  let textLen = 0;
  const hrefs: string[] = [];
  let title = '';
  let description: string | undefined;
  let ld = '';
  const stack: string[] = [];
  let ldDepth = false;
  const parser = new Parser(
    {
      onopentag(name, attrs) {
        stack.push(name);
        if (name === 'a' && attrs.href && hrefs.length < 500) hrefs.push(attrs.href.slice(0, 300));
        if (name === 'meta' && attrs.name?.toLowerCase() === 'description' && attrs.content)
          description ??= attrs.content.slice(0, 1000);
        if (name === 'script') ldDepth = (attrs.type ?? '').toLowerCase() === 'application/ld+json';
      },
      onclosetag(name) {
        const k = stack.lastIndexOf(name);
        if (k >= 0) stack.length = k;
        if (name === 'script') ldDepth = false;
      },
      ontext(data) {
        const top = stack[stack.length - 1];
        if (top === 'script') {
          if (ldDepth && ld.length < 20_000) ld += data.slice(0, 20_000 - ld.length);
          return;
        }
        if (top === 'style' || top === 'noscript' || top === 'template') return;
        if (stack.includes('title')) {
          if (title.length < 300) title += data;
          return;
        }
        if (textLen < MAX_TEXT * 4) {
          text.push(data);
          textLen += data.length;
        }
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();
  return {
    text: text.join(' ').replace(/\s+/g, ' ').trim(),
    title: clip(title, 200),
    description: clip(description, 300),
    hrefs,
    ldJson: ld,
  };
}

export function htmlToText(html: string): string {
  return parseHtml(html).text;
}

const EMAIL_RE = /[a-z0-9._%+-]{1,64}@[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63}){0,5}\.[a-z]{2,24}/gi;
const BAD_EMAIL = /\.(png|jpe?g|gif|webp|svg)$|@example\.(com|org)$|sentry|wixpress|@2x/i;

/** Adresses du domaine de l'entité, depuis le TEXTE extrait et les liens mailto:. */
export function extractEmails(parsed: ParsedHtml, domain: string): string[] {
  const found = new Set<string>();
  const sources = [
    parsed.text.slice(0, 100_000),
    ...parsed.hrefs.filter((h) => /^mailto:/i.test(h)).map((h) => h.slice(7).split('?')[0]!),
  ];
  for (const src of sources)
    for (const m of src.match(EMAIL_RE) ?? []) {
      const e = m.toLowerCase();
      if (BAD_EMAIL.test(e)) continue;
      // On ne garde que les adresses du domaine de l'entité (publiées par elle-même).
      if (e.endsWith(`@${domain}`) || e.endsWith(`.${domain}`)) found.add(e);
    }
  return [...found].slice(0, 10);
}

export function extractPhones(parsed: ParsedHtml): string[] {
  const out = new Set<string>();
  for (const h of parsed.hrefs) {
    if (!/^tel:/i.test(h)) continue;
    const v = h.slice(4).trim();
    if (v.length >= 6 && v.length <= 25 && /^[+0-9 ().-]+$/.test(v)) out.add(v);
  }
  return [...out].slice(0, 5);
}

const SOCIAL_HOSTS = [
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'tiktok.com',
  'x.com',
  'twitter.com',
  'youtube.com',
];
export function extractSocialLinks(parsed: ParsedHtml): string[] {
  const out = new Set<string>();
  for (const h of parsed.hrefs) {
    let u: URL;
    try {
      u = new URL(h);
    } catch {
      continue;
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') continue;
    const host = u.hostname.replace(/^www\./, '');
    if (SOCIAL_HOSTS.includes(host) && u.pathname.length > 1) out.add(u.toString().slice(0, 200));
  }
  return [...out].slice(0, 8);
}

/**
 * Lit le site d'une entité (pages publiques, robots.txt respecté) via safeFetch, ou via
 * Crawl4AI si configuré (l'URL est d'abord validée comme publique). Ne lève pas d'erreur
 * pour un site injoignable : `reachable=false`.
 */
export async function readWebsite(
  rawDomain: string,
  ctx: ConnectorCtx,
): Promise<WebsiteFacts | null> {
  const domain = normalizeDomain(rawDomain);
  if (!domain || !isCompanyDomain(domain)) return null;
  const facts: WebsiteFacts = {
    domain,
    reachable: false,
    robotsDisallowed: false,
    https: true,
    pages: [],
    emails: [],
    phones: [],
    socialLinks: [],
    signals: [],
    fetchedPages: 0,
  };
  let robots = '';
  try {
    const r = await ctx.http.request(`https://${domain}/robots.txt`, { timeoutMs: 8000 });
    if (r.status === 200) robots = r.text().slice(0, 50_000);
  } catch {
    /* pas de robots.txt lisible : on continue prudemment */
  }
  const emails = new Set<string>();
  const phones = new Set<string>();
  const social = new Set<string>();
  for (const path of PATHS) {
    if (facts.fetchedPages >= 4) break;
    if (!robotsAllows(robots, path)) {
      if (path === '/') facts.robotsDisallowed = true;
      continue;
    }
    let html = '';
    try {
      const res = await ctx.http.request(`https://${domain}${path}`, { timeoutMs: 10_000 });
      facts.fetchedPages++;
      if (res.status !== 200) continue;
      html = res.text();
    } catch {
      if (path === '/') {
        try {
          const res = await ctx.http.request(`http://${domain}/`, { timeoutMs: 10_000 });
          facts.fetchedPages++;
          if (res.status === 200) {
            html = res.text();
            facts.https = false;
          }
        } catch {
          break;
        }
      }
      if (!html) continue;
    }
    facts.reachable = true;
    const parsed = parseHtml(html);
    if (path === '/') {
      facts.title = parsed.title;
      facts.description = parsed.description;
      const years = [
        ...parsed.text
          .slice(-20_000)
          .matchAll(/(?:©|copyright)\s{0,3}(?:\d{4}\s{0,3}[-–]\s{0,3})?(20\d{2})/gi),
      ].map((m) => Number(m[1]));
      const year = years.length ? Math.max(...years) : undefined;
      if (year && ctx.now().getUTCFullYear() - year >= 3)
        facts.signals.push({
          key: 'outdated_website',
          snippet: `© ${year}`,
          url: `https://${domain}/`,
        });
      if (
        /"@type"\s{0,5}:\s{0,5}"JobPosting"/.test(parsed.ldJson) ||
        /recrut|careers|jobs|emploi/i.test(parsed.text.slice(0, 50_000)) ||
        parsed.hrefs.some((h) => /recrut|careers|jobs|emploi/i.test(h))
      )
        facts.signals.push({ key: 'hiring', url: `https://${domain}/` });
    }
    for (const e of extractEmails(parsed, domain)) emails.add(e);
    for (const p of extractPhones(parsed)) phones.add(p);
    for (const s of extractSocialLinks(parsed)) social.add(s);
    facts.pages.push({ url: `https://${domain}${path}`, text: parsed.text.slice(0, MAX_TEXT) });
  }
  if (!facts.https) facts.signals.push({ key: 'outdated_website', snippet: 'HTTP sans TLS' });
  facts.emails = [...emails];
  facts.phones = [...phones];
  facts.socialLinks = [...social];
  return facts;
}
