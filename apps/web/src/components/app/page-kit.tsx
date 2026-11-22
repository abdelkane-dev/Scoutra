import 'server-only';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import type { Action } from '@scoutra/auth';
import type { MessageKey } from '@scoutra/i18n';
import { buttonVariants, EmptyState } from '@scoutra/ui';
import { getAppContext, type AppContext } from '@/lib/app-context';
import { getT, type Translator } from '@/lib/i18n/server';
import { PageHeader, type Crumb } from './page-header';

/** Contexte d'une page de l'application : permissions, traduction et en-tête prêt à l'emploi. */
export async function pageKit() {
  const [ctx, { t, locale }] = await Promise.all([getAppContext(), getT()]);
  const allowed = (perm?: Action[]) => !perm || perm.some((a) => ctx.org.permissions.includes(a) || ctx.org.needsTwoFactor.includes(a));
  return { ctx, t, locale, allowed };
}

export function AppHeader({
  t,
  ctx,
  section,
  title,
  meta,
  actions,
  tabs,
  demo = true,
  extraCrumbs = [],
}: {
  t: Translator;
  ctx: AppContext;
  section?: Crumb;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  demo?: boolean;
  extraCrumbs?: Crumb[];
}) {
  const crumbs: Crumb[] = [{ label: ctx.org.name, href: '/home' }, ...(section ? [section] : []), ...extraCrumbs, { label: title }];
  return (
    <PageHeader
      crumbs={crumbs}
      title={title}
      meta={meta}
      actions={actions}
      tabs={tabs}
      demo={demo}
      demoLabel={t('app.shell.demo')}
      demoHint={t('app.shell.demoHint')}
      breadcrumbLabel={t('app.shell.breadcrumb')}
    />
  );
}

/** Page interdite pour le rôle courant (l'élément de navigation est déjà masqué). */
export function NotAllowed({ t, ctx, title }: { t: Translator; ctx: AppContext; title: MessageKey }) {
  return (
    <>
      <AppHeader t={t} ctx={ctx} title={t(title)} demo={false} />
      <EmptyState
        icon={<Lock strokeWidth={1.75} aria-hidden />}
        title={t('app.shell.notAllowedTitle')}
        action={
          <Link href="/home" className={buttonVariants({ variant: 'secondary' })}>
            {t('app.shell.backHome')}
          </Link>
        }
      >
        {t('app.shell.notAllowedBody', { role: t(`app.roles.${ctx.org.role}`) })}
      </EmptyState>
    </>
  );
}
