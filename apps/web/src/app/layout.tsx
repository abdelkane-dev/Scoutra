import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, negotiateLocale } from '@scoutra/i18n';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Scoutra', template: '%s · Scoutra' },
  description: 'Prospection multi-agents, B2B et B2C, dans le respect des règles de chaque pays.',
};

/** Layout racine minimal : langue négociée côté serveur. Le frontend construit le reste. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [h, c] = await Promise.all([headers(), cookies()]);
  const locale = negotiateLocale(h.get('accept-language'), c.get(LOCALE_COOKIE)?.value);
  return (
    <html lang={locale}>
      <body className="min-h-dvh bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
