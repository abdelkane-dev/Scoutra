import { estimateCampaign, type DeliveryQuality, type Estimate } from '@scoutra/billing';
import {
  selectConnectors,
  type CircuitBreaker,
  type ConnectorConfig,
  type CostMode,
  type SearchProvider,
  type Selection,
} from '@scoutra/connectors';
import type { ScoutraMode, TargetSpec } from '@scoutra/core';
import { planQueries, type PlannedQuery } from './planner';
import { playbookFor } from './playbooks';

export interface CampaignPlanInput {
  spec: TargetSpec;
  mode: ScoutraMode;
  hasKey: (provider: string) => boolean;
  config: ConnectorConfig;
  costMode: CostMode;
  searchProviders?: readonly SearchProvider[];
  breaker?: CircuitBreaker;
  maxProspects: number;
  quality: DeliveryQuality;
}

export interface CampaignPlan {
  selection: Selection;
  queries: PlannedQuery[];
  estimate: Estimate;
  /** Résumé sérialisable (stocké sur la campagne, montré à l'écran). */
  sources: {
    selected: string[];
    excluded: { code: string; reason: string }[];
    degraded: boolean;
    costMode: CostMode;
  };
}

/** Nombre de requêtes : de quoi trouver ~4 candidats par prospect demandé, borné. */
export function maxQueriesFor(maxProspects: number): number {
  return Math.min(40, Math.max(4, Math.ceil(maxProspects / 10) + 4));
}

/** Plan déterministe d'une campagne (même calcul pour l'estimation web et le worker). */
export function buildCampaignPlan(i: CampaignPlanInput): CampaignPlan {
  const playbook = playbookFor(i.spec.model);
  const selection = selectConnectors({
    spec: i.spec,
    mode: i.mode,
    hasKey: i.hasKey,
    config: i.config,
    costMode: i.costMode,
    playbookConnectors: playbook.connectors,
    searchProviders: i.searchProviders,
    breaker: i.breaker,
  });
  const queries = planQueries(i.spec, selection, maxQueriesFor(i.maxProspects));
  const estimate = estimateCampaign({
    maxProspects: i.maxProspects,
    quality: i.quality,
    plannedQueries: queries.length,
    plannedQueriesCostMicroUsd: queries.reduce((t, q) => t + q.estimatedCostMicroUsd, 0),
    mode: i.mode,
    degraded: selection.degraded,
  });
  return {
    selection,
    queries,
    estimate,
    sources: {
      selected: selection.selected.map((c) => c.manifest.code),
      excluded: selection.excluded,
      degraded: selection.degraded,
      costMode: i.costMode,
    },
  };
}
