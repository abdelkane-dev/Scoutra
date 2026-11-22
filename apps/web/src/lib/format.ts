import type { Locale } from '@scoutra/i18n';

const NBSP = String.fromCharCode(0xa0);
const tag =(l: Locale) => (l === 'fr' ? 'fr-FR' : 'en-US');

/** Montant en dollars : « 19,99 $ » en français, « $19.99 » en anglais (pas de « $US »). */
export function formatUsd(v: number, locale: Locale) {
  const n = new Intl.NumberFormat(tag(locale), {
    minimumFractionDigits: v % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(v);
  return locale === 'fr' ? `${n}${NBSP}$` : `$${n}`;
}

export function formatNumber(v: number, locale: Locale, o?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(tag(locale), o).format(v);
}
