import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/session';
import { getT } from '@/lib/i18n/server';
import { AuthHeading } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/auth-forms';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('auth.login.title'), robots: { index: false } };
}

export default async function Page() {
  const { t } = await getT();
  if (await getSession()) redirect('/home');
  return (
    <>
      <AuthHeading title={t('auth.login.title')} lede={t('auth.login.lede')} />
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
