import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/session';
import { getT } from '@/lib/i18n/server';
import { AuthHeading } from '@/components/auth/auth-shell';
import { TwoFactorSetup } from '@/components/auth/two-factor-setup';
import { safeNext } from '@/lib/auth-client';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('auth.setup2fa.title'), robots: { index: false } };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const s = await getSession();
  if (!s) redirect('/login?next=/two-factor/setup');
  const { t } = await getT();
  const { next } = await searchParams;
  return (
    <>
      <AuthHeading title={t('auth.setup2fa.title')} lede={t('auth.setup2fa.lede')} />
      <TwoFactorSetup
        alreadyEnabled={!!s.user.twoFactorEnabled}
        next={safeNext(next, '/settings/security')}
      />
    </>
  );
}
