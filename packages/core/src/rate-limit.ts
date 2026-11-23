/**
 * Limiteur à fenêtre glissante en mémoire (par processus). Sert de limite de débit par
 * organisation sur les routes métier. Avec plusieurs instances web, la limite effective est
 * multipliée par le nombre d'instances : à remplacer par un compteur Postgres si besoin.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000,
  ) {
    if (!Number.isInteger(max) || max < 1 || windowMs < 1)
      throw new Error('Limiteur mal configuré');
  }

  /** Enregistre un appel ; renvoie false si la limite est dépassée (l'appel n'est pas compté). */
  take(key: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length >= this.max) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.delete(key); // réinsertion = ordre d'usage récent
    this.hits.set(key, list);
    if (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest !== undefined) this.hits.delete(oldest);
    }
    return true;
  }
}

/**
 * Emplacements simultanés bornés par clé (ex. flux SSE par utilisateur et par organisation,
 * revue étape 2, constat 3). `acquire` renvoie une libération idempotente, ou null si plein.
 */
export class ConcurrencySlots {
  private readonly used = new Map<string, number>();
  acquire(limits: Record<string, number>): (() => void) | null {
    for (const [k, max] of Object.entries(limits)) if ((this.used.get(k) ?? 0) >= max) return null;
    for (const k of Object.keys(limits)) this.used.set(k, (this.used.get(k) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      for (const k of Object.keys(limits)) {
        const v = (this.used.get(k) ?? 1) - 1;
        if (v <= 0) this.used.delete(k);
        else this.used.set(k, v);
      }
    };
  }
  count(key: string): number {
    return this.used.get(key) ?? 0;
  }
}
