import { z } from 'zod';
import type { LlmClient, Usage } from '@scoutra/ai';
import type { WebsiteFacts } from '@scoutra/connectors';
import { DATA_POLICY_FR, externalData } from './policy';

export const siteFactsSchema = z
  .object({
    summary: z.string().max(300),
    category: z.string().max(100),
    services: z.array(z.string().max(60)).max(8),
    languages: z.array(z.string().max(20)).max(5),
    sizeHint: z.enum(['solo', 'small', 'medium', 'large', 'unknown']),
    audience: z.enum(['businesses', 'consumers', 'both', 'unknown']),
  })
  .strict();
export type SiteFacts = z.infer<typeof siteFactsSchema>;

const SYSTEM = `Tu es l'agent Enrichissement de Scoutra. À partir du texte public du site d'une ENTREPRISE ou organisation, résume son activité de façon factuelle. Ne cite aucune personne nommée.

${DATA_POLICY_FR}`;

/** Extraction IA (niveau `fast`, effort `low`) depuis le texte du site, encapsulé comme donnée. */
export async function extractSiteFacts(
  facts: WebsiteFacts,
  llm: LlmClient,
  signal?: AbortSignal,
): Promise<{ facts: SiteFacts; usage: Usage } | null> {
  if (!llm.available || facts.pages.length === 0) return null;
  const text = facts.pages.map((p) => externalData(p.url, p.text, 4000)).join('\n');
  const r = await llm.generate({
    agent: 'enrichment',
    tier: 'fast',
    effort: 'low',
    system: SYSTEM,
    input: `Domaine : ${facts.domain}\n${text}`,
    schema: siteFactsSchema,
    maxOutputTokens: 1200,
    signal,
  });
  return { facts: r.output, usage: r.usage };
}
