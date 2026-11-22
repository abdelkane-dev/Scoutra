import { DELIVERY_CREDITS, ESTIMATE_DEFAULTS, type DeliveryQuality } from './plans';

export interface EstimateInput {
  maxProspects: number;
  quality: DeliveryQuality;
  /** Coût réel des requêtes planifiées (micro-dollars), d'après les manifestes des connecteurs. */
  plannedQueriesCostMicroUsd: number;
  plannedQueries: number;
  mode: 'saas' | 'license';
  degraded: boolean;
}

export interface Estimate {
  prospects: { requested: number; low: number };
  /** Fourchette en crédits ; seul le livré est débité (« pas de résultat = pas de débit »). */
  credits: { low: number; high: number; perProspect: number } | null;
  /** Coût réel estimé (USD) : marge en SaaS, facture des clés du client en licence. */
  costUsd: { low: number; high: number };
  plannedQueries: number;
  degraded: boolean;
  assumptions: string[];
}

/** Estimation AVANT lancement, en fourchette (credits.md §6.4). */
export function estimateCampaign(i: EstimateInput): Estimate {
  const per = DELIVERY_CREDITS[i.quality];
  const low = Math.max(0, Math.floor(i.maxProspects * ESTIMATE_DEFAULTS.lowDeliveryRatio));
  const fixed = ESTIMATE_DEFAULTS.interpretationCostUsd + i.plannedQueriesCostMicroUsd / 1_000_000;
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    prospects: { requested: i.maxProspects, low },
    credits:
      i.mode === 'saas' ? { low: low * per, high: i.maxProspects * per, perProspect: per } : null,
    costUsd: {
      low: round(fixed + low * ESTIMATE_DEFAULTS.avgCostUsdPerDelivered * 0.5),
      high: round(fixed + i.maxProspects * ESTIMATE_DEFAULTS.avgCostUsdPerDelivered * 2),
    },
    plannedQueries: i.plannedQueries,
    degraded: i.degraded,
    assumptions: ['delivery_ratio_default', ...(i.degraded ? ['free_sources_only'] : [])],
  };
}
