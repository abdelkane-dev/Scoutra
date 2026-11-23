import type { Metadata } from 'next';
import { pageKit, AppHeader } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';
import { HelpContact } from '@/components/app/help-contact';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('prefs.help.title') };
}

export default async function Page() {
  const { ctx, t } = await pageKit();
  return (
    <>
      <AppHeader
        t={t}
        ctx={ctx}
        section={{ label: t('app.nav.help') }}
        title={t('prefs.help.title')}
        meta={t('prefs.help.meta')}
        demo={false}
      />
      <PageBody className="lg:grid-cols-[minmax(0,1fr)_380px]">
        <section
          aria-labelledby="h-faq"
          className="overflow-hidden rounded-lg border border-line bg-surface"
        >
          <h2 id="h-faq" className="border-b border-line px-4 py-3 text-[14.5px] font-semibold">
            {t('prefs.help.popular')}
          </h2>
          {([1, 2, 3, 4] as const).map((n) => (
            <details key={n} className="group border-b border-line last:border-0">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-label-14 font-semibold [&::-webkit-details-marker]:hidden">
                {t(`prefs.help.q${n}`)}
                <span
                  aria-hidden
                  className="text-[18px] font-normal text-ink-3 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="px-4 pb-4 text-copy-14 text-ink-2">{t(`prefs.help.a${n}`)}</p>
            </details>
          ))}
        </section>
        <HelpContact />
      </PageBody>
    </>
  );
}
