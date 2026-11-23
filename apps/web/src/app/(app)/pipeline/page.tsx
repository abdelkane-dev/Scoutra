import type { Metadata } from 'next';
import { pageKit, AppHeader, NotAllowed } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';
import { PipelineBoard } from '@/components/app/pipeline-board';
import { DEMO_PROSPECTS } from '@/lib/demo/prospects';
import { formatUsd } from '@/lib/format';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('work.pipeline.title') };
}

export default async function Page() {
  const { ctx, t, allowed, locale } = await pageKit();
  if (!allowed(['pipeline:read']))
    return <NotAllowed t={t} ctx={ctx} title="work.pipeline.title" />;
  const open = DEMO_PROSPECTS.filter((p) => !['won', 'lost'].includes(p.stage));
  return (
    <>
      <AppHeader
        t={t}
        ctx={ctx}
        section={{ label: t('app.nav.followup') }}
        title={t('work.pipeline.title')}
        meta={t('work.pipeline.meta', {
          n: open.length,
          value: formatUsd(
            open.reduce((a, p) => a + p.valueUsd, 0),
            locale,
          ),
        })}
      />
      <PageBody>
        <PipelineBoard />
      </PageBody>
    </>
  );
}
