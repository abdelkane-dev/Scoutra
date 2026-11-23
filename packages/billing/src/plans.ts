/**
 * CONFIGURATION UNIQUE de la facturation (docs/offres/credits.md, barème du 22/11/2026).
 * Toute valeur commerciale (crédits, quotas, packs, garde-fou de coût) vit ICI et nulle part
 * ailleurs : l'interface la lit via l'API, le serveur l'applique (contrôle côté serveur).
 */
export const MILLICREDITS_PER_CREDIT = 1000;

export type PlanCode = 'research' | 'pipeline';

export interface PlanConfig {
  code: PlanCode;
  priceUsdMonthly: number;
  monthlyCredits: number;
  includedSeats: number;
  extraSeatPriceUsd: number | null;
  extraSeatCredits: number;
  concurrentCampaigns: number;
  maxProspectsPerCampaign: number;
  dailyProspectCap: number;
  /** Part de l'octroi mensuel reportée UN mois. */
  rolloverRatio: number;
  /** Plafond de coût RÉEL (USD) par organisation et par période (garde-fou §4.6). */
  costGuardUsd: number;
  pipeline: boolean;
  interpretationsPerDay: number;
}

export const PLANS: Record<PlanCode, PlanConfig> = {
  research: {
    code: 'research',
    priceUsdMonthly: 19.99,
    monthlyCredits: 1000,
    includedSeats: 1,
    extraSeatPriceUsd: null,
    extraSeatCredits: 0,
    concurrentCampaigns: 2,
    maxProspectsPerCampaign: 500,
    dailyProspectCap: 150,
    rolloverRatio: 0.5,
    costGuardUsd: 9,
    pipeline: false,
    interpretationsPerDay: 20,
  },
  pipeline: {
    code: 'pipeline',
    priceUsdMonthly: 49.99,
    monthlyCredits: 3000,
    includedSeats: 3,
    extraSeatPriceUsd: 9.99,
    extraSeatCredits: 500,
    concurrentCampaigns: 5,
    maxProspectsPerCampaign: 1500,
    dailyProspectCap: 400,
    rolloverRatio: 0.5,
    costGuardUsd: 26,
    pipeline: true,
    interpretationsPerDay: 50,
  },
};

export interface PackConfig {
  code: 'pack_500' | 'pack_2500' | 'pack_10000';
  credits: number;
  priceUsd: number;
  validityMonths: number;
  /** Plafond de coût réel ajouté au garde-fou : 50 % du prix du pack. */
  costGuardUsd: number;
}

export const PACKS: readonly PackConfig[] = [
  { code: 'pack_500', credits: 500, priceUsd: 14.99, validityMonths: 12, costGuardUsd: 7.5 },
  { code: 'pack_2500', credits: 2500, priceUsd: 59, validityMonths: 12, costGuardUsd: 29.5 },
  { code: 'pack_10000', credits: 10000, priceUsd: 199, validityMonths: 12, costGuardUsd: 99.5 },
];

/** Prix d'un prospect livré, en crédits, selon la qualité du message. */
export const DELIVERY_CREDITS = { standard: 1, careful: 2, premium: 4 } as const;
export type DeliveryQuality = keyof typeof DELIVERY_CREDITS;

/** Essai sans carte (anti-abus : coût réel plafonné). */
export const TRIAL = { credits: 100, costGuardUsd: 1, plan: 'research' as PlanCode };

/** Seuils du garde-fou : bascule économique à 70 %, sources gratuites seules à 100 %. */
export const COST_GUARD_THRESHOLDS = { economy: 0.7, freeOnly: 1 } as const;

/**
 * Borne de coût réel PAR CAMPAGNE (revue étape 2, constat 4) : 2 × le coût cible par crédit
 * (≈ 0,019 $) appliqué aux crédits réservés, avec un minimum pour l'interprétation et la recherche.
 */
export const CAMPAIGN_COST_CAP = { usdPerReservedCredit: 0.04, minUsd: 0.5 } as const;

export function campaignCostCapMicroUsd(reservedMc: number): number {
  const credits = reservedMc / MILLICREDITS_PER_CREDIT;
  return Math.round(
    Math.max(CAMPAIGN_COST_CAP.minUsd, credits * CAMPAIGN_COST_CAP.usdPerReservedCredit) *
      1_000_000,
  );
}

/** Hypothèses d'estimation (remplacées par les mesures de la bêta). */
export const ESTIMATE_DEFAULTS = {
  /** Part des prospects demandés effectivement livrés, borne basse prudente. */
  lowDeliveryRatio: 0.6,
  /** Coût réel moyen par prospect livré (USD), credits.md §2.4. */
  avgCostUsdPerDelivered: 0.0094,
  /** Coût IA de l'interprétation (USD, une fois par campagne). */
  interpretationCostUsd: 0.072,
};

export function creditsToMillicredits(credits: number): number {
  return Math.round(credits * MILLICREDITS_PER_CREDIT);
}

export function monthlyGrantFor(plan: PlanConfig, seats: number): number {
  return plan.monthlyCredits + Math.max(0, seats - plan.includedSeats) * plan.extraSeatCredits;
}
