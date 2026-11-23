import type { Metadata } from 'next';
import { pageKit, AppHeader, NotAllowed } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';
import { CampaignsView } from '@/components/app/work-views';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('work.campaigns.title') };
}

export default async function Page() {
  const { ctx, t, allowed } = await pageKit();
  if (!allowed(['campaign:read']))
    return <NotAllowed t={t} ctx={ctx} title="work.campaigns.title" />;
  return (
    <>
      <AppHeader
        t={t}
        ctx={ctx}
        section={{ label: t('app.nav.prospecting') }}
        title={t('work.campaigns.title')}
        meta={t('work.campaigns.meta')}
      />
      <PageBody>
        <CampaignsView />
      </PageBody>
    </>
  );
}
