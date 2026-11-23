import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { Output, generateText } from 'ai';
import type { z } from 'zod';
import { AiError, type GenerateRequest, type LlmClient, type ModelTier } from './types';

/**
 * Mode licence : modèles du client via l'AI SDK (point d'accès compatible OpenAI configuré par
 * l'exploitant). Coût : payé par le client (0 dans usage_events, tokens journalisés).
 */
export function openAiCompatibleClient(
  baseURL: string,
  apiKey: string | undefined,
  models: Record<ModelTier, string>,
): LlmClient {
  const provider = createOpenAICompatible({ name: 'customer', baseURL, apiKey });
  return {
    provider: 'openai_compatible',
    available: true,
    async generate<S extends z.ZodType>(req: GenerateRequest<S>) {
      const model = models[req.tier];
      try {
        const r = await generateText({
          model: provider(model),
          output: Output.object({ schema: req.schema }),
          system: req.system,
          prompt: req.input,
          maxOutputTokens: req.maxOutputTokens,
          abortSignal: req.signal,
          maxRetries: 2,
        });
        const checked = req.schema.safeParse(r.output);
        if (!checked.success) {
          const e = new AiError('invalid_output', false);
          e.usage = {
            model,
            inputTokens: r.usage.inputTokens ?? 0,
            outputTokens: r.usage.outputTokens ?? 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            costMicroUsd: 0,
          };
          throw e;
        }
        return {
          output: checked.data as z.infer<S>,
          usage: {
            model,
            inputTokens: r.usage.inputTokens ?? 0,
            outputTokens: r.usage.outputTokens ?? 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            costMicroUsd: 0,
          },
        };
      } catch (err) {
        if (err instanceof AiError) throw err;
        throw new AiError('provider_error', true);
      }
    },
  };
}
