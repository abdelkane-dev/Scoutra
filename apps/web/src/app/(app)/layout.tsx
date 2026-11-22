import type { Metadata } from 'next';
import { I18nProvider } from '@/lib/i18n/client';
import { getLocale, pickMessages } from '@/lib/i18n/server';
import { getAppContext } from '@/lib/app-context';
import { AppProvider } from '@/components/app/app-provider';
import { AppShell } from '@/components/app/app-shell';

export const metadata: Metadata = { robots: { index: false } };

/**
 * Espace connecté. La session est vérifiée ICI côté serveur (getAppContext → getSession, puis
 * redirection vers /login ou /onboarding) ; le proxy n'est qu'une couche optimiste.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [ctx, locale] = await Promise.all([getAppContext(), getLocale()]);
  const messages = pickMessages(locale, ['common', 'app', 'prospectingModels', 'prospectKinds', 'auth', 'home', 'search']);
  return (
    <I18nProvider locale={locale} messages={messages}>
      <AppProvider value={ctx}>
        <AppShell>{children}</AppShell>
      </AppProvider>
    </I18nProvider>
  );
}
