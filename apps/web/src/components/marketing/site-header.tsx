import Link from 'next/link';
import { Menu } from 'lucide-react';
import { buttonVariants, cn } from '@scoutra/ui';
import { Logo } from '@/components/brand/logo';
import { LocaleSwitch } from '@/components/locale-switch';
import { getT } from '@/lib/i18n/server';
import { Wrap } from './frame';

export async function SiteHeader() {
  const { t } = await getT();
  const links = [
    ['/#fonctionnement', t('marketing.nav.how')],
    ['/#pour-qui', t('marketing.nav.who')],
    ['/#pipeline', t('marketing.nav.pipeline')],
    ['/#conformite', t('marketing.nav.compliance')],
    ['/#tarifs', t('marketing.nav.pricing')],
  ] as const;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/[.96]">
      <Wrap className="flex h-16 items-center gap-8 max-[899px]:gap-3">
        <Link href="/" aria-label={t('marketing.nav.home')} className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label={t('marketing.nav.label')} className="hidden min-[900px]:block">
          <ul className="flex gap-7 text-label-14 text-ink-2">
            {links.map(([href, label]) => (
              <li key={href}>
                <a href={href} className="hover:text-ink">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <span className="flex-1" />
        <LocaleSwitch label={t('marketing.nav.language')} className="hidden sm:inline-flex" />
        <Link
          href="/login"
          className="hidden text-label-14 text-ink-2 hover:text-ink min-[900px]:inline"
        >
          {t('marketing.nav.login')}
        </Link>
        <Link
          href="/signup"
          className={cn(buttonVariants({ variant: 'ink', size: 'sm' }), 'max-sm:h-10')}
        >
          {t('marketing.nav.cta')}
        </Link>
        {/* Menu mobile sans JavaScript */}
        <details className="group relative min-[900px]:hidden">
          <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-sm text-ink-2 hover:bg-hover [&::-webkit-details-marker]:hidden">
            <Menu className="size-[18px]" strokeWidth={1.75} aria-hidden />
            <span className="sr-only">{t('marketing.nav.label')}</span>
          </summary>
          <div className="absolute right-0 top-12 grid w-64 gap-1 rounded-md border border-line bg-surface p-2 shadow-pop">
            {links.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="flex min-h-11 items-center rounded-sm px-3 text-label-14 text-ink-2 hover:bg-sunken"
              >
                {label}
              </a>
            ))}
            <Link
              href="/login"
              className="flex min-h-11 items-center rounded-sm px-3 text-label-14 text-ink hover:bg-sunken"
            >
              {t('marketing.nav.login')}
            </Link>
            <div className="border-t border-line px-1 pt-2">
              <LocaleSwitch label={t('marketing.nav.language')} />
            </div>
          </div>
        </details>
      </Wrap>
    </header>
  );
}
