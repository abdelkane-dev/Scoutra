import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { Wrap } from './frame';

/** Page légale structurée, contenu « à rédiger » (aucun texte juridique inventé). */
export async function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const { t } = await getT();
  const sections = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
  return (
    <Wrap className="py-16 min-[900px]:py-24">
      <div className="grid max-w-[72ch] gap-4">
        <Link href="/" className="text-label-13 text-ink-3 hover:text-ink">
          {t('marketing.legal.back')}
        </Link>
        <h1 className="t-heading-40">{t(`marketing.legal.${kind}.title`)}</h1>
        <p className="text-label-13 font-normal text-ink-3">{t('marketing.legal.updated')}</p>
        <p className="rounded-md border border-warn/30 bg-warn-soft px-4 py-3 text-copy-14 text-warn">
          <b className="font-semibold">{t('marketing.legal.draft')}.</b>{' '}
          {t('marketing.legal.draftNote')}
        </p>
        <nav aria-label={t(`marketing.legal.${kind}.title`)} className="mt-4 border-t border-ink">
          <ol className="text-copy-14">
            {sections.map((n) => (
              <li key={n} className="border-b border-line">
                <a
                  href={`#s${n}`}
                  className="flex min-h-11 items-center gap-3 text-ink-2 hover:text-ink"
                >
                  <span className="w-6 text-ink-3 tnum">{n}.</span>
                  {t(`marketing.legal.${kind}.s${n}`)}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {sections.map((n) => (
          <section key={n} id={`s${n}`} aria-labelledby={`h-s${n}`} className="mt-8 grid gap-2">
            <h2 id={`h-s${n}`} className="t-heading-20">
              {n}. {t(`marketing.legal.${kind}.s${n}`)}
            </h2>
            <p className="text-copy-16 text-ink-3">{t('marketing.legal.draft')}.</p>
          </section>
        ))}
      </div>
    </Wrap>
  );
}
