import { AppError } from '../errors';
import { isIpLiteral, isPublicIp } from './ip';

export interface UrlPolicy {
  /** Ports autorisés. Par défaut 80 et 443 uniquement. */
  allowedPorts?: readonly number[];
}

const DEFAULT_PORTS = [80, 443] as const;

const BLOCKED_SUFFIXES = [
  '.localhost',
  '.local',
  '.localdomain',
  '.internal',
  '.intranet',
  '.lan',
  '.home.arpa',
  '.corp',
];
const BLOCKED_HOSTS = new Set(['localhost', 'metadata', 'metadata.google.internal']);

function block(reason: string): never {
  throw new AppError('blocked_url', `URL refusée : ${reason}`);
}

/**
 * Valide une URL fournie par un utilisateur, un connecteur ou un LLM AVANT toute requête.
 * Ne résout pas le DNS : la vérification des adresses résolues est faite au moment de la
 * connexion par `safeFetch` (protection contre le DNS rebinding).
 */
export function assertSafeUrl(input: string | URL, policy: UrlPolicy = {}): URL {
  let url: URL;
  try {
    // L'analyseur WHATWG normalise les IP encodées (2130706433, 0x7f.1, 0177.0.0.1 → 127.0.0.1).
    url = new URL(input);
  } catch {
    block('URL invalide');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') block('schéma non autorisé');
  if (url.username || url.password) block('identifiants dans l’URL');

  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  const allowedPorts = policy.allowedPorts ?? DEFAULT_PORTS;
  if (!allowedPorts.includes(port)) block('port non autorisé');

  let host = url.hostname.toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (!host) block('hôte vide');

  if (isIpLiteral(host)) {
    if (!isPublicIp(host)) block('adresse IP non publique');
    return url;
  }

  if (BLOCKED_HOSTS.has(host) || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    block('nom d’hôte interne');
  }
  // Un nom sans point (ex. « postgres », « reacher ») désigne un service interne (DNS Docker).
  if (!host.includes('.')) block('nom d’hôte sans domaine');
  return url;
}
