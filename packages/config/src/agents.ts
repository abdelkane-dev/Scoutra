import { z } from 'zod';

const key = z.string().min(8).max(500).optional();
const modelId = z
  .string()
  .regex(/^[\w.:/-]{2,100}$/)
  .optional();

/**
 * Configuration du cerveau de recherche (web + worker). Toutes les clés sont FACULTATIVES :
 * sans clé, le système fonctionne en mode dégradé explicite (sources gratuites : OSM,
 * registres, crt.sh, SearXNG s'il est configuré ; interprétation heuristique sans IA).
 */
export const agentsEnvSchema = z.object({
  // IA (SaaS : Anthropic ; licence : modèles du client)
  SCOUTRA_AI_PROVIDER: z.enum(['anthropic', 'openai_compatible', 'none']).default('none'),
  ANTHROPIC_API_KEY: key,
  SCOUTRA_AI_BASE_URL: z.url().optional(),
  SCOUTRA_AI_API_KEY: key,
  SCOUTRA_AI_MODEL_FAST: modelId,
  SCOUTRA_AI_MODEL_BALANCED: modelId,
  SCOUTRA_AI_MODEL_STRONG: modelId,
  // Recherche web : ordre de préférence des moteurs
  SCOUTRA_SEARCH_PROVIDERS: z
    .string()
    .default('searxng,serper,brave,tavily')
    .transform((v) => v.split(',').map((s) => s.trim()))
    .pipe(z.array(z.enum(['searxng', 'serper', 'brave', 'tavily'])).min(1)),
  SERPER_API_KEY: key,
  BRAVE_API_KEY: key,
  TAVILY_API_KEY: key,
  GOOGLE_PLACES_API_KEY: key,
  COMPANIES_HOUSE_API_KEY: key,
  // Services internes (URL fixées par l'exploitant)
  SCOUTRA_SEARXNG_URL: z.url().optional(),
  SCOUTRA_OVERPASS_URL: z.url().optional(),
  SCOUTRA_CRAWL4AI_URL: z.url().optional(),
  SCOUTRA_REACHER_URL: z.url().optional(),
});
export type AgentsEnv = z.infer<typeof agentsEnvSchema>;

/** Fournisseur de connecteur → variable de clé plateforme. */
export const PLATFORM_KEYS: Record<string, keyof AgentsEnv> = {
  serper: 'SERPER_API_KEY',
  brave: 'BRAVE_API_KEY',
  tavily: 'TAVILY_API_KEY',
  google_places: 'GOOGLE_PLACES_API_KEY',
  companies_house: 'COMPANIES_HOUSE_API_KEY',
};
