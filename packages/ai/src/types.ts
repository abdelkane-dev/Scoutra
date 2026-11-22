import type { z } from 'zod';

/** Niveaux de modèle abstraits (ARCHITECTURE §3.1), résolus par configuration. */
export const MODEL_TIERS = ['fast', 'balanced', 'strong'] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];
export type Effort = 'low' | 'medium' | 'high';

export interface GenerateRequest<S extends z.ZodType> {
  /** Nom de l'agent (journalisation, coût). */
  agent: string;
  tier: ModelTier;
  effort: Effort;
  /** Partie STABLE (consignes, règles, schéma) : mise en cache (préfixe). Aucun secret. */
  system: string;
  /** Partie variable : données du prospect / texte de l'utilisateur (déjà encapsulées). */
  input: string;
  schema: S;
  maxOutputTokens: number;
  signal?: AbortSignal;
}

export interface Usage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Coût réel estimé (micro-dollars), journalisé dans usage_events. */
  costMicroUsd: number;
}

export interface GenerateResult<T> {
  output: T;
  usage: Usage;
}

export interface LlmClient {
  readonly provider: string;
  /** Faux si aucun fournisseur n'est configuré (mode dégradé : pas d'IA). */
  readonly available: boolean;
  generate<S extends z.ZodType>(req: GenerateRequest<S>): Promise<GenerateResult<z.infer<S>>>;
}

export class AiError extends Error {
  constructor(
    readonly code: 'unavailable' | 'refusal' | 'invalid_output' | 'rate_limited' | 'provider_error',
    readonly retryable: boolean,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'AiError';
  }
}
