import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import {
  LOCALE_COOKIE,
  messages,
  negotiateLocale,
  t,
  type Locale,
  type MessageKey,
  type Messages,
} from '@scoutra/i18n';

/** Langue de la requête : cookie scoutra_locale, puis Accept-Language, puis français. */
export const getLocale = cache(async (): Promise<Locale> => {
  const [h, c] = await Promise.all([headers(), cookies()]);
  return negotiateLocale(h.get('accept-language'), c.get(LOCALE_COOKIE)?.value);
});

export type Translator = (key: MessageKey, params?: Record<string, string | number>) => string;

export async function getT(): Promise<{ t: Translator; locale: Locale }> {
  const locale = await getLocale();
  return { locale, t: (key, params) => t(locale, key, params) };
}

/** Sous-ensemble des messages envoyé au client (on n'envoie pas tout le dictionnaire). */
export function pickMessages<K extends keyof Messages>(locale: Locale, keys: readonly K[]) {
  const all = messages[locale];
  return Object.fromEntries(keys.map((k) => [k, all[k]])) as Pick<Messages, K>;
}
