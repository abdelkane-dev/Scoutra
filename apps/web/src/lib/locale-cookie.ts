import { LOCALE_COOKIE, type Locale } from '@scoutra/i18n';

/** Mémorise la langue choisie (cookie lisible par le serveur, un an). */
export function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
