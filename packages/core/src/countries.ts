import { z } from 'zod';

const regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'code' });

/** Vrai si `code` est un code pays ISO 3166-1 alpha-2 connu de ICU. */
export function isIsoCountry(code: string): boolean {
  if (!/^[A-Z]{2}$/.test(code)) return false;
  // Codes réservés / utilisateur, jamais des pays réels.
  if (
    code === 'ZZ' ||
    code === 'XX' ||
    code === 'AA' ||
    /^Q[M-Z]$/.test(code) ||
    /^X[A-Z]$/.test(code)
  ) {
    return false;
  }
  return regionNames.of(code) !== code;
}

export const isoCountrySchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isIsoCountry, { message: 'Code pays ISO 3166-1 alpha-2 invalide' });

export type IsoCountry = z.infer<typeof isoCountrySchema>;
