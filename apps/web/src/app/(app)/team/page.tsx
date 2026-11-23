import type { Metadata } from 'next';
import { Suspense } from 'react';
import { pageKit, AppHeader, NotAllowed } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';
import { TeamView } from '@/components/app/admin-views';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('insight.team.title') };
}

export default async function Page() {
  const { ctx, t, allowed } = await pageKit();
  if (!allowed(['member:list'])) return <NotAllowed t={t} ctx={ctx} title="insight.team.title" />;
  return (
    <>
      <AppHeader
        t={t}
        ctx={ctx}
        section={{ label: t('app.nav.steering') }}
        title={t('insight.team.title')}
        meta={t('insight.team.meta')}
        demo={false}
      />
      <PageBody>
        <Suspense>
          <TeamView />
        </Suspense>
      </PageBody>
    </>
  );
}
