import type { Metadata } from 'next';
import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import { PROSPECTING_MODEL_CODES } from '@scoutra/core';
import { buttonVariants } from '@scoutra/ui';
import { pageKit, AppHeader, NotAllowed } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';
import { SearchView } from '@/components/app/search-view';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('search.title') };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ model?: string }> }) {
  const { ctx, t, allowed } = await pageKit();
  if (!allowed(['campaign:read'])) return <NotAllowed t={t} ctx={ctx} title="search.title" />;
  const { model } = await searchParams;
  return (
    <>
      <AppHeader
        t={t}
        ctx={ctx}
        title={t('search.title')}
        meta={t('search.meta')}
        actions={
          <Link href="/search/saved" className={buttonVariants({ variant: 'secondary' })}>
            <Bookmark aria-hidden strokeWidth={1.75} />
            {t('search.saved')}
          </Link>
        }
      />
      <PageBody>
        <SearchView models={[...PROSPECTING_MODEL_CODES]} defaultCountry={ctx.org.countryCode} initialModel={model} />
      </PageBody>
    </>
  );
}
