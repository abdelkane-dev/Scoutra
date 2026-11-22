import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ACCOUNT_TYPES, SECTORS } from '@scoutra/core';
import { getSession } from '@/server/session';
import { getT } from '@/lib/i18n/server';
import { AuthHeading } from '@/components/auth/auth-shell';
import { Onboarding } from '@/components/auth/onboarding';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('auth.onboarding.title'), robots: { index: false } };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const s = await getSession();
  if (!s) redirect('/login?next=/onboarding');
  const { t } = await getT();
  const { step } = await searchParams;
  const hasOrg = !!s.session.activeOrganizationId;
  const initial = step === 'profile' || hasOrg ? 'profile' : 'org';
  return (
    <>
      <AuthHeading title={t('auth.onboarding.title')} lede={t('auth.onboarding.lede')} />
      <Onboarding
        initialStep={initial}
        accountTypes={ACCOUNT_TYPES.map(({ code, fr, en }) => ({ code, fr, en }))}
        sectors={SECTORS.map(({ code, fr, en }) => ({ code, fr, en }))}
      />
    </>
  );
}
