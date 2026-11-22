import type { LlmClient, Usage } from '@scoutra/ai';
import { DATA_POLICY_FR, externalData } from './policy';
import {
  aiAdjustmentSchema,
  computeBaseScore,
  finalizeScore,
  type ScoreResult,
  type ScoringInput,
} from './scoring';

const SYSTEM = `Tu es l'agent Notation de Scoutra. Un score de base a été calculé par des règles. Propose un AJUSTEMENT entier entre -20 et +20 selon l'adéquation réelle du prospect à la cible (activité réellement correspondante ou non), avec une raison courte et factuelle.

${DATA_POLICY_FR}`;

/**
 * Agent Notation : score de base déterministe ; ajustement IA (niveau `fast`, effort `low`)
 * seulement pour les cas limites (base entre 35 et 75) afin de maîtriser le coût.
 */
export async function scoreProspect(
  input: ScoringInput,
  llm: LlmClient,
  opts: { allowAi: boolean; signal?: AbortSignal } = { allowAi: true },
): Promise<{ result: ScoreResult; usage?: Usage }> {
  const base = computeBaseScore(input);
  if (!opts.allowAi || !llm.available || base.disqualified || base.base < 35 || base.base > 75)
    return { result: finalizeScore(base) };
  const p = input.prospect;
  const r = await llm.generate({
    agent: 'scoring',
    tier: 'fast',
    effort: 'low',
    system: SYSTEM,
    input: [
      `Cible : ${input.spec.summary}`,
      `Mots-clés : ${input.spec.keywords.join(', ')}`,
      `Score de base : ${base.base}/100`,
      externalData(
        'prospect',
        [p.displayName, p.category, p.description, p.city].filter(Boolean).join('\n'),
        2000,
      ),
    ].join('\n'),
    schema: aiAdjustmentSchema,
    maxOutputTokens: 600,
    signal: opts.signal,
  });
  return { result: finalizeScore(base, r.output), usage: r.usage };
}
