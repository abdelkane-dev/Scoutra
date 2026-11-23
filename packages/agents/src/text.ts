/** Normalisation insensible à la casse et aux accents. */
export function fold(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const LEGAL_SUFFIXES =
  /\b(sarl|sarlu|suarl|sas|sasu|sa|eurl|ets|etablissements|ltd|limited|llc|inc|plc|gmbh|bv|srl|spa|co|cie|group|groupe)\b/g;

/** Nom normalisé pour le dédoublonnage (sans forme juridique, ponctuation ni accents). */
export function normalizeName(name: string): string {
  const tokens = fold(name)
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  const kept = tokens.filter((t) => !new RegExp(`^${LEGAL_SUFFIXES.source}$`).test(t));
  // Nom composé uniquement de formes juridiques (ex. « Inc ») : on garde le premier mot.
  return (kept.length ? kept : tokens.slice(0, 1)).join(' ');
}

export function containsTerm(haystack: string, term: string): boolean {
  const t = fold(term).trim();
  return t.length > 1 && fold(haystack).includes(t);
}
