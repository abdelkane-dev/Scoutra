import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Empreinte HMAC-SHA256 avec une clé dédiée (`SCOUTRA_HASH_KEY`) : recherche exacte,
 * dédoublonnage et liste d'opposition sans stocker la valeur en clair.
 * La valeur doit être normalisée AVANT (ex. email en minuscules, sans espaces).
 */
export function keyedHash(value: string, hashKey: Buffer, scope: string): string {
  if (hashKey.length < 32) throw new Error('Clé de hachage trop courte');
  return createHmac('sha256', hashKey).update(`${scope}\u0000${value}`, 'utf8').digest('hex');
}

/** Normalisation minimale des valeurs de contact avant hachage. */
export function normalizeContactValue(channel: string, value: string): string {
  const v = value.trim().normalize('NFKC');
  if (channel === 'email') return v.toLowerCase();
  if (channel === 'phone' || channel === 'whatsapp') return v.replace(/[^\d+]/g, '');
  return v;
}

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Jeton aléatoire URL-safe (invitations, liens à usage unique). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
