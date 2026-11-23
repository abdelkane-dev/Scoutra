import { cn } from '@scoutra/ui';

/** Mini-courbe (une seule série, 2 px, sans axes) pour les tuiles chiffrées. */
export function Sparkline({
  values,
  className,
  label,
}: {
  values: number[];
  className?: string;
  label?: string;
}) {
  const w = 88;
  const h = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1)) * w},${h - 2 - ((v - min) / (max - min || 1)) * (h - 4)}`,
    )
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn('h-6 w-[88px]', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <polyline
        points={pts}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Avancement des 6 agents : segments pleins (terminés), segment courant en accent clair. */
export function AgentSteps({ done, label }: { done: number; label: string }) {
  return (
    <span className="inline-flex gap-[2px]" role="img" aria-label={label}>
      {Array.from({ length: 6 }, (_, i) => (
        <i
          key={i}
          className={cn(
            'h-1.5 w-4 rounded-[2px]',
            i < done ? 'bg-accent' : i === done ? 'bg-accent-line' : 'bg-sunken',
          )}
        />
      ))}
    </span>
  );
}

/** Barre horizontale simple (données → largeur), extrémité arrondie côté valeur. */
export function HBar({
  value,
  max,
  highlight = true,
  className,
}: {
  value: number;
  max: number;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('relative block h-2.5 rounded-[2px] bg-sunken', className)} aria-hidden>
      <i
        className={cn(
          'absolute inset-y-0 left-0 rounded-r-[4px]',
          highlight ? 'bg-accent' : 'bg-line-strong',
        )}
        style={{ width: `${Math.max(2, (value / max) * 100)}%` }}
      />
    </span>
  );
}
