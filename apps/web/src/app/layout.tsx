import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { getLocale } from '@/lib/i18n/server';
import './globals.css';

/* Mona Sans (SIL OFL 1.1, fichier auto-hébergé : ./fonts/OFL.txt). Variable : graisse et largeur. */
const mona = localFont({
  src: './fonts/MonaSans-latin-var.woff2',
  variable: '--font-mona',
  weight: '200 900',
  display: 'swap',
  declarations: [{ prop: 'font-stretch', value: '75% 125%' }],
  fallback: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
});

export const metadata: Metadata = {
  title: { default: 'Scoutra', template: '%s · Scoutra' },
  description:
    'Décrivez votre cible en une phrase : Scoutra trouve les prospects, vérifie leurs coordonnées, les note de 0 à 100 et rédige le premier message.',
  applicationName: 'Scoutra',
};

export const viewport: Viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1 };

/** Layout racine : langue négociée côté serveur (cookie scoutra_locale puis Accept-Language). */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={mona.variable}>
      <body className="min-h-dvh bg-surface font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
