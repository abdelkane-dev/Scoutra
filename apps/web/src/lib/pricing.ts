/**
 * Barème des formules et des crédits — SOURCE UNIQUE pour la landing et la facturation.
 * Référence : docs/offres/credits.md (barème du 22/11/2026, à recalibrer chaque trimestre).
 * 1 crédit = 1 prospect livré prêt à contacter (enrichi, contact vérifié, score expliqué,
 * message standard). Pas de résultat, pas de débit.
 */
export const PLANS = {
  search: { priceUsd: 19.99, creditsPerMonth: 1000, usersIncluded: 1, concurrentCampaigns: 2 },
  pipeline: {
    priceUsd: 49.99,
    creditsPerMonth: 3000,
    usersIncluded: 3,
    extraSeat: { priceUsd: 9.99, credits: 500 },
    concurrentCampaigns: 5,
  },
  license: { priceUsdPerYear: 1990, usersIncluded: 10, extraUserUsdPerYear: 99 },
} as const;

/** Part de l'octroi mensuel non utilisé reportée sur le mois suivant. */
export const ROLLOVER_SHARE = 0.5;

/** Packs de crédits supplémentaires (valables 12 mois). */
export const CREDIT_PACKS = [
  { credits: 500, priceUsd: 14.99 },
  { credits: 2500, priceUsd: 59 },
  { credits: 10000, priceUsd: 199 },
] as const;
export const PACK_VALIDITY_MONTHS = 12;

/** Supplément en crédits par prospect selon le niveau de rédaction. */
export const WRITING_SURCHARGE = { standard: 0, careful: 1, premium: 3 } as const;

/** Essai sans carte. */
export const TRIAL_CREDITS = 100;

/** Moyens de paiement acceptés : carte bancaire uniquement. */
export const PAYMENT_METHODS = ['visa', 'mastercard', 'prepaid'] as const;

export type PlanId = keyof typeof PLANS;
