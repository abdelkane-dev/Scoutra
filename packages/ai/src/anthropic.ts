import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import { costMicroUsd } from './pricing';
import { AiError, type GenerateRequest, type LlmClient, type ModelTier } from './types';

/**
 * Fournisseur Anthropic via le SDK officiel : sortie structurée (`output_config.format`, pas de
 * tool_choice forcé, refusé sur Opus/Sonnet 5.5), effort explicite (défaut `medium` sinon sur
 * Opus 5.5 et Haiku 5.5), prompt caching sur le préfixe stable (consignes + schéma).
 * La sortie est REVALIDÉE par le schéma Zod strict (une seconde tentative, puis échec propre).
 */
export function anthropicClient(apiKey: string, models: Record<ModelTier, string>): LlmClient {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  return {
    provider: 'anthropic',
    available: true,
    async generate<S extends z.ZodType>(req: GenerateRequest<S>) {
      const model = models[req.tier];
      let lastError = '';
      const totals = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
      // Toute erreur après un appel facturé emporte son coût (journalisé par l'appelant).
      const fail = (e: AiError): never => {
        if (totals.inputTokens + totals.outputTokens > 0)
          e.usage = { model, ...totals, costMicroUsd: costMicroUsd(model, totals) };
        throw e;
      };
      for (let attempt = 0; attempt < 2; attempt++) {
        let res;
        try {
          res = await client.messages.parse(
            {
              model,
              max_tokens: req.maxOutputTokens,
              output_config: { format: zodOutputFormat(req.schema), effort: req.effort },
              system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
              messages: [
                {
                  role: 'user',
                  content:
                    attempt === 0
                      ? req.input
                      : `${req.input}\n\n[Correction demandée : ${lastError}]`,
                },
              ],
            },
            { signal: req.signal },
          );
        } catch (err) {
          if (err instanceof Anthropic.RateLimitError)
            return fail(new AiError('rate_limited', true));
          if (err instanceof Anthropic.APIError)
            return fail(
              new AiError('provider_error', (err.status ?? 500) >= 500, `HTTP ${err.status}`),
            );
          return fail(new AiError('provider_error', true));
        }
        totals.inputTokens += res.usage.input_tokens;
        totals.outputTokens += res.usage.output_tokens;
        totals.cacheReadTokens += res.usage.cache_read_input_tokens ?? 0;
        totals.cacheWriteTokens += res.usage.cache_creation_input_tokens ?? 0;
        if (res.stop_reason === 'refusal') return fail(new AiError('refusal', false));
        const checked = req.schema.safeParse(res.parsed_output);
        if (checked.success) {
          return {
            output: checked.data,
            usage: { model, ...totals, costMicroUsd: costMicroUsd(model, totals) },
          };
        }
        lastError = checked.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join('.')}: ${i.code}`)
          .join('; ');
      }
      return fail(new AiError('invalid_output', false, lastError));
    },
  };
}
