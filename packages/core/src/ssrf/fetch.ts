import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import type { LookupAddress } from 'node:dns';
import type { LookupFunction } from 'node:net';
import { AppError } from '../errors';
import { isPublicIp } from './ip';
import { assertSafeUrl, type UrlPolicy } from './url';

export type Resolver = (hostname: string) => Promise<LookupAddress[]>;

export interface SafeFetchOptions extends UrlPolicy {
  method?: 'GET' | 'HEAD' | 'POST';
  /** Corps (POST uniquement, API JSON des fournisseurs). Les redirections sont alors refusées. */
  body?: string;
  headers?: Record<string, string>;
  maxRedirects?: number;
  timeoutMs?: number;
  /** Durée maximale de l'ensemble (redirections comprises). Défaut : 30 s. */
  totalTimeoutMs?: number;
  maxBytes?: number;
  /** Résolveur DNS (injectable pour les tests). */
  resolver?: Resolver;
  /**
   * Politique d'adresse appliquée à CHAQUE adresse résolue au moment de la connexion.
   * Par défaut `isPublicIp`. Ne la remplacer que dans des tests.
   */
  addressPolicy?: (ip: string) => boolean;
  signal?: AbortSignal;
}

export interface SafeResponse {
  status: number;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

const defaultResolver: Resolver = (hostname) =>
  dns.promises.lookup(hostname, { all: true, verbatim: true });

function guardedLookup(resolver: Resolver, policy: (ip: string) => boolean): LookupFunction {
  return (hostname, options, callback) => {
    resolver(hostname)
      .then((addresses) => {
        const family = typeof options === 'object' ? options.family : undefined;
        const usable = addresses.filter((a) => !family || a.family === family);
        if (usable.length === 0) {
          callback(new AppError('blocked_url', 'Aucune adresse résolue'), '', 4);
          return;
        }
        // Si UNE seule adresse est interne, on refuse tout (pas de tirage au sort).
        if (usable.some((a) => !policy(a.address))) {
          callback(
            new AppError('blocked_url', 'URL refusée : résout vers une adresse interne'),
            '',
            4,
          );
          return;
        }
        if (typeof options === 'object' && options.all) {
          (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, usable);
        } else {
          const first = usable[0]!;
          callback(null, first.address, first.family);
        }
      })
      .catch((err: unknown) => callback(err as NodeJS.ErrnoException, '', 4));
  };
}

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
/** En-têtes jamais transmis à une autre origine lors d'une redirection. */
const CREDENTIAL_HEADERS = [
  'authorization',
  'cookie',
  'proxy-authorization',
  'x-api-key',
  'api-key',
];

function stripCredentials(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) return headers;
  return Object.fromEntries(
    Object.entries(headers).filter(([k]) => {
      const key = k.toLowerCase();
      return !CREDENTIAL_HEADERS.includes(key) && !key.includes('token') && !key.includes('secret');
    }),
  );
}

function requestOnce(
  url: URL,
  opts: Required<Pick<SafeFetchOptions, 'timeoutMs' | 'maxBytes'>> & SafeFetchOptions,
): Promise<SafeResponse> {
  const lib = url.protocol === 'https:' ? https : http;
  const lookup = guardedLookup(opts.resolver ?? defaultResolver, opts.addressPolicy ?? isPublicIp);
  return new Promise<SafeResponse>((resolve, reject) => {
    const req = lib.request(
      url,
      {
        method: opts.method ?? 'GET',
        headers: { 'user-agent': 'ScoutraBot/0.1', ...opts.headers },
        lookup,
        timeout: opts.timeoutMs,
        signal: opts.signal,
        agent: false, // pas de réutilisation de socket entre hôtes validés différemment
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let aborted = false;
        const tooBig = () => {
          aborted = true;
          const err = new AppError('blocked_url', 'Réponse trop volumineuse');
          req.destroy(err);
          reject(err);
        };
        const declared = Number(res.headers['content-length'] ?? 0);
        if (declared > opts.maxBytes) {
          tooBig();
          return;
        }
        res.on('data', (chunk: Buffer) => {
          if (aborted) return;
          size += chunk.length;
          if (size > opts.maxBytes) {
            tooBig();
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          if (aborted) return;
          resolve({
            status: res.statusCode ?? 0,
            url: url.toString(),
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new AppError('blocked_url', 'Délai dépassé')));
    req.on('error', reject);
    req.end(opts.method === 'POST' && opts.body !== undefined ? opts.body : undefined);
  });
}

/**
 * Requête HTTP sortante protégée contre la SSRF :
 * - URL validée (schéma, port, identifiants, hôte interne, IP encodée) ;
 * - adresses résolues vérifiées au moment de la connexion (anti DNS rebinding) ;
 * - chaque redirection est revalidée, nombre limité ;
 * - taille et durée maximales.
 */
export async function safeFetch(
  input: string,
  options: SafeFetchOptions = {},
): Promise<SafeResponse> {
  const deadline = AbortSignal.timeout(options.totalTimeoutMs ?? 30_000);
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
  const opts = { timeoutMs: 10_000, maxBytes: 5 * 1024 * 1024, ...options, signal };
  const maxRedirects = options.maxRedirects ?? 5;
  let url = assertSafeUrl(input, opts);
  const origin = url.origin;
  try {
    for (let hop = 0; ; hop++) {
      const res = await requestOnce(url, opts);
      if (!REDIRECT_CODES.has(res.status)) return res;
      const location = res.headers.location;
      if (!location) return res;
      if (opts.method === 'POST') throw new AppError('blocked_url', 'Redirection refusée (POST)');
      if (hop >= maxRedirects) throw new AppError('blocked_url', 'Trop de redirections');
      url = assertSafeUrl(new URL(location, url), opts);
      // Les identifiants ne suivent jamais une redirection vers une autre origine.
      if (url.origin !== origin) opts.headers = stripCredentials(opts.headers);
    }
  } catch (err) {
    if (deadline.aborted) throw new AppError('blocked_url', 'Délai global dépassé');
    throw err;
  }
}
