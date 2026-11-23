import type { Metadata } from 'next';
import { pageKit, AppHeader } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('prefs.docs.title') };
}

export default async function Page() {
  const { ctx, t } = await pageKit();
  const s = [1, 2, 3, 4, 5, 6] as const;
  return (
    <>
      <AppHeader t={t} ctx={ctx} section={{ label: t('app.nav.help') }} title={t('prefs.docs.title')} meta={t('prefs.docs.meta')} demo={false} />
      <PageBody className="lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label={t('prefs.docs.toc')} className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 text-label-12 text-ink-3">{t('prefs.docs.toc')}</p>
          <ol className="grid gap-0.5">
            {s.map((n) => (
              <li key={n}>
                <a href={`#doc-${n}`} className="flex min-h-8 items-center gap-2 rounded-sm px-2 text-label-14 text-ink-2 hover:bg-hover hover:text-ink">
                  <span className="w-4 text-ink-3 tnum">{n}</span>
                  {t(`prefs.docs.s${n}`)}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="grid max-w-[72ch] gap-8 rounded-lg border border-line bg-surface px-6 py-6">
          {s.map((n) => (
            <section key={n} id={`doc-${n}`} aria-labelledby={`h-doc-${n}`} className="grid gap-2">
              <h2 id={`h-doc-${n}`} className="t-heading-20">{t(`prefs.docs.s${n}`)}</h2>
              <p className="text-copy-16 text-ink-2">{t(`prefs.docs.s${n}b`)}</p>
            </section>
          ))}
        </article>
      </PageBody>
    </>
  );
}
