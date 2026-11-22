import * as React from 'react';
import { cn } from '../lib/cn';

/** État vide : dit quoi faire ensuite, avec une action. Pas d'illustration. */
export function EmptyState({
  title,
  children,
  action,
  icon,
  className,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid justify-items-start gap-2 px-5 py-10 sm:px-8', className)}>
      {icon ? <div className="mb-1 text-ink-3 [&_svg]:size-5">{icon}</div> : null}
      <p className="t-heading-16">{title}</p>
      {children ? <p className="max-w-[56ch] text-copy-14 text-ink-2">{children}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

/** Squelette de chargement : bloc gris immobile (pas de scintillement animé). */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div aria-hidden className={cn('rounded-xs bg-sunken', className)} {...props} />;
}

export function SkeletonRows({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('divide-y divide-line', className)} role="status" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-11 items-center gap-4 px-4">
          <Skeleton className="size-4" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="ml-auto h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

export function Separator({ className, vertical }: { className?: string; vertical?: boolean }) {
  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      className={cn(vertical ? 'h-5 w-px bg-line' : 'h-px w-full bg-line', className)}
    />
  );
}

/** Panneau de l'app : bordure, pas d'ombre (rayon 10). */
export function Panel({ className, ...props }: React.ComponentProps<'section'>) {
  return (
    <section
      className={cn('min-w-0 rounded-lg border border-line bg-surface', className)}
      {...props}
    />
  );
}
export function PanelHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex min-h-[52px] flex-wrap items-center gap-2.5 border-b border-line px-4 py-2.5',
        className,
      )}
      {...props}
    />
  );
}
export function PanelTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 className={cn('text-[14.5px] font-semibold leading-5', className)} {...props} />;
}
