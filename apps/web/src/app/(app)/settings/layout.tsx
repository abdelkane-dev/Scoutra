import { pageKit, AppHeader } from '@/components/app/page-kit';
import { SettingsNav } from '@/components/app/settings-views';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { ctx, t } = await pageKit();
  return (
    <>
      <AppHeader
        t={t}
        ctx={ctx}
        section={{ label: t('app.nav.admin') }}
        title={t('prefs.title')}
        demo={false}
      />
      <div className="grid min-w-0 content-start gap-4 px-3 py-4 sm:px-6 sm:py-5 lg:grid-cols-[200px_minmax(0,1fr)] [&>*]:min-w-0">
        <SettingsNav />
        <div className="grid content-start gap-3">{children}</div>
      </div>
    </>
  );
}
