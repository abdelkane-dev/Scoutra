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
