import type { Metadata } from 'next';
import { pageKit, AppHeader, NotAllowed } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';
import { SignalsView } from '@/components/app/work-views';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('work.signals.title') };
}

export default async function Page() {
  const { ctx, t, allowed } = await pageKit();
  if (!allowed(['signal:read'])) return <NotAllowed t={t} ctx={ctx} title="work.signals.title" />;
  return (
    <>
      <AppHeader
        t={t}
        ctx={ctx}
        section={{ label: t('app.nav.prospecting') }}
        title={t('work.signals.title')}
        meta={t('work.signals.meta')}
      />
      <PageBody>
        <SignalsView />
      </PageBody>
    </>
  );
}
