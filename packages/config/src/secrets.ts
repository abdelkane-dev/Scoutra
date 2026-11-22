/**
 * Détection des secrets faibles : le démarrage est REFUSÉ si un secret manque, est trop
 * court, a trop peu d'entropie ou ressemble à une valeur d'exemple.
 */
const PLACEHOLDER_PATTERNS = [
  /change.?me/i,
  /changez.?moi/i,
  /^(secret|password|motdepasse|admin|test|example|default|todo)$/i,
  /your[-_ ]?(secret|key|password)/i,
  /^x+$/i,
  /^0+$/,
  /replace/i,
  /remplacer/i,
  /<.*>/,
];

export interface SecretRule {
  minLength: number;
  minDistinctChars?: number;
}

export function secretWeakness(value: string | undefined, rule: SecretRule): string | null {
  if (!value) return 'manquant';
  if (value.length < rule.minLength) return `trop court (minimum ${rule.minLength} caractères)`;
  if (PLACEHOLDER_PATTERNS.some((p) => p.test(value))) return 'valeur d’exemple';
  if (new Set(value).size < (rule.minDistinctChars ?? 10)) return 'entropie insuffisante';
  return null;
}

/** Clé brute de 32 octets encodée en base64 (clés maître et de hachage). */
export function base64KeyWeakness(value: string | undefined): string | null {
  if (!value) return 'manquant';
  const buf = Buffer.from(value, 'base64');
  if (buf.length !== 32 || buf.toString('base64') !== value)
    return 'doit être 32 octets en base64 (openssl rand -base64 32)';
  if (new Set(buf).size < 16) return 'entropie insuffisante';
  return null;
}
