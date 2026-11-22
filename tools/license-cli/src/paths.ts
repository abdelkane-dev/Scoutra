import { existsSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Renvoie la racine du dépôt Git contenant `dir`, ou null. */
export function findGitRoot(dir: string): string | null {
  let current = resolve(dir);
  for (;;) {
    if (existsSync(join(current, '.git'))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/**
 * La clé privée ne doit JAMAIS être écrite dans un dépôt Git (risque de commit).
 * Lève une erreur si `dir` est dans un dépôt.
 */
export function assertOutsideGitRepo(dir: string): void {
  const real = existsSync(dir) ? realpathSync(dir) : resolve(dir);
  const root = findGitRoot(real);
  if (root) {
    throw new Error(
      `Refus : ${real} est dans un dépôt Git (${root}). Choisissez un dossier hors dépôt, idéalement sur un support hors ligne.`,
    );
  }
}
