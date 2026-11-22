import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Upload } from 'lucide-react';
import { Button, buttonVariants } from '@scoutra/ui';
import { pageKit, AppHeader, NotAllowed } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';
import { ProspectsView } from '@/components/app/base-views';
import { DEMO_PROSPECTS } from '@/lib/demo/prospects';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('work.base.prospectsTitle') };
}

export default async function Page() {
  const { ctx, t, allowed, locale } = await pageKit();
  if (!allowed(['prospect:read'])) return <NotAllowed t={t} ctx={ctx} title="work.base.prospectsTitle" />;
  return (
    <>
      <AppHeader
        t={t}
        ctx={ctx}
        section={{ label: t('app.nav.base') }}
        title={t('work.base.prospectsTitle')}
        meta={t('work.base.prospectsMeta', { n: new Intl.NumberFormat(locale).format(DEMO_PROSPECTS.length) })}
        actions={
          allowed(['prospect:write']) ? (
            <>
              <Button>
                <Upload aria-hidden strokeWidth={1.75} />
                CSV
              </Button>
              <Link href="/search" className={buttonVariants({ variant: 'primary' })}>
                <Plus aria-hidden strokeWidth={1.75} />
                {t('home.newSearch')}
              </Link>
            </>
          ) : null
        }
      />
      <PageBody>
        <Suspense>
          <ProspectsView />
        </Suspense>
      </PageBody>
    </>
  );
}
