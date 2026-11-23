import type { Metadata } from 'next';
import { ACCOUNT_TYPES, SECTORS } from '@scoutra/core';
import { pageKit } from '@/components/app/page-kit';
import { OrganizationSettings } from '@/components/app/settings-views';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('prefs.org.title') };
}

export default async function Page() {
  const { t } = await pageKit();
  return (
    <>
      <h2 className="t-heading-16">{t('prefs.org.title')}</h2>
      <OrganizationSettings
        accountTypes={ACCOUNT_TYPES.map(({ code, fr, en }) => ({ code, fr, en }))}
        sectors={SECTORS.map(({ code, fr, en }) => ({ code, fr, en }))}
      />
    </>
  );
}
