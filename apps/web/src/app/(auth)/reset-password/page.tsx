import type { Metadata } from 'next';
import { Suspense } from 'react';

import { getT } from '@/lib/i18n/server';
import { AuthHeading } from '@/components/auth/auth-shell';
import { ResetPasswordForm } from '@/components/auth/auth-forms';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('auth.reset.title'), robots: { index: false } };
}

export default async function Page() {
  const { t } = await getT();

  return (
    <>
      <AuthHeading title={t('auth.reset.title')} lede={t('auth.reset.lede')} />
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
