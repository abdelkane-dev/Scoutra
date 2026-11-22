import { cn } from '@scoutra/ui';

/** Conteneur de la landing : 1280 px, marges 20/32/40 px. */
export function Wrap({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('relative mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-10', className)}>
      {children}
    </div>
  );
}

/** Filets verticaux pointillés aux deux bords du conteneur (grille visible, référence Stripe). */
export function Rails({
  dark,
  className,
  children,
  ...props
}: React.ComponentProps<'section'> & { dark?: boolean }) {
  const rail = cn(
    'pointer-events-none absolute inset-y-0 hidden w-0 border-l border-dashed lg:block',
    dark ? 'border-dark-line' : 'border-line-strong/70',
  );
  return (
    <section className={cn('relative', className)} {...props}>
      <span aria-hidden className={cn(rail, 'left-[max(20px,calc(50%-620px))]')} />
      <span aria-hidden className={cn(rail, 'right-[max(20px,calc(50%-620px))]')} />
      {children}
    </section>
  );
}

export function Grid12({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('grid grid-cols-12 gap-x-6', className)}>{children}</div>;
}
