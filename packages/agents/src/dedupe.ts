import type { RawCandidate } from '@scoutra/connectors';
import { normalizeDomain } from '@scoutra/connectors';
import { normalizeName } from './text';

/**
 * Clé de déduplication multi-identifiants (étude concurrents §6.8), par ordre de fiabilité :
 * domaine normalisé → n° de registre → identifiant de la source → nom + ville + pays normalisés.
 * Pour un signal public (post), l'URL est la clé : aucun rapprochement d'identité n'est tenté.
 */
export function dedupeKey(
  c: Pick<
    RawCandidate,
    | 'websiteDomain'
    | 'registryId'
    | 'externalId'
    | 'displayName'
    | 'city'
    | 'countryCode'
    | 'sourceUrl'
    | 'attributes'
  >,
): string {
  if (c.attributes?.publicSignalOnly && c.sourceUrl) return `url:${c.sourceUrl.slice(0, 480)}`;
  const domain = normalizeDomain(c.websiteDomain);
  if (domain) return `dom:${domain}`;
  if (c.registryId) return `reg:${c.countryCode}:${c.registryId.replace(/\s+/g, '')}`;
  if (c.externalId) return `ext:${c.externalId.slice(0, 480)}`;
  const name = normalizeName(c.displayName) || c.displayName.toLowerCase().slice(0, 100);
  const city = c.city ? normalizeName(c.city) : '';
  return `name:${c.countryCode}:${name}:${city}`.slice(0, 500);
}

/** Fusionne les candidats d'une même entité (plusieurs sources) en gardant toutes les preuves. */
export function mergeCandidates(
  list: RawCandidate[],
): { key: string; primary: RawCandidate; sources: RawCandidate[] }[] {
  const groups = new Map<string, RawCandidate[]>();
  for (const c of list) {
    const k = dedupeKey(c);
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  return [...groups.entries()].map(([key, sources]) => {
    const primary = { ...sources[0]! };
    for (const s of sources.slice(1)) {
      primary.websiteDomain ??= s.websiteDomain;
      primary.registryId ??= s.registryId;
      primary.city ??= s.city;
      primary.address ??= s.address;
      primary.category ??= s.category;
      primary.phones = [...new Set([...primary.phones, ...s.phones])];
      primary.emails = [...new Set([...primary.emails, ...s.emails])];
      primary.signals = [...primary.signals, ...s.signals];
    }
    return { key, primary, sources };
  });
}
