import * as React from 'react';
import { cn } from '../lib/cn';

export const fieldBase =
  'w-full min-w-0 rounded-sm border border-line-strong bg-surface text-copy-14 text-ink placeholder:text-ink-3 outline-none transition-[border-color,box-shadow] duration-[120ms] focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/35 disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3 aria-[invalid=true]:border-bad';

export function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(fieldBase, 'h-9 px-3 max-sm:h-11', className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldBase, 'min-h-20 px-3 py-2 leading-[22px]', className)}
      {...props}
    />
  );
}
