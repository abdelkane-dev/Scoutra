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
