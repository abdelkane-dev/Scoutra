import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check, TriangleAlert, X, Minus } from 'lucide-react';
import { cn } from '../lib/cn';

/** Étiquette sobre : rectangle 4 px, pas de pilule (charte §10). */
export const badgeVariants = cva(
  'inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-xs px-1.5 text-label-12',
  {
    variants: {
      tone: {
        neutral: 'bg-sunken text-ink-2',
        outline: 'border border-line bg-surface text-ink-2',
        accent: 'bg-accent-soft text-accent-text',
        ink: 'bg-ink text-white',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/** État : toujours icône + mot (une couleur n'est jamais seule porteuse d'information). */
export type StatusTone = 'ok' | 'warn' | 'bad' | 'none';
const statusIcon = { ok: Check, warn: TriangleAlert, bad: X, none: Minus } as const;
const statusColor = {
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
  none: 'text-ink-3',
} as const;

export function Status({
  tone,
  children,
  className,
  soft,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
  soft?: boolean;
}) {
  const Icon = statusIcon[tone];
  const softBg = { ok: 'bg-ok-soft', warn: 'bg-warn-soft', bad: 'bg-bad-soft', none: 'bg-sunken' }[
    tone
  ];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap text-label-13',
        statusColor[tone],
        soft && cn('h-5 rounded-xs px-1.5 text-label-12', softBg),
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
      {children}
    </span>
  );
}

/** Code pays ISO dans un rectangle 4 px (pas d'emoji drapeau). */
export function CountryCode({
  code,
  title,
  className,
}: {
  code: string;
  title?: string;
  className?: string;
}) {
  return (
    <abbr
      title={title}
      className={cn(
        'inline-block min-w-[26px] rounded-xs bg-sunken px-[5px] text-center text-[11.5px] font-semibold leading-4 tracking-[0.02em] text-ink-2 no-underline',
        className,
      )}
    >
      {code}
    </abbr>
  );
}

/** Score : nombre tabulaire + jauge 40×4. */
export function Score({
  value,
  className,
  label,
}: {
  value: number;
  className?: string;
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <span
      className={cn('inline-flex items-center gap-2 text-label-14 font-semibold tnum', className)}
    >
      <span aria-label={label}>{v}</span>
      <span className="h-1 w-10 overflow-hidden rounded-[2px] bg-sunken" aria-hidden>
        <span
          className="block h-full origin-left rounded-[2px] bg-accent"
          style={{ transform: `scaleX(${v / 100})` }}
        />
      </span>
    </span>
  );
}

export function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-4 min-w-4 items-center justify-center rounded-[4px] border border-line bg-surface px-1 font-sans text-[11px] font-medium leading-4 text-ink-3',
        className,
      )}
      {...props}
    />
  );
}

/** Avatar : initiales (pas de photo de démonstration). */
export function Avatar({
  name,
  className,
  size = 'md',
}: {
  name: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-[#dfe3ea] font-semibold text-ink',
        size === 'sm' && 'size-5 text-[9.5px]',
        size === 'md' && 'size-[26px] text-[11px]',
        size === 'lg' && 'size-9 text-[13px]',
        className,
      )}
    >
      {initials}
    </span>
  );
}
