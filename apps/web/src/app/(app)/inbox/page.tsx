import type { Metadata } from 'next';
import { pageKit, AppHeader, NotAllowed } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';
import { InboxView } from '@/components/app/work-views';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('work.inbox.title') };
}

export default async function Page() {
  const { ctx, t, allowed } = await pageKit();
  if (!allowed(['message:read'])) return <NotAllowed t={t} ctx={ctx} title="work.inbox.title" />;
  return (
    <>
      <AppHeader
        t={t}
        ctx={ctx}
        section={{ label: t('app.nav.followup') }}
        title={t('work.inbox.title')}
        meta={t('work.inbox.meta')}
      />
      <PageBody>
        <InboxView />
      </PageBody>
    </>
  );
}
