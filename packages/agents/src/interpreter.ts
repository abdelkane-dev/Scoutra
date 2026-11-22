import { z } from 'zod';
import type { LlmClient, Usage } from '@scoutra/ai';
import {
  CONTACT_CHANNELS,
  PROSPECTING_MODELS,
  PROSPECTING_MODEL_CODES,
  PROSPECT_KINDS,
  SECTOR_CODES,
  SIGNAL_KEYS,
  isIsoCountry,
  targetSpecSchema,
  type TargetSpec,
} from '@scoutra/core';
import { DATA_POLICY_FR, userRequest } from './policy';
import { fold } from './text';

export const interpretInputSchema = z
  .object({
    promptText: z.string().trim().min(10).max(2000),
    locale: z.enum(['fr', 'en']),
    orgCountry: z.string().regex(/^[A-Z]{2}$/),
    accountType: z.string().max(40).nullable().optional(),
    sectors: z.array(z.string().max(40)).max(10).optional(),
  })
  .strict();
export type InterpretInput = z.infer<typeof interpretInputSchema>;

/** Schéma demandé au modèle (souple) ; la fiche est ensuite NORMALISÉE puis validée strictement. */
const llmSchema = z.object({
  model: z.enum(PROSPECTING_MODEL_CODES),
  kinds: z.array(z.enum(PROSPECT_KINDS)),
  summary: z.string(),
  language: z.enum(['fr', 'en']),
  countries: z.array(z.string()),
  regions: z.array(z.string()),
  keywords: z.array(z.string()),
  sectors: z.array(z.enum(SECTOR_CODES)),
  roles: z.array(z.string()),
  companySizeMin: z.number().nullable(),
  companySizeMax: z.number().nullable(),
  signals: z.array(z.object({ key: z.enum(SIGNAL_KEYS), required: z.boolean() })),
  exclusions: z.array(z.string()),
  channels: z.array(z.enum(CONTACT_CHANNELS)),
  clarifyingQuestions: z.array(z.string()),
  confidence: z.number(),
});

export interface InterpretResult {
  spec: TargetSpec;
  clarifyingQuestions: string[];
  confidence: number;
  /** `ai` ou `heuristic` (mode dégradé sans IA : fiche à relire par l'utilisateur). */
  method: 'ai' | 'heuristic';
  usage?: Usage;
}

const SYSTEM = `Tu es l'agent Interprète de Scoutra, outil de prospection commerciale.
Tu transformes la description libre d'une cible en fiche structurée.
Modèles de prospection possibles : ${PROSPECTING_MODELS.map((m) => m.code).join(', ')}.
Types d'entité : ${PROSPECT_KINDS.join(', ')}. Signaux : ${SIGNAL_KEYS.join(', ')}.
Pays : codes ISO 3166-1 alpha-2. Mots-clés : 1 à 6 termes de recherche concrets (activités, produits), dans la langue des sources du pays.
Particuliers (B2C, C2C…) : on ne cible que des signaux publics (ex. « je cherche un… ») et des lieux, jamais des listes de personnes.
Si la demande est ambiguë, pose au plus 3 questions de clarification courtes. confidence entre 0 et 1.

${DATA_POLICY_FR}`;

const uniq = <T>(a: T[]) => [...new Set(a)];
const texts = (a: string[], n: number, max: number) =>
  uniq(a.map((s) => s.replace(/\s+/g, ' ').trim().slice(0, max)).filter(Boolean)).slice(0, n);

/** Normalise une fiche brute (modèle ou interface) vers TargetSpec, avec repli sur le pays de l'organisation. */
export function normalizeSpec(raw: z.infer<typeof llmSchema>, fallbackCountry: string): TargetSpec {
  const countries = uniq(
    raw.countries.map((c) => c.trim().toUpperCase()).filter(isIsoCountry),
  ).slice(0, 20);
  const model = PROSPECTING_MODELS.find((m) => m.code === raw.model)!;
  const kinds = uniq(raw.kinds).slice(0, 4);
  const min =
    raw.companySizeMin && raw.companySizeMin > 0 ? Math.round(raw.companySizeMin) : undefined;
  const max =
    raw.companySizeMax && raw.companySizeMax > 0 ? Math.round(raw.companySizeMax) : undefined;
  return targetSpecSchema.parse({
    model: raw.model,
    kinds: kinds.length ? kinds : [...model.defaultKinds].slice(0, 4),
    summary: raw.summary.trim().slice(0, 300) || raw.keywords.join(', ').slice(0, 300) || 'Cible',
    language: raw.language,
    countries: countries.length ? countries : [fallbackCountry],
    regions: texts(raw.regions, 20, 100),
    keywords: texts(raw.keywords, 15, 60).length ? texts(raw.keywords, 15, 60) : ['entreprise'],
    sectors: uniq(raw.sectors).slice(0, 10),
    roles: texts(raw.roles, 10, 80),
    ...(min || max
      ? {
          companySize: { ...(min ? { min } : {}), ...(max && (!min || max >= min) ? { max } : {}) },
        }
      : {}),
    signals: uniq(raw.signals.map((s) => s.key))
      .slice(0, 10)
      .map((key) => ({ key, required: raw.signals.find((s) => s.key === key)!.required })),
    exclusions: texts(raw.exclusions, 20, 100),
    channels: uniq(raw.channels).slice(0, 6),
  });
}

