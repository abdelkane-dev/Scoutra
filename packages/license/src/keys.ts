import { z } from 'zod';
import type { PublicKeyring } from './token';

/**
 * Clés PUBLIQUES embarquées (kid → clé Ed25519 brute base64url).
 * Ajouter ici la clé publique produite par `pnpm license keygen` (la clé privée reste
 * hors ligne, jamais dans le dépôt). Plusieurs kid peuvent coexister (rotation).
 * Vide tant que la première paire de production n'a pas été générée.
 */
export const EMBEDDED_PUBLIC_KEYS: PublicKeyring = Object.freeze({});

const envKeysSchema = z.record(
  z.string().regex(/^[A-Za-z0-9._-]{1,32}$/),
  z.string().regex(/^[A-Za-z0-9_-]{43}$/),
);

/**
 * Trousseau effectif : clés embarquées + `SCOUTRA_LICENSE_PUBLIC_KEYS` (JSON kid→clé),
 * utile pour les tests et les installations de recette. Une clé embarquée n'est jamais
 * remplacée par l'environnement.
 */
export function loadPublicKeyring(
  envValue: string | undefined,
  opts: { allowEnvKeys?: boolean } = {},
): PublicKeyring {
  // En production sous licence, le client contrôle l'environnement : ses propres clés ne
  // doivent pas pouvoir valider ses propres licences (revue étape 1, constat 10).
  if (opts.allowEnvKeys === false) return EMBEDDED_PUBLIC_KEYS;
  const extra = envValue ? envKeysSchema.parse(JSON.parse(envValue)) : {};
  return Object.freeze({ ...extra, ...EMBEDDED_PUBLIC_KEYS });
}
