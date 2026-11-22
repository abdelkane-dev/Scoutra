/**
 * Prix en micro-dollars par MILLION de tokens (entrée, sortie, lecture et écriture de cache).
 * Source : docs/offres/credits.md §1.1 (vérifiés le 22/11/2026 via le skill claude-api et la page
 * de prix Anthropic). À REVÉRIFIER avant la mise en production. Modèles inconnus (licence :
 * modèles du client) : coût 0 (payé par le client), journalisé tel quel.
 */
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-haiku-5-5': { input: 100_000, output: 500_000, cacheRead: 10_000, cacheWrite: 125_000 },
  'claude-sonnet-5-5': {
    input: 2_000_000,
    output: 10_000_000,
    cacheRead: 100_000,
    cacheWrite: 2_500_000,
  },
  'claude-opus-5-5': {
    input: 4_000_000,
    output: 20_000_000,
    cacheRead: 200_000,
    cacheWrite: 5_000_000,
  },
};

export function costMicroUsd(
  model: string,
  u: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  },
): number {
  const p = MODEL_PRICES[model];
  if (!p) return 0;
  // Haiku 5.5 : prompts > 100 K tokens facturés ×5 en entrée (credits.md §1.1).
  const longPrompt = model === 'claude-haiku-5-5' && u.inputTokens + u.cacheReadTokens > 100_000;
  const k = longPrompt ? 5 : 1;
  return Math.round(
    (u.inputTokens * p.input * k +
      u.outputTokens * p.output * k +
      u.cacheReadTokens * p.cacheRead * k +
      u.cacheWriteTokens * p.cacheWrite * k) /
      1_000_000,
  );
}
