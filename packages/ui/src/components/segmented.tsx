'use client';
import * as React from 'react';
import { cn } from '../lib/cn';

/** Contrôle segmenté (aria-pressed) : piste sunken, segment actif blanc bordé. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: React.ReactNode; disabled?: boolean }[];
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex gap-0.5 rounded-md bg-sunken p-[3px]', className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border border-transparent font-medium text-ink-2 transition-colors hover:text-ink disabled:opacity-50 aria-pressed:border-line aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-[0_1px_1px_rgba(18,20,26,.05)] [&_svg]:size-3.5',
            size === 'md'
              ? 'min-h-[30px] px-[11px] text-[13.5px] max-sm:min-h-[38px]'
              : 'min-h-6 px-2 text-label-12 max-sm:min-h-8',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
