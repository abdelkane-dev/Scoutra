import type { z } from 'zod';
import { agentsEnvSchema } from '@scoutra/config';
import type { ModelTier } from './types';

/**
 * Configuration IA (variables d'environnement, jamais en dur). SaaS : Anthropic. Licence : les
 * modèles du client (Anthropic avec sa clé, ou tout point d'accès compatible OpenAI : vLLM,
 * Ollama, Azure…). Sans clé : `none` → mode dégradé explicite (pas d'IA).
 */
export const aiEnvSchema = agentsEnvSchema.pick({
  SCOUTRA_AI_PROVIDER: true,
  ANTHROPIC_API_KEY: true,
  SCOUTRA_AI_BASE_URL: true,
  SCOUTRA_AI_API_KEY: true,
  SCOUTRA_AI_MODEL_FAST: true,
  SCOUTRA_AI_MODEL_BALANCED: true,
  SCOUTRA_AI_MODEL_STRONG: true,
});
export type AiEnv = z.infer<typeof aiEnvSchema>;

/** Identifiants Claude actuels (skill claude-api, table du 03/11/2026). */
export const DEFAULT_ANTHROPIC_MODELS: Record<ModelTier, string> = {
  fast: 'claude-haiku-5-5',
  balanced: 'claude-sonnet-5-5',
  strong: 'claude-opus-5-5',
};

export function modelsFor(env: AiEnv): Record<ModelTier, string> {
  const d =
    env.SCOUTRA_AI_PROVIDER === 'anthropic'
      ? DEFAULT_ANTHROPIC_MODELS
      : { fast: '', balanced: '', strong: '' };
  const fast = env.SCOUTRA_AI_MODEL_FAST ?? d.fast;
  const balanced = env.SCOUTRA_AI_MODEL_BALANCED ?? (d.balanced || fast);
  const strong = env.SCOUTRA_AI_MODEL_STRONG ?? (d.strong || balanced);
  return { fast, balanced, strong };
}
