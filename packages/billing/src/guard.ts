import { COST_GUARD_THRESHOLDS } from './plans';

export type CostMode = 'normal' | 'economy' | 'free_only';

/** Mode du garde-fou de coût réel d'après le coût consommé dans la période (micro-dollars). */
export function costModeFor(spentMicroUsd: number, capUsd: number | null): CostMode {
  if (capUsd === null || capUsd <= 0) return 'normal';
  const ratio = spentMicroUsd / (capUsd * 1_000_000);
  if (ratio >= COST_GUARD_THRESHOLDS.freeOnly) return 'free_only';
  if (ratio >= COST_GUARD_THRESHOLDS.economy) return 'economy';
  return 'normal';
}
