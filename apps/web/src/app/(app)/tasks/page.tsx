import type { Metadata } from 'next';
import { pageKit, AppHeader, NotAllowed } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';
import { TasksView } from '@/components/app/work-views';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('work.tasks.title') };
}

export default async function Page() {
  const { ctx, t, allowed } = await pageKit();
  if (!allowed(['task:read'])) return <NotAllowed t={t} ctx={ctx} title="work.tasks.title" />;
  return (
    <>
      <AppHeader
        t={t}
        ctx={ctx}
        section={{ label: t('app.nav.followup') }}
        title={t('work.tasks.title')}
        meta={t('work.tasks.meta', { n: 8, late: 1 })}
      />
      <PageBody>
        <TasksView />
      </PageBody>
    </>
  );
}
