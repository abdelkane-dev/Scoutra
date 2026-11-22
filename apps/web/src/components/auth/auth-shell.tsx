import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { LocaleSwitch } from '@/components/locale-switch';
import { getT } from '@/lib/i18n/server';

/** Cadre des pages d'authentification : formulaire à gauche, aplat d'accent avec un fragment du produit à droite. */
export async function AuthShell({ children }: { children: React.ReactNode }) {
  const { t } = await getT();
  const log = [
    ['10:42:03', t('auth.asideLog1')],
    ['10:42:11', t('auth.asideLog2')],
    ['10:44:20', t('auth.asideLog3')],
    ['10:45:09', t('auth.asideLog4')],
  ];
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-h-dvh flex-col px-5 py-6 sm:px-10">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" aria-label={t('auth.back')}>
            <Logo />
          </Link>
          <LocaleSwitch label={t('marketing.nav.language')} />
        </header>
        <main id="contenu" className="flex flex-1 items-center py-12">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>
        <footer className="flex flex-wrap gap-x-5 gap-y-1 text-label-12 font-normal text-ink-3">
          <span>{t('marketing.footer.copyright')}</span>
          <Link href="/privacy" className="hover:text-ink">
            {t('marketing.footer.privacy')}
          </Link>
          <Link href="/terms" className="hover:text-ink">
            {t('marketing.footer.terms')}
          </Link>
        </footer>
      </div>
      <aside
        aria-label={t('auth.demo')}
        className="relative hidden overflow-hidden bg-accent lg:block"
      >
        <p className="absolute left-12 top-10 text-[12.5px] font-semibold text-on-accent">
          {t('auth.demo')}
        </p>
        <div className="absolute bottom-[-24px] left-12 right-[-24px] top-24 rounded-xl bg-surface p-8 shadow-window">
          <p className="t-heading-20 max-w-[22ch]">{t('auth.asideTitle')}</p>
          <ol className="mt-6 border-t border-ink">
            {log.map(([time, text]) => (
              <li
                key={time}
                className="grid grid-cols-[76px_minmax(0,1fr)] gap-4 border-b border-line py-4 text-copy-14"
              >
                <time className="text-label-13 font-normal text-ink-3 tnum">{time}</time>
                <span className="flex items-center gap-2">
                  <i aria-hidden className="size-2 shrink-0 rounded-full bg-accent" />
                  {text}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}

export function AuthHeading({ title, lede }: { title: string; lede?: React.ReactNode }) {
  return (
    <div className="mb-8 grid gap-2">
      <h1 className="t-heading-28">{title}</h1>
      {lede ? <p className="text-copy-14 text-ink-2">{lede}</p> : null}
    </div>
  );
}
