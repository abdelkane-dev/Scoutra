import Link from 'next/link';
import { ChevronRight, FlaskConical } from 'lucide-react';
import { Tooltip, cn } from '@scoutra/ui';

export interface Crumb {
  label: string;
  href?: string;
}

/** En-tête de page : fil d'Ariane, titre, méta, actions à droite, et zone d'onglets en dessous. */
export function PageHeader({
  crumbs,
  title,
  meta,
  actions,
  tabs,
  demo,
  demoLabel,
  demoHint,
  breadcrumbLabel,
  className,
}: {
  crumbs: Crumb[];
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  demo?: boolean;
  demoLabel?: string;
  demoHint?: string;
  breadcrumbLabel: string;
  className?: string;
}) {
  return (
    <header className={cn('border-b border-line bg-surface', className)}>
      <div className="flex min-h-[52px] items-center gap-3 px-4 sm:px-6">
        <nav aria-label={breadcrumbLabel} className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-1.5 text-label-13 text-ink-3">
            {crumbs.map((c, i) => (
              <li key={i} className="flex min-w-0 items-center gap-1.5">
                {i > 0 ? <ChevronRight className="size-3.5 shrink-0 text-line-strong" strokeWidth={2} aria-hidden /> : null}
                {c.href ? (
                  <Link href={c.href} className="truncate hover:text-ink">
                    {c.label}
                  </Link>
                ) : (
                  <span className="truncate" aria-current={i === crumbs.length - 1 ? 'page' : undefined}>
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        {demo ? (
          <Tooltip content={demoHint}>
            <span tabIndex={0} className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-xs border border-dashed border-line-strong px-1.5 text-label-12 text-ink-3">
              <FlaskConical className="size-3.5" strokeWidth={1.75} aria-hidden />
              <span className="max-sm:sr-only">{demoLabel}</span>
            </span>
          </Tooltip>
        ) : null}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 pb-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="t-heading-20">{title}</h1>
          {meta ? <div className="mt-0.5 text-label-13 font-normal text-ink-3">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {tabs ? <div className="px-4 sm:px-6">{tabs}</div> : null}
    </header>
  );
}

/** Zone de contenu sous l'en-tête. */
export function PageBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('grid content-start gap-4 px-3 py-4 sm:px-6 sm:py-5', className)}>{children}</div>;
}
