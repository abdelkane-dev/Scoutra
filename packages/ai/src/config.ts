import { z } from 'zod';
import type { ModelTier } from './types';

/**
 * Configuration IA (variables d'environnement, jamais en dur). SaaS : Anthropic. Licence : les
 * modèles du client (Anthropic avec sa clé, ou tout point d'accès compatible OpenAI : vLLM,
 * Ollama, Azure…). Sans clé : `none` → mode dégradé explicite (pas d'IA).
 */
export const aiEnvSchema = z.object({
  SCOUTRA_AI_PROVIDER: z.enum(['anthropic', 'openai_compatible', 'none']).default('none'),
  ANTHROPIC_API_KEY: z.string().min(10).optional(),
  SCOUTRA_AI_BASE_URL: z.url().optional(),
  SCOUTRA_AI_API_KEY: z.string().min(1).optional(),
  SCOUTRA_AI_MODEL_FAST: z
    .string()
    .regex(/^[\w.:/-]{2,100}$/)
    .optional(),
  SCOUTRA_AI_MODEL_BALANCED: z
    .string()
    .regex(/^[\w.:/-]{2,100}$/)
    .optional(),
  SCOUTRA_AI_MODEL_STRONG: z
    .string()
    .regex(/^[\w.:/-]{2,100}$/)
    .optional(),
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
