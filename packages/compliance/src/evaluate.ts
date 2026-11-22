import type { ContactChannel, LegalBasis } from '@scoutra/core';
import { RULESETS } from './rules.generated';
import type { Conditions, Ruleset } from './schema';

/**
 * Garde-fou juridique DÉTERMINISTE (aucune IA ne décide) : appliqué avant toute proposition
 * de canal, avant la rédaction et avant la copie d'un message. Résolution : pays du destinataire
 * + bloc régional (UE, CEDEAO) + pays de l'émetteur → la règle LA PLUS STRICTE l'emporte.
 */
export interface ComplianceContext {
  recipientCountry: string;
  senderCountry: string;
  /** `individual` : particulier (ou indépendant au Royaume-Uni) ; `business` : personne morale. */
  audience: 'individual' | 'business';
  channel: ContactChannel;
  legalBasis?: LegalBasis;
  /** Preuve de consentement horodatée (formulaire Scoutra, opt-in Meta…). */
  consentProof?: boolean;
}

export type Outcome = 'allow' | 'allow_with_conditions' | 'manual_only' | 'deny';

export interface ComplianceDecision {
  outcome: Outcome;
  channel: ContactChannel;
  conditions: Conditions & { retentionDays: number; maxFollowUps: number };
  /** Règles appliquées (identifiants) et juridictions consultées avec leur version. */
  ruleIds: string[];
  rulesetVersions: string[];
  /** Codes lisibles (traduits par l'interface). */
  reasons: string[];
  warnings: 'country_not_covered'[];
}

const SEVERITY: Record<Outcome, number> = {
  allow: 0,
  allow_with_conditions: 1,
  manual_only: 2,
  deny: 3,
};

function byJurisdiction(j: string): Ruleset | undefined {
  return RULESETS.find((r) => r.jurisdiction === j);
}

/** Jeux de règles applicables à un pays : national + blocs régionaux, ou DEFAULT. */
export function rulesetsFor(country: string): { sets: Ruleset[]; covered: boolean } {
  const sets: Ruleset[] = [];
  const national = byJurisdiction(country);
  if (national) sets.push(national);
  for (const r of RULESETS) if (r.members?.includes(country)) sets.push(r);
  if (sets.length === 0) return { sets: [byJurisdiction('DEFAULT')!], covered: false };
  return { sets, covered: true };
}

export function evaluate(ctx: ComplianceContext): ComplianceDecision {
  const recipient = rulesetsFor(ctx.recipientCountry);
  const sender = rulesetsFor(ctx.senderCountry);
  const sets = [
    ...new Map([...recipient.sets, ...sender.sets].map((s) => [s.jurisdiction, s])).values(),
  ];
  let outcome: Outcome = 'deny';
  let matchedAny = false;
  const conditions: ComplianceDecision['conditions'] = {
    retentionDays: Math.min(...sets.map((s) => s.retentionDays)),
    maxFollowUps: Math.min(...sets.map((s) => s.maxFollowUps)),
  };
  const ruleIds: string[] = [];
  const reasons: string[] = [];
  let worst = -1;
  for (const set of sets) {
    const rule = set.rules.find(
      (r) => r.channels.includes(ctx.channel) && (!r.audience || r.audience === ctx.audience),
    );
    let o: Outcome;
    if (!rule) {
      // Juridiction muette sur ce canal : ignorée ; si AUCUNE ne le prévoit, refus (plus bas).
      continue;
    } else {
      matchedAny = true;
      ruleIds.push(rule.id);
      if (rule.outcome === 'deny_unless_consent') {
        const ok = ctx.legalBasis === 'consent' && ctx.consentProof === true;
        o = ok ? 'allow_with_conditions' : 'deny';
        reasons.push(ok ? 'consent_proven' : 'consent_required');
        if (ok) Object.assign(conditions, { requireOptOut: true, requireIdentification: true });
      } else {
        o = rule.outcome;
        if (o === 'manual_only') reasons.push('manual_public_channel');
        for (const [k, v] of Object.entries(rule.conditions ?? {})) {
          if (k === 'footer') conditions.footer ??= v as Conditions['footer'];
          else if (v === true) (conditions as Record<string, unknown>)[k] = true;
        }
      }
    }
    if (SEVERITY[o] > worst) {
      worst = SEVERITY[o];
      outcome = o;
    }
  }
  if (!matchedAny) {
    outcome = 'deny';
    reasons.push('no_rule_for_channel');
  }
  return {
    outcome,
    channel: ctx.channel,
    conditions,
    ruleIds,
    rulesetVersions: sets.map((s) => `${s.jurisdiction}@${s.version}`),
    reasons: [...new Set(reasons)],
    warnings: recipient.covered ? [] : ['country_not_covered'],
  };
}

/** Canaux proposables (le reste n'est jamais affiché comme canal de contact). */
export function allowedChannels(
  base: Omit<ComplianceContext, 'channel'>,
  channels: readonly ContactChannel[],
): { channel: ContactChannel; decision: ComplianceDecision }[] {
  return channels
    .map((channel) => ({ channel, decision: evaluate({ ...base, channel }) }))
    .filter((c) => c.decision.outcome !== 'deny');
}

/** Pied de page légal injecté par le CODE (jamais par l'IA), selon la langue. */
export function legalFooter(
  footer: Conditions['footer'],
  lang: 'fr' | 'en',
  sender: { name: string; address?: string },
): string {
  if (!footer) return '';
  const optOut =
    lang === 'fr'
      ? 'Si vous ne souhaitez plus recevoir de messages de notre part, répondez « STOP ».'
      : 'If you no longer wish to hear from us, reply "STOP".';
  const who = lang === 'fr' ? `Message envoyé par ${sender.name}` : `Sent by ${sender.name}`;
  const address = sender.address ? ` — ${sender.address}` : '';
  const notice: Record<NonNullable<Conditions['footer']>, Record<'fr' | 'en', string>> = {
    eu_notice: {
      fr: 'Vos coordonnées professionnelles proviennent de sources publiques (intérêt légitime, RGPD art. 6.1.f). Vous pouvez vous y opposer à tout moment.',
      en: 'Your business contact details come from public sources (legitimate interest, GDPR art. 6(1)(f)). You may object at any time.',
    },
    uk_notice: {
      fr: 'Coordonnées professionnelles issues de sources publiques (UK GDPR). Vous pouvez vous y opposer à tout moment.',
      en: 'Business contact details from public sources (UK GDPR). You may object at any time.',
    },
    ca_notice: {
      fr: 'Adresse professionnelle publiée sans mention de refus (LCAP).',
      en: 'Business address published without a statement refusing messages (CASL).',
    },
    us_notice: { fr: '', en: '' },
    generic_notice: {
      fr: 'Coordonnées professionnelles issues de sources publiques.',
      en: 'Business contact details from public sources.',
    },
  };
  return [`${who}${address}.`, notice[footer][lang], optOut].filter(Boolean).join('\n');
}
