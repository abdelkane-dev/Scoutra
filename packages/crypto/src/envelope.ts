import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * Chiffrement par enveloppe (clés API clientes, valeurs de contact).
 *
 * - Une DEK aléatoire de 32 octets par secret chiffre la donnée (AES-256-GCM, IV 12 o).
 * - La DEK est elle-même chiffrée (« enveloppée ») par une KEK dérivée de la clé maître
 *   (`SCOUTRA_MASTER_KEY`) via HKDF-SHA256, avec un numéro de version pour la rotation.
 * - L'AAD lie le chiffré à `organization_id` + un contexte (ex. `api_credential:<id>`) :
 *   un chiffré copié vers une autre organisation ne se déchiffre pas.
 */

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const FORMAT_VERSION = 1;

export interface Keyring {
  /** Version utilisée pour chiffrer. */
  current: number;
  /** Clés maîtres brutes (32 octets) par version ; les anciennes servent au déchiffrement. */
  keys: ReadonlyMap<number, Buffer>;
}

export interface EncryptedSecret {
  v: typeof FORMAT_VERSION;
  keyVersion: number;
  /** base64(iv | tag | DEK chiffrée) */
  wrappedDek: string;
  /** base64(iv | tag | donnée chiffrée) */
  ciphertext: string;
}

export interface SecretContext {
  orgId: string;
  /** Contexte d'usage, ex. `api_credential:anthropic`. */
  purpose: string;
}

export class DecryptionError extends Error {
  constructor() {
    super('Déchiffrement impossible (clé, organisation ou donnée invalide)');
    this.name = 'DecryptionError';
  }
}

/** Décode une clé maître base64 et vérifie qu'elle fait exactement 32 octets. */
export function decodeMasterKey(b64: string): Buffer {
  const key = Buffer.from(b64, 'base64');
  if (key.length !== KEY_LEN || key.toString('base64') !== b64.trim()) {
    throw new Error('La clé maître doit être 32 octets encodés en base64');
  }
  if (new Set(key).size < 8) throw new Error('La clé maître est trop faible (peu d’entropie)');
  return key;
}

export function createKeyring(current: number, keys: Record<number, string>): Keyring {
  const map = new Map<number, Buffer>();
  for (const [v, b64] of Object.entries(keys)) map.set(Number(v), decodeMasterKey(b64));
  if (!map.has(current)) throw new Error(`Clé maître de version ${current} absente`);
  return { current, keys: map };
}

function deriveKek(master: Buffer, version: number): Buffer {
  return Buffer.from(
    hkdfSync('sha256', master, Buffer.from('scoutra-kek-salt-v1'), `kek:v${version}`, KEY_LEN),
  );
}

function aad(ctx: SecretContext, layer: 'dek' | 'data'): Buffer {
  if (!ctx.orgId || !ctx.purpose) throw new Error('Contexte de chiffrement incomplet');
  return Buffer.from(
    `scoutra:v${FORMAT_VERSION}|${layer}|org:${ctx.orgId}|purpose:${ctx.purpose}`,
    'utf8',
  );
}

function seal(key: Buffer, plaintext: Buffer, additional: Buffer): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  cipher.setAAD(additional);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

function open(key: Buffer, packed: string, additional: Buffer): Buffer {
  const buf = Buffer.from(packed, 'base64');
  if (buf.length < IV_LEN + TAG_LEN) throw new DecryptionError();
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  try {
    const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
    decipher.setAAD(additional);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]);
  } catch {
    throw new DecryptionError();
  }
}

export function encryptSecret(
  plaintext: string,
  ctx: SecretContext,
  keyring: Keyring,
): EncryptedSecret {
  const master = keyring.keys.get(keyring.current);
  if (!master) throw new Error('Clé maître courante absente');
  const dek = randomBytes(KEY_LEN);
  try {
    return {
      v: FORMAT_VERSION,
      keyVersion: keyring.current,
      wrappedDek: seal(deriveKek(master, keyring.current), dek, aad(ctx, 'dek')),
      ciphertext: seal(dek, Buffer.from(plaintext, 'utf8'), aad(ctx, 'data')),
    };
  } finally {
    dek.fill(0);
  }
}

export function decryptSecret(
  secret: EncryptedSecret,
  ctx: SecretContext,
  keyring: Keyring,
): string {
  if (secret.v !== FORMAT_VERSION) throw new DecryptionError();
  const master = keyring.keys.get(secret.keyVersion);
  if (!master) throw new DecryptionError();
  const dek = open(deriveKek(master, secret.keyVersion), secret.wrappedDek, aad(ctx, 'dek'));
  try {
    return open(dek, secret.ciphertext, aad(ctx, 'data')).toString('utf8');
  } finally {
    dek.fill(0);
  }
}

/** Rotation : ré-enveloppe la DEK avec la clé maître courante, sans toucher à la donnée. */
export function rewrapSecret(
  secret: EncryptedSecret,
  ctx: SecretContext,
  keyring: Keyring,
): EncryptedSecret {
  if (secret.keyVersion === keyring.current) return secret;
  const oldMaster = keyring.keys.get(secret.keyVersion);
  const newMaster = keyring.keys.get(keyring.current);
  if (!oldMaster || !newMaster) throw new DecryptionError();
  const dek = open(deriveKek(oldMaster, secret.keyVersion), secret.wrappedDek, aad(ctx, 'dek'));
  try {
    return {
      ...secret,
      keyVersion: keyring.current,
      wrappedDek: seal(deriveKek(newMaster, keyring.current), dek, aad(ctx, 'dek')),
    };
  } finally {
    dek.fill(0);
  }
}
