import type { Metadata } from 'next';

import { pageKit } from '@/components/app/page-kit';
import { ProfileSettings } from '@/components/app/settings-views';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('prefs.profile.title') };
}

export default async function Page() {
  const { t } = await pageKit();
  return (
    <>
      <h2 className="t-heading-16">{t('prefs.profile.title')}</h2>
      <ProfileSettings />
    </>
  );
}
