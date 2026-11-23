import { describe, expect, it } from 'vitest';
import { aiEnvSchema, costMicroUsd, createLlmClient, modelsFor } from '../src';

describe('configuration IA', () => {
  it('sans fournisseur : client indisponible (mode dégradé)', () => {
    expect(createLlmClient(aiEnvSchema.parse({})).available).toBe(false);
    expect(createLlmClient(aiEnvSchema.parse({ SCOUTRA_AI_PROVIDER: 'anthropic' })).available).toBe(
      false,
    );
  });
  it('trois niveaux : identifiants Claude actuels par défaut, surcharge par configuration (licence)', () => {
    expect(modelsFor(aiEnvSchema.parse({ SCOUTRA_AI_PROVIDER: 'anthropic' }))).toEqual({
      fast: 'claude-haiku-5-5',
      balanced: 'claude-sonnet-5-5',
      strong: 'claude-opus-5-5',
    });
    expect(
      modelsFor(
        aiEnvSchema.parse({
          SCOUTRA_AI_PROVIDER: 'openai_compatible',
          SCOUTRA_AI_MODEL_FAST: 'llama-3.3',
        }),
      ),
    ).toEqual({ fast: 'llama-3.3', balanced: 'llama-3.3', strong: 'llama-3.3' });
  });
  it('coût réel en micro-dollars (cache compris, Haiku > 100 K tokens ×5)', () => {
    expect(
      costMicroUsd('claude-haiku-5-5', {
        inputTokens: 1_000_000,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      }),
    ).toBe(500_000);
    expect(
      costMicroUsd('claude-haiku-5-5', {
        inputTokens: 1200,
        outputTokens: 500,
        cacheReadTokens: 1500,
        cacheWriteTokens: 0,
      }),
    ).toBe(385);
    expect(
      costMicroUsd('modele-du-client', {
        inputTokens: 9,
        outputTokens: 9,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      }),
    ).toBe(0);
  });
});

describe('constat 11 (étape 2) : coût d’un appel échoué', async () => {
  const { mockLlmClient, usageOfError, AiError } = await import('../src');
  const { z } = await import('zod');
  it('l’erreur emporte le coût facturé', async () => {
    const llm = mockLlmClient(() => ({ x: 'pas un nombre' }), { costMicroUsd: 42 });
    const err = await llm
      .generate({
        agent: 'a',
        tier: 'fast',
        effort: 'low',
        system: 's',
        input: 'i',
        schema: z.object({ x: z.number() }),
        maxOutputTokens: 10,
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(usageOfError(err)?.costMicroUsd).toBe(42);
    expect(usageOfError(new Error('x'))).toBeUndefined();
  });
});
