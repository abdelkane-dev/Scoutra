/**
 * Disjoncteur par connecteur (ARCHITECTURE §4.2) : N échecs dans la fenêtre → ouvert pendant
 * `cooldownMs` (le connecteur est écarté, mode dégradé), puis semi-ouvert : un essai décide.
 * En mémoire du worker : chaque processus protège ses propres appels.
 */
export type BreakerState = 'closed' | 'open' | 'half_open';

export class CircuitBreaker {
  private failures = new Map<string, number[]>();
  private openedAt = new Map<string, number>();

  constructor(
    private readonly opts: { threshold: number; windowMs: number; cooldownMs: number } = {
      threshold: 5,
      windowMs: 60_000,
      cooldownMs: 120_000,
    },
    private readonly now: () => number = Date.now,
  ) {}

  state(code: string): BreakerState {
    const at = this.openedAt.get(code);
    if (at === undefined) return 'closed';
    return this.now() - at >= this.opts.cooldownMs ? 'half_open' : 'open';
  }

  canCall(code: string): boolean {
    return this.state(code) !== 'open';
  }

  success(code: string): void {
    this.failures.delete(code);
    this.openedAt.delete(code);
  }

  failure(code: string): void {
    const t = this.now();
    if (this.state(code) === 'half_open') {
      this.openedAt.set(code, t);
      return;
    }
    const recent = (this.failures.get(code) ?? []).filter((x) => t - x < this.opts.windowMs);
    recent.push(t);
    this.failures.set(code, recent);
    if (recent.length >= this.opts.threshold) this.openedAt.set(code, t);
  }
}
