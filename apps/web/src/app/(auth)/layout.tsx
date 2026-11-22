import { I18nProvider } from '@/lib/i18n/client';
import { getLocale, pickMessages } from '@/lib/i18n/server';
import { Toaster } from '@scoutra/ui';
import { AuthShell } from '@/components/auth/auth-shell';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <I18nProvider locale={locale} messages={pickMessages(locale, ['common', 'auth', 'app'])}>
      <AuthShell>{children}</AuthShell>
      <Toaster />
    </I18nProvider>
  );
}
