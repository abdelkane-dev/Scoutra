import * as React from 'react';
import { cn } from '../lib/cn';

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('text-label-13 text-ink', className)} {...props} />;
}

/** Champ complet : libellé, contrôle, aide et erreur reliés par aria-describedby. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
  optional,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  optional?: React.ReactNode;
  className?: string;
  children: React.ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {optional ? <span className="text-label-12 text-ink-3">{optional}</span> : null}
      </div>
      {React.cloneElement(children, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
      {hint ? (
        <p id={hintId} className="text-label-12 font-normal text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-label-13 text-bad" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
