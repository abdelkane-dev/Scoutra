import 'server-only';
import { createLlmClient, type LlmClient } from '@scoutra/ai';
import { getEnv } from './env';

const g = globalThis as typeof globalThis & { __scoutraLlm?: LlmClient };

/** Client IA du web (régénération d'un brouillon) ; indisponible = message modèle. */
export function llm(): LlmClient {
  g.__scoutraLlm ??= createLlmClient(getEnv());
  return g.__scoutraLlm;
}
