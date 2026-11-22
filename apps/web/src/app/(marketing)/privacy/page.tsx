import type { Metadata } from 'next';
import { getT } from '@/lib/i18n/server';
import { LegalPage } from '@/components/marketing/legal-page';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('marketing.legal.privacy.title'), robots: { index: false } };
}

export default function Page() {
  return <LegalPage kind="privacy" />;
}
