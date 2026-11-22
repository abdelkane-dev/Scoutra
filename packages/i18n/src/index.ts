import { en } from './messages/en';
import { fr } from './messages/fr';
import type { MessageKey, Messages } from './types';

export type { MessageKey, Messages };

export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';
export const LOCALE_COOKIE = 'scoutra_locale';

export const messages: Record<Locale, Messages> = { fr, en };

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

/** Choisit la langue : cookie explicite, puis Accept-Language, puis français. */
export function negotiateLocale(acceptLanguage?: string | null, cookie?: string | null): Locale {
  if (isLocale(cookie)) return cookie;
  if (acceptLanguage) {
    const ranked = acceptLanguage
      .split(',')
      .slice(0, 20)
      .map((part) => {
        const [tag = '', ...params] = part.trim().split(';');
        const q = Number(params.find((p) => p.trim().startsWith('q='))?.split('=')[1] ?? '1');
        return { lang: tag.toLowerCase().split('-')[0], q: Number.isFinite(q) ? q : 0 };
      })
      .sort((a, b) => b.q - a.q);
    for (const { lang, q } of ranked) if (q > 0 && isLocale(lang)) return lang;
  }
  return DEFAULT_LOCALE;
}

/** Traduction typée ; repli sur le français puis sur la clé. `{nom}` est remplacé par `params.nom`. */
export function t(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const lookup = (m: Messages) =>
    key
      .split('.')
      .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], m);
  const raw = lookup(messages[locale]) ?? lookup(messages.fr);
  const text = typeof raw === 'string' ? raw : key;
  return params
    ? text.replace(/\{(\w+)\}/g, (_, p: string) => String(params[p] ?? `{${p}}`))
    : text;
}
