import { hash, verify } from '@node-rs/argon2';

/**
 * Hachage des mots de passe en argon2id (paramètres recommandés OWASP : 19 Mio, t=2, p=1).
 * L'algorithme par défaut de @node-rs/argon2 est argon2id ; on le vérifie en test.
 */
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword({
  hash: digest,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  if (!digest.startsWith('$argon2id$')) return false;
  try {
    return await verify(digest, password);
  } catch {
    return false;
  }
}
