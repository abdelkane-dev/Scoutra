import type { Metadata } from 'next';
import { Suspense } from 'react';

import { getT } from '@/lib/i18n/server';
import { AuthHeading } from '@/components/auth/auth-shell';
import { ForgotPasswordForm } from '@/components/auth/auth-forms';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('auth.forgot.title'), robots: { index: false } };
}

export default async function Page() {
  const { t } = await getT();

  return (
    <>
      <AuthHeading title={t('auth.forgot.title')} lede={t('auth.forgot.lede')} />
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </>
  );
}
