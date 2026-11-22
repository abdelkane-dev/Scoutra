import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import { z } from 'zod';
import { isoCountrySchema } from '@scoutra/core';

/**
 * Format de licence Scoutra (v1) :
 *   base64url(JSON du contenu) "." base64url(signature Ed25519)
 * La signature couvre `DOMAIN || segment1` (séparation de domaine). Pas d'en-tête « alg » :
 * l'algorithme est fixé (Ed25519), ce qui exclut les attaques type JWT `alg=none`.
 * Le `kid` (dans le contenu signé) choisit la clé publique : rotation sans casser les
 * licences déjà émises.
 */

export const LICENSE_FEATURES = ['research', 'pipeline', 'byo_keys'] as const;
export type LicenseFeature = (typeof LICENSE_FEATURES)[number];

const DOMAIN = Buffer.from('scoutra-license-v1.', 'utf8');
const MAX_TOKEN_LENGTH = 4096;

export const licensePayloadSchema = z
  .object({
    v: z.literal(1),
    lid: z.string().regex(/^lic_[A-Za-z0-9]{8,40}$/),
    org: z.string().min(1).max(200),
    orgId: z.uuid(),
    country: isoCountrySchema,
    maxUsers: z.number().int().min(1).max(100_000),
    features: z.array(z.enum(LICENSE_FEATURES)).max(LICENSE_FEATURES.length),
    iat: z.number().int().nonnegative(),
    nbf: z.number().int().nonnegative(),
    exp: z.number().int().positive(),
    graceDays: z.number().int().min(0).max(90),
    kid: z.string().regex(/^[A-Za-z0-9._-]{1,32}$/),
  })
  .strict()
  .refine((p) => p.exp > p.nbf, { message: 'exp doit être après nbf' });

export type LicensePayload = z.infer<typeof licensePayloadSchema>;

/** Clés publiques acceptées, par `kid` : valeur = clé Ed25519 brute en base64url (32 o). */
export type PublicKeyring = Readonly<Record<string, string>>;

export class LicenseFormatError extends Error {
  constructor(reason: string) {
    super(`Licence invalide : ${reason}`);
    this.name = 'LicenseFormatError';
  }
}

/** Décodage base64url STRICT : refuse toute écriture non canonique (malléabilité). */
function b64urlDecodeStrict(s: string): Buffer {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new LicenseFormatError('encodage');
  const buf = Buffer.from(s, 'base64url');
  if (buf.toString('base64url') !== s) throw new LicenseFormatError('encodage non canonique');
  return buf;
}

function canonicalJson(payload: LicensePayload): string {
  // Ordre de clés fixe : un même contenu donne toujours le même jeton.
  const ordered: Record<string, unknown> = {};
  for (const k of Object.keys(payload).sort()) ordered[k] = payload[k as keyof LicensePayload];
  return JSON.stringify(ordered);
}

export function publicKeyFromRaw(rawB64url: string): KeyObject {
  const raw = b64urlDecodeStrict(rawB64url);
  if (raw.length !== 32) throw new LicenseFormatError('clé publique');
  return createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: rawB64url }, format: 'jwk' });
}

export function rawPublicKey(key: KeyObject): string {
  const jwk = key.export({ format: 'jwk' });
  if (jwk.crv !== 'Ed25519' || typeof jwk.x !== 'string') throw new Error('Clé Ed25519 attendue');
  return jwk.x;
}

export function signLicense(payload: LicensePayload, privateKeyPem: string): string {
  const parsed = licensePayloadSchema.parse(payload);
  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Clé privée Ed25519 attendue');
  const body = Buffer.from(canonicalJson(parsed), 'utf8').toString('base64url');
  const sig = sign(null, Buffer.concat([DOMAIN, Buffer.from(body, 'ascii')]), key);
  return `${body}.${sig.toString('base64url')}`;
}

/**
 * Vérifie la signature et le format, SANS juger les dates (voir `evaluateLicense`).
 * Lève `LicenseFormatError` en cas de problème.
 */
export function verifyLicenseToken(token: string, keyring: PublicKeyring): LicensePayload {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    throw new LicenseFormatError('taille');
  }
  const parts = token.split('.');
  if (parts.length !== 2) throw new LicenseFormatError('structure');
  const [body, sigPart] = parts as [string, string];
  const bodyBytes = b64urlDecodeStrict(body);
  const sig = b64urlDecodeStrict(sigPart);
  if (sig.length !== 64) throw new LicenseFormatError('signature');

  // Lecture NON fiable du kid uniquement pour choisir la clé ; tout est revalidé après.
  let untrusted: unknown;
  try {
    untrusted = JSON.parse(bodyBytes.toString('utf8'));
  } catch {
    throw new LicenseFormatError('contenu');
  }
  const kid = (untrusted as { kid?: unknown } | null)?.kid;
  if (typeof kid !== 'string' || !Object.hasOwn(keyring, kid)) {
    throw new LicenseFormatError('clé inconnue (kid)');
  }
  const ok = verify(
    null,
    Buffer.concat([DOMAIN, Buffer.from(body, 'ascii')]),
    publicKeyFromRaw(keyring[kid]!),
    sig,
  );
  if (!ok) throw new LicenseFormatError('signature');

  const result = licensePayloadSchema.safeParse(untrusted);
  if (!result.success) throw new LicenseFormatError('contenu');
  if (canonicalJson(result.data) !== bodyBytes.toString('utf8')) {
    throw new LicenseFormatError('contenu non canonique');
  }
  return result.data;
}
