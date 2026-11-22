import * as React from 'react';
import { cn } from '../lib/cn';

/** Tableau dense : en-tête label-13 sur fond sunken, lignes 44 px, filet entre lignes. */
export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-copy-14', className)} {...props} />
    </div>
  );
}
export function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={cn('bg-sunken', className)} {...props} />;
}
export function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}
export function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'h-11 border-b border-line transition-colors hover:bg-[#fafafb] data-[state=selected]:bg-accent-soft data-[active=true]:bg-accent-soft data-[active=true]:shadow-[inset_2px_0_0_var(--accent)]',
        className,
      )}
      {...props}
    />
  );
}
export function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn(
        'h-9 whitespace-nowrap px-3 text-left align-middle text-label-13 text-ink-3 first:pl-4 last:pr-4',
        className,
      )}
      {...props}
    />
  );
}
export function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      className={cn('whitespace-nowrap px-3 align-middle first:pl-4 last:pr-4', className)}
      {...props}
    />
  );
}
export function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return <caption className={cn('sr-only', className)} {...props} />;
}
