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

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#64;|&commat;/g, '@')
    .replace(/\s+/g, ' ')
    .trim();
}

const EMAIL_RE = /[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,24}/gi;
const BAD_EMAIL = /\.(png|jpe?g|gif|webp|svg)$|@example\.(com|org)$|sentry|wixpress|@2x/i;

export function extractEmails(html: string, domain: string): string[] {
  const found = new Set<string>();
  for (const m of html.match(EMAIL_RE) ?? []) {
    const e = m.toLowerCase();
    if (BAD_EMAIL.test(e)) continue;
    // On ne garde que les adresses du domaine de l'entité (publiées par elle-même).
    if (e.endsWith(`@${domain}`) || e.endsWith(`.${domain}`)) found.add(e);
  }
  return [...found].slice(0, 10);
}

export function extractPhones(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href=["']tel:([+0-9 ().-]{6,25})["']/gi)) out.add(m[1]!.trim());
  return [...out].slice(0, 5);
}

export function extractSocialLinks(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(
    /href=["'](https?:\/\/(?:www\.)?(?:facebook|instagram|linkedin|tiktok|x|twitter|youtube)\.com\/[^"'\s]{1,200})["']/gi,
  ))
    out.add(m[1]!);
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
    if (path === '/') {
      facts.title = clip(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1], 200);
      facts.description = clip(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i.exec(html)?.[1],
        300,
      );
      const years = [
        ...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/gi),
      ].map((m) => Number(m[1]));
      const year = years.length ? Math.max(...years) : undefined;
      if (year && ctx.now().getUTCFullYear() - year >= 3)
        facts.signals.push({
          key: 'outdated_website',
          snippet: `© ${year}`,
          url: `https://${domain}/`,
        });
      if (
        /"@type"\s*:\s*"JobPosting"/.test(html) ||
        /recrut|careers|jobs|emploi/i.test(html.slice(0, 200_000))
      )
        facts.signals.push({ key: 'hiring', url: `https://${domain}/` });
    }
    for (const e of extractEmails(html, domain)) emails.add(e);
    for (const p of extractPhones(html)) phones.add(p);
    for (const s of extractSocialLinks(html)) social.add(s);
    facts.pages.push({
      url: `https://${domain}${path}`,
      text: htmlToText(html).slice(0, MAX_TEXT),
    });
  }
  if (!facts.https) facts.signals.push({ key: 'outdated_website', snippet: 'HTTP sans TLS' });
  facts.emails = [...emails];
  facts.phones = [...phones];
  facts.socialLinks = [...social];
  return facts;
}
