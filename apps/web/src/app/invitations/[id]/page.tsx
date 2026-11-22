import type { Metadata } from 'next';
import { Toaster } from '@scoutra/ui';
import { I18nProvider } from '@/lib/i18n/client';
import { getLocale, getT, pickMessages } from '@/lib/i18n/server';
import { getSession } from '@/server/session';
import { AuthHeading, AuthShell } from '@/components/auth/auth-shell';
import { InvitationPanel } from '@/components/auth/invitation';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('auth.invitation.title'), robots: { index: false } };
}

/** Lien reçu par email : /invitations/<id> (jeton à usage unique lié à l'adresse invitée). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, locale, s, { t }] = await Promise.all([params, getLocale(), getSession(), getT()]);
  return (
    <I18nProvider locale={locale} messages={pickMessages(locale, ['common', 'auth', 'app'])}>
      <AuthShell>
        <AuthHeading title={t('auth.invitation.title')} />
        <InvitationPanel id={id} signedIn={!!s} />
      </AuthShell>
      <Toaster />
    </I18nProvider>
  );
}
