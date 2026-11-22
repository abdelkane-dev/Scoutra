'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LOCALES, type Locale } from '@scoutra/i18n';
import { cn } from '@scoutra/ui';
import { useLocale } from '@/lib/i18n/client';
import { setLocaleCookie } from '@/lib/locale-cookie';

const NAMES: Record<Locale, string> = { fr: 'Français', en: 'English' };

/** Bascule FR / EN : mémorise le choix (cookie scoutra_locale) puis recharge le rendu serveur. */
export function LocaleSwitch({
  label,
  className,
  tone = 'light',
}: {
  label: string;
  className?: string;
  tone?: 'light' | 'dark';
}) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex items-center gap-0.5 text-label-13', className)}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          aria-label={NAMES[l]}
          disabled={pending}
          onClick={() => {
            if (l === locale) return;
            setLocaleCookie(l);
            start(() => router.refresh());
          }}
          className={cn(
            'min-h-8 rounded-sm px-1.5 uppercase tracking-normal',
            tone === 'light'
              ? 'text-ink-3 hover:text-ink aria-pressed:text-ink aria-pressed:underline aria-pressed:underline-offset-4'
              : 'text-dark-2 hover:text-white aria-pressed:text-white aria-pressed:underline aria-pressed:underline-offset-4',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
