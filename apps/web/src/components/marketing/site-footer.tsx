import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { getT } from '@/lib/i18n/server';
import { Wrap } from './frame';

export async function SiteFooter() {
  const { t } = await getT();
  const cols = [
    {
      title: t('marketing.footer.product'),
      links: [
        ['/#fonctionnement', t('marketing.nav.how')],
        ['/#pipeline', t('marketing.pricing.pipeline')],
        ['/#tarifs', t('marketing.nav.pricing')],
      ],
    },
    {
      title: t('marketing.footer.trust'),
      links: [
        ['/#conformite', t('marketing.nav.compliance')],
        ['/privacy', t('marketing.footer.privacy')],
        ['/terms', t('marketing.footer.terms')],
      ],
    },
    {
      title: t('marketing.footer.company'),
      links: [
        ['/#faq', t('marketing.footer.sources')],
        ['/#faq', t('marketing.footer.licenseLink')],
        ['mailto:contact@scoutra.ai', t('marketing.footer.contact')],
      ],
    },
  ];
  return (
    <footer className="border-t border-line bg-surface py-14">
      <Wrap className="grid grid-cols-12 gap-x-6 gap-y-10">
        <div className="col-span-12 grid content-start gap-4 lg:col-span-5">
          <Logo className="h-6" />
          <p className="max-w-[40ch] text-copy-14 text-ink-2">{t('marketing.footer.tagline')}</p>
        </div>
        {cols.map((c) => (
          <nav
            key={c.title}
            aria-label={c.title}
            className="col-span-6 sm:col-span-4 lg:col-span-2"
          >
            <h3 className="mb-3 text-label-13 text-ink-3">{c.title}</h3>
            <ul className="grid gap-2 text-copy-14">
              {c.links.map(([href, label]) => (
                <li key={label}>
                  <Link href={href!} className="text-ink-2 hover:text-ink">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <p className="col-span-12 flex flex-wrap justify-between gap-2 border-t border-line pt-6 text-label-12 font-normal text-ink-3">
          <span>{t('marketing.footer.copyright')}</span>
          <span>{t('marketing.footer.demoNote')}</span>
        </p>
      </Wrap>
    </footer>
  );
}
