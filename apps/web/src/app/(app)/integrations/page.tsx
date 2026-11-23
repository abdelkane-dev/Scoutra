import type { Metadata } from 'next';
import { Suspense } from 'react';
import { pageKit, AppHeader, NotAllowed } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';
import { IntegrationsView } from '@/components/app/admin-views';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('insight.integrations.title') };
}

export default async function Page() {
  const { ctx, t, allowed } = await pageKit();
  if (!allowed(['integration:manage', 'apikey:manage']))
    return <NotAllowed t={t} ctx={ctx} title="insight.integrations.title" />;
  return (
    <>
      <AppHeader
        t={t}
        ctx={ctx}
        section={{ label: t('app.nav.admin') }}
        title={t('insight.integrations.title')}
        meta={t('insight.integrations.meta')}
      />
      <PageBody>
        <Suspense>
          <IntegrationsView />
        </Suspense>
      </PageBody>
    </>
  );
}