const STOP = new Set(
  'je tu il nous vous des les une un le la de du en et ou a au aux pour avec dans sur qui que cherche trouver trouve veux voudrais besoin clients client prospects prospect entreprises entreprise societes the of for in and to find looking want need companies company customers leads with who that'.split(
    ' ',
  ),
);
const INDIVIDUAL_HINTS =
  /particulier|consommateur|grand public|personnes qui|individuals|consumers|people who|b2c/i;
const regionNames = new Intl.DisplayNames(['fr'], { type: 'region' });
const regionNamesEn = new Intl.DisplayNames(['en'], { type: 'region' });

/** Mode dégradé SANS IA : fiche approximative, à relire et corriger par l'utilisateur. */
export function heuristicInterpret(input: InterpretInput): InterpretResult {
  const text = fold(input.promptText);
  const countries: string[] = [];
  for (let a = 65; a <= 90; a++)
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      if (!isIsoCountry(code)) continue;
      for (const n of [regionNames.of(code), regionNamesEn.of(code)]) {
        if (
          n &&
          n.length > 3 &&
          new RegExp(`\\b${fold(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)
        )
          countries.push(code);
      }
    }
  const words = text.split(/[^a-z0-9-]+/).filter((w) => w.length > 2 && !STOP.has(w));
  const countryWords = new Set(
    countries.flatMap((c) => [regionNames.of(c), regionNamesEn.of(c)].map((n) => fold(n ?? ''))),
  );
  const keywords = uniq(words.filter((w) => !countryWords.has(w))).slice(0, 5);
  const individuals = INDIVIDUAL_HINTS.test(input.promptText);
  const spec = normalizeSpec(
    {
      model: individuals ? 'b2c' : 'b2b',
      kinds: individuals ? ['person'] : ['company'],
      summary: input.promptText.slice(0, 300),
      language: input.locale,
      countries,
      regions: [],
      keywords,
      sectors: [],
      roles: [],
      companySizeMin: null,
      companySizeMax: null,
      signals: individuals ? [{ key: 'public_request', required: false }] : [],
      exclusions: [],
      channels: individuals ? ['social_page'] : ['email', 'phone', 'website_form'],
      clarifyingQuestions: [],
      confidence: 0.2,
    },
    input.orgCountry,
  );
  return {
    spec,
    clarifyingQuestions: [
      input.locale === 'fr'
        ? 'Interprétation automatique indisponible (aucun modèle d’IA configuré) : vérifiez pays, villes et mots-clés.'
        : 'Automatic interpretation unavailable (no AI model configured): check countries, cities and keywords.',
    ],
    confidence: 0.2,
    method: 'heuristic',
  };
}

/** Agent Interprète : texte libre → TargetSpec (niveau `strong`, effort `medium`). */
export async function interpret(
  input: InterpretInput,
  llm: LlmClient,
  signal?: AbortSignal,
): Promise<InterpretResult> {
  const i = interpretInputSchema.parse(input);
  if (!llm.available) return heuristicInterpret(i);
  const context = [
    `Langue de l'interface : ${i.locale}`,
    `Pays de l'organisation (par défaut) : ${i.orgCountry}`,
    i.accountType ? `Type de compte de l'utilisateur : ${i.accountType}` : '',
    i.sectors?.length ? `Secteurs de l'utilisateur : ${i.sectors.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const r = await llm.generate({
    agent: 'interpreter',
    tier: 'strong',
    effort: 'medium',
    system: SYSTEM,
    input: `${context}\n\n${userRequest(i.promptText)}`,
    schema: llmSchema,
    maxOutputTokens: 4000,
    signal,
  });
  return {
    spec: normalizeSpec(r.output, i.orgCountry),
    clarifyingQuestions: texts(r.output.clarifyingQuestions, 3, 200),
    confidence: Math.max(0, Math.min(1, r.output.confidence)),
    method: 'ai',
    usage: r.usage,
  };
}
