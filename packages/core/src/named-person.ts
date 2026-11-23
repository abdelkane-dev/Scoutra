const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Refus DÉTERMINISTE des recherches visant une personne nommée (revue étape 2, constat 8 ;
 * PLAN §3 : pas de corrélation d'identité, pas de fiche sur un particulier). Prudence assumée :
 * mieux vaut refuser une demande ambiguë que constituer un dossier sur quelqu'un.
 */
const PERSONAL_DATA =
  /\b(e-?mail|courriel|mail|t[eé]l[eé]phone|num[eé]ro|portable|adresse|domicile|o[uù] (?:(?:il|elle) )?(?:habite|vit|travaille)|profil|compte|r[eé]seaux sociaux|instagram|facebook|tiktok|linkedin|whatsapp|phone|address|lives?|where (?:he|she)|account|social media|contact (?:de|of))\b/i;
const RELATIONAL =
  /\b(mon ex|ma ex|mon voisin|ma voisine|mon coll[eè]gue|ma coll[eè]gue|my ex|my neighbou?r|my coworker|cette personne|this person|qui est|who is)\b/i;
const HANDLE = /(^|\s)@[a-z0-9_.]{3,30}\b/i;
/** Deux mots à majuscule consécutifs (prénom nom), hors début de phrase. */
const FULL_NAME = /(?<![.!?]\s)(?<!^)\b([A-ZÀ-Ý][a-zà-ÿ'-]{1,20})\s+([A-ZÀ-Ý][a-zà-ÿ'-]{1,25})\b/gu;
const NOT_NAMES = new Set(
  [
    'Côte',
    'Ivoire',
    'Burkina',
    'Faso',
    'Sierra',
    'Leone',
    'United',
    'States',
    'Kingdom',
    'New',
    'York',
    'Saint',
    'Le',
    'La',
    'Les',
    'Grand',
    'Petit',
    'Royaume',
    'Uni',
    'Afrique',
    'Ouest',
    'Europe',
    'Amérique',
    'Nord',
    'Sud',
    'South',
    'North',
    'West',
    'East',
  ].map((w) => fold(w)),
);

export function namedPersons(text: string): string[] {
  const out: string[] = [];
  for (const m of text.slice(0, 2000).matchAll(FULL_NAME)) {
    const [a, b] = [m[1]!, m[2]!];
    if (NOT_NAMES.has(fold(a)) || NOT_NAMES.has(fold(b))) continue;
    out.push(`${a} ${b}`);
  }
  return out;
}

export type NamedPersonReason =
  'social_handle' | 'named_person_personal_data' | 'relational_target';

/** Raison du refus si le texte vise une personne précise, sinon null. */
export function targetsNamedPerson(text: string): NamedPersonReason | null {
  const t = text.slice(0, 2000);
  if (HANDLE.test(t)) return 'social_handle';
  if (RELATIONAL.test(t) && (PERSONAL_DATA.test(t) || namedPersons(t).length > 0))
    return 'relational_target';
  if (namedPersons(t).length > 0 && PERSONAL_DATA.test(t)) return 'named_person_personal_data';
  return null;
}

/** Mot-clé de recherche qui ressemble à un nom de personne (exclu des requêtes). */
export function looksLikePersonName(keyword: string): boolean {
  return namedPersons(` x ${keyword}`).length > 0 || HANDLE.test(keyword);
}
