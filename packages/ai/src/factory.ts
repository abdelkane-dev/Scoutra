import type { z } from 'zod';
import { anthropicClient } from './anthropic';
import { modelsFor, type AiEnv } from './config';
import { openAiCompatibleClient } from './openai-compatible';
import { AiError, type GenerateRequest, type LlmClient } from './types';

/** Client « aucun fournisseur » : les agents passent en mode dégradé (règles déterministes). */
export const noAiClient: LlmClient = {
  provider: 'none',
  available: false,
  generate: () => Promise.reject(new AiError('unavailable', false)),
};

export function createLlmClient(env: AiEnv): LlmClient {
  const models = modelsFor(env);
  if (env.SCOUTRA_AI_PROVIDER === 'anthropic' && env.ANTHROPIC_API_KEY)
    return anthropicClient(env.ANTHROPIC_API_KEY, models);
  if (env.SCOUTRA_AI_PROVIDER === 'openai_compatible' && env.SCOUTRA_AI_BASE_URL && models.fast)
    return openAiCompatibleClient(env.SCOUTRA_AI_BASE_URL, env.SCOUTRA_AI_API_KEY, models);
  return noAiClient;
}

/** Modèle simulé pour les tests (aucun appel réseau) : réponse calculée par une fonction. */
export function mockLlmClient(
  respond: (req: GenerateRequest<z.ZodType>) => unknown,
  opts: { model?: string; costMicroUsd?: number } = {},
): LlmClient & { calls: GenerateRequest<z.ZodType>[] } {
  const calls: GenerateRequest<z.ZodType>[] = [];
  return {
    provider: 'mock',
    available: true,
    calls,
    async generate<S extends z.ZodType>(req: GenerateRequest<S>) {
      calls.push(req as unknown as GenerateRequest<z.ZodType>);
      const usage = {
        model: opts.model ?? `mock-${req.tier}`,
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costMicroUsd: opts.costMicroUsd ?? 10,
      };
      const parsed = req.schema.safeParse(respond(req as unknown as GenerateRequest<z.ZodType>));
      if (!parsed.success) {
        const e = new AiError('invalid_output', false);
        e.usage = usage; // comme le vrai fournisseur : l'appel a été facturé
        throw e;
      }
      return {
        output: parsed.data as z.infer<S>,
        usage,
      };
    },
  };
}
