import type { Metadata } from 'next';
import { Suspense } from 'react';
import { pageKit, AppHeader, NotAllowed } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';
import { ExportsView } from '@/components/app/admin-views';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('insight.exports.title') };
}

export default async function Page() {
  const { ctx, t, allowed } = await pageKit();
  if (!allowed(['prospect:export']))
    return <NotAllowed t={t} ctx={ctx} title="insight.exports.title" />;
  return (
    <>
      <AppHeader
        t={t}
        ctx={ctx}
        section={{ label: t('app.nav.steering') }}
        title={t('insight.exports.title')}
        meta={t('insight.exports.meta')}
      />
      <PageBody>
        <Suspense>
          <ExportsView />
        </Suspense>
      </PageBody>
    </>
  );
}
