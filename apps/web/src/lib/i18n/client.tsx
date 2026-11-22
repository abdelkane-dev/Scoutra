'use client';
import * as React from 'react';
import type { Locale, MessageKey } from '@scoutra/i18n';

type Dict = Record<string, unknown>;
const I18nContext = React.createContext<{ locale: Locale; messages: Dict } | null>(null);

/** Fournit la langue et un sous-ensemble des messages aux composants client. */
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: object;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ locale, messages: messages as Dict }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function lookup(m: Dict, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node as Dict | undefined)?.[part], m);
}

export type ClientT = (key: MessageKey, params?: Record<string, string | number>) => string;

export function useT(): ClientT {
  const ctx = React.useContext(I18nContext);
  return React.useCallback<ClientT>(
    (key, params) => {
      const raw = ctx ? lookup(ctx.messages, key) : undefined;
      const text = typeof raw === 'string' ? raw : key;
      return params
        ? text.replace(/\{(\w+)\}/g, (_, p: string) => String(params[p] ?? `{${p}}`))
        : text;
    },
    [ctx],
  );
}

export function useLocale(): Locale {
  return React.useContext(I18nContext)?.locale ?? 'fr';
}

/** Formatage des nombres selon la langue (espace fine insécable en français). */
export function useFormat() {
  const locale = useLocale();
  return React.useMemo(() => {
    const tag = locale === 'fr' ? 'fr-FR' : 'en-US';
    return {
      n: (v: number, o?: Intl.NumberFormatOptions) => new Intl.NumberFormat(tag, o).format(v),
      pct: (v: number) =>
        new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 0 }).format(v),
      money: (v: number, currency = 'USD') =>
        new Intl.NumberFormat(tag, {
          style: 'currency',
          currency,
          maximumFractionDigits: v % 1 ? 2 : 0,
        }).format(v),
      country: (code: string) => new Intl.DisplayNames([tag], { type: 'region' }).of(code) ?? code,
      tag,
    };
  }, [locale]);
}
