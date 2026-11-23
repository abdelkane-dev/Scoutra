import type { Metadata } from 'next';
import { Suspense } from 'react';
import { pageKit, AppHeader, NotAllowed } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';
import { messages } from '@scoutra/i18n';
import { ComplianceView } from '@/components/app/admin-views';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('insight.compliance.title') };
}

export default async function Page() {
  const { ctx, t, allowed, locale } = await pageKit();
  if (!allowed(['compliance:read']))
    return <NotAllowed t={t} ctx={ctx} title="insight.compliance.title" />;
  return (
    <>
      <AppHeader
        t={t}
        ctx={ctx}
        section={{ label: t('app.nav.admin') }}
        title={t('insight.compliance.title')}
        meta={t('insight.compliance.meta')}
      />
      <PageBody>
        <Suspense>
          <ComplianceView marketing={messages[locale].marketing.compliance} />
        </Suspense>
      </PageBody>
    </>
  );
}
