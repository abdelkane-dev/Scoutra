import type { Metadata } from 'next';
import { pageKit, AppHeader, NotAllowed } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';
import { LeadsView } from '@/components/app/base-views';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('work.base.leadsTitle') };
}

export default async function Page() {
  const { ctx, t, allowed } = await pageKit();
  if (!allowed(['prospect:read']))
    return <NotAllowed t={t} ctx={ctx} title="work.base.leadsTitle" />;
  return (
    <>
      <AppHeader
        t={t}
        ctx={ctx}
        section={{ label: t('app.nav.base') }}
        title={t('work.base.leadsTitle')}
        meta={t('work.base.leadsMeta')}
      />
      <PageBody>
        <LeadsView />
      </PageBody>
    </>
  );
}
