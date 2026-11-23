import type { Metadata } from 'next';
import { pageKit, AppHeader, NotAllowed } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';
import { AutomationsView } from '@/components/app/work-views';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('work.automations.title') };
}

export default async function Page() {
  const { ctx, t, allowed } = await pageKit();
  if (!allowed(['automation:read']))
    return <NotAllowed t={t} ctx={ctx} title="work.automations.title" />;
  return (
    <>
      <AppHeader
        t={t}
        ctx={ctx}
        section={{ label: t('app.nav.followup') }}
        title={t('work.automations.title')}
        meta={t('work.automations.meta')}
      />
      <PageBody>
        <AutomationsView />
      </PageBody>
    </>
  );
}
