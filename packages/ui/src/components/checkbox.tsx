'use client';
import * as React from 'react';
import { Checkbox as CheckboxPrimitive, Switch as SwitchPrimitive } from 'radix-ui';
import { Check, Minus } from 'lucide-react';
import { cn } from '../lib/cn';

export function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer relative grid size-4 shrink-0 place-items-center rounded-xs border border-line-strong bg-surface outline-none transition-colors before:absolute before:-inset-3 before:content-[""] hover:border-ink-3 data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[state=indeterminate]:border-ink data-[state=indeterminate]:bg-ink disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-white">
        {props.checked === 'indeterminate' ? (
          <Minus className="size-3" strokeWidth={2.5} aria-hidden />
        ) : (
          <Check className="size-3" strokeWidth={2.5} aria-hidden />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-line-strong outline-none transition-colors before:absolute before:-inset-3 before:content-[""] data-[state=checked]:bg-ink disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-[120ms] data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}
