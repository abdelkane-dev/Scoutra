import { z } from 'zod';
import type { ContactChannel, SignalKey, TargetSpec, VerificationStatus } from '@scoutra/core';
import { containsTerm } from './text';

/**
 * Notation HYBRIDE (ARCHITECTURE §3.2) : sous-scores calculés par le code (reproductibles,
 * testés) + ajustement IA borné à ±20, puis bornage 0..100. Raisons lisibles par critère.
 */
export interface ScoringInput {
  spec: TargetSpec;
  prospect: {
    kind: string;
    displayName: string;
    countryCode: string;
    city?: string | null;
    category?: string | null;
    description?: string | null;
    signals: { key: SignalKey; observedAt?: string }[];
    contacts: { channel: ContactChannel; status: VerificationStatus | 'valid_phone' | 'manual' }[];
    evidenceCount: number;
    websiteReachable?: boolean;
  };
  now: Date;
}

export interface Reason {
  criterion: 'fit' | 'signals' | 'reachability' | 'quality' | 'ai_adjustment' | 'exclusion';
  points: number;
  max: number;
  /** Code de constat traduisible + paramètres. */
  finding: string;
  params?: Record<string, string | number>;
}

export interface ScoreResult {
  score: number;
  base: number;
  aiAdjustment: number;
  reasons: Reason[];
  disqualified: boolean;
}

const SIGNAL_STRENGTH: Partial<Record<SignalKey, number>> = {
  public_request: 12,
  public_tender: 12,
  funding: 10,
  hiring: 8,
  new_company: 8,
  new_domain: 7,
  new_location: 7,
  leadership_change: 6,
  product_launch: 6,
  recent_reviews: 4,
  no_website: 5,
  outdated_website: 5,
  insolvency: 6,
  event_participation: 5,
  active_listing: 8,
};

function freshness(observedAt: string | undefined, now: Date): number {
  if (!observedAt) return 0.5;
  const t = Date.parse(observedAt);
  if (Number.isNaN(t)) return 0.5;
  const days = (now.getTime() - t) / 86_400_000;
  if (days <= 30) return 1;
  if (days <= 90) return 0.7;
  if (days <= 365) return 0.4;
  return 0.15;
}

export function computeBaseScore(input: ScoringInput): Omit<ScoreResult, 'aiAdjustment' | 'score'> {
  const { spec, prospect: p, now } = input;
  const reasons: Reason[] = [];
  const text = [p.displayName, p.category ?? '', p.description ?? ''].join(' ');

  const excluded = spec.exclusions.find((e) => containsTerm(text, e));
  if (excluded) {
    reasons.push({
      criterion: 'exclusion',
      points: 0,
      max: 0,
      finding: 'excluded_term',
      params: { term: excluded },
    });
    return { base: 0, reasons, disqualified: true };
  }

  // Adéquation (0..35)
  let fit = 0;
  if (spec.countries.includes(p.countryCode)) fit += 10;
  const regionOk =
    spec.regions.length === 0 ||
    (p.city && spec.regions.some((r) => containsTerm(p.city!, r) || containsTerm(r, p.city!)));
  if (regionOk) fit += 5;
  if ((spec.kinds as string[]).includes(p.kind)) fit += 5;
  const matched = spec.keywords.filter((k) => containsTerm(text, k));
  fit += matched.length >= 2 ? 15 : matched.length === 1 ? 10 : 0;
  reasons.push({
    criterion: 'fit',
    points: fit,
    max: 35,
    finding: matched.length ? 'keywords_matched' : 'keywords_not_found',
    params: { matched: matched.join(', ') },
  });

  // Signaux (0..25) : force × fraîcheur ; signal requis absent → plafond.
  const seen = new Map<SignalKey, number>();
  for (const s of p.signals) {
    const v = (SIGNAL_STRENGTH[s.key] ?? 3) * freshness(s.observedAt, now);
    seen.set(s.key, Math.max(seen.get(s.key) ?? 0, v));
  }
  const wanted = new Set(spec.signals.map((s) => s.key));
  let sig = 0;
  for (const [k, v] of seen) sig += wanted.has(k) ? v * 1.5 : v;
  const signals = Math.min(25, Math.round(sig));
  reasons.push({
    criterion: 'signals',
    points: signals,
    max: 25,
    finding: seen.size ? 'signals_found' : 'no_signal',
    params: { signals: [...seen.keys()].join(', ') },
  });
  const missingRequired = spec.signals
    .filter((s) => s.required && !seen.has(s.key))
    .map((s) => s.key);

  // Joignabilité (0..25) : meilleur canal vérifié.
  const pts = (c: ScoringInput['prospect']['contacts'][number]) => {
    if (c.channel === 'email')
      return (
        { valid: 25, accept_all: 14, unknown: 12, risky: 10, webmail: 10 }[c.status as string] ?? 0
      );
    if (c.channel === 'phone' || c.channel === 'whatsapp')
      return c.status === 'valid_phone' ? 20 : 0;
    return c.status === 'manual' ? 8 : 0;
  };
  const reach = Math.max(0, ...p.contacts.map(pts));
  reasons.push({
    criterion: 'reachability',
    points: reach,
    max: 25,
    finding: reach >= 20 ? 'verified_contact' : reach > 0 ? 'partial_contact' : 'no_contact',
  });

  // Qualité des données (0..15)
  const quality = Math.min(10, p.evidenceCount * 2) + (p.websiteReachable ? 5 : 0);
  reasons.push({
    criterion: 'quality',
    points: quality,
    max: 15,
    finding: 'evidence_count',
    params: { count: p.evidenceCount },
  });

  let base = fit + signals + reach + quality;
  if (missingRequired.length) {
    base = Math.min(base, 50);
    reasons.push({
      criterion: 'signals',
      points: 0,
      max: 0,
      finding: 'required_signal_missing',
      params: { signals: missingRequired.join(', ') },
    });
  }
  return { base: Math.max(0, Math.min(100, base)), reasons, disqualified: false };
}

export const aiAdjustmentSchema = z
  .object({
    adjustment: z.int().min(-20).max(20),
    reason: z.string().min(1).max(300),
  })
  .strict();

/** Score final : base + ajustement IA borné à ±20, puis 0..100. */
export function finalizeScore(
  base: Omit<ScoreResult, 'aiAdjustment' | 'score'>,
  ai?: { adjustment: number; reason: string },
): ScoreResult {
  if (base.disqualified) return { ...base, score: 0, aiAdjustment: 0 };
  const adj = ai ? Math.max(-20, Math.min(20, Math.round(ai.adjustment))) : 0;
  const reasons = ai
    ? [
        ...base.reasons,
        {
          criterion: 'ai_adjustment' as const,
          points: adj,
          max: 20,
          finding: 'ai_judgement',
          params: { reason: ai.reason.slice(0, 300) },
        },
      ]
    : base.reasons;
  return {
    ...base,
    reasons,
    aiAdjustment: adj,
    score: Math.max(0, Math.min(100, base.base + adj)),
  };
}
