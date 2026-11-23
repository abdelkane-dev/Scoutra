import type { Metadata } from 'next';
import { pageKit, AppHeader, NotAllowed } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';
import { AnalyticsView } from '@/components/app/analytics-view';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('insight.analytics.title') };
}

export default async function Page() {
  const { ctx, t, allowed } = await pageKit();
  if (!allowed(['report:read_own']))
    return <NotAllowed t={t} ctx={ctx} title="insight.analytics.title" />;
  return (
    <>
      <AppHeader
        t={t}
        ctx={ctx}
        section={{ label: t('app.nav.steering') }}
        title={t('insight.analytics.title')}
        meta={t('insight.analytics.meta')}
      />
      <PageBody>
        <AnalyticsView />
      </PageBody>
    </>
  );
}
