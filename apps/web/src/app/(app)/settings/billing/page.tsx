import type { Metadata } from 'next';

import { pageKit } from '@/components/app/page-kit';
import { BillingSettings } from '@/components/app/settings-views';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('prefs.billing.title') };
}

export default async function Page() {
  const { t, allowed } = await pageKit();
  if (!allowed(['billing:read', 'billing:manage']))
    return <p className="text-copy-14 text-ink-2">{t('prefs.billing.noAccess')}</p>;
  return (
    <>
      <h2 className="t-heading-16">{t('prefs.billing.title')}</h2>
      <BillingSettings />
    </>
  );
}
