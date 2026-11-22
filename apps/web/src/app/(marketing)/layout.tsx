import { I18nProvider } from '@/lib/i18n/client';
import { getLocale, pickMessages } from '@/lib/i18n/server';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = pickMessages(locale, ['marketing']);
  return (
    <I18nProvider locale={locale} messages={messages}>
      <a className="skip-link" href="#contenu">
        {messages.marketing.skip}
      </a>
      <SiteHeader />
      <main id="contenu">{children}</main>
      <SiteFooter />
    </I18nProvider>
  );
}
