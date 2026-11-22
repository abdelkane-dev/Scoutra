import type { TargetSpec } from '@scoutra/core';
import type { ConnectorQuery, Selection, SourceConnector } from '@scoutra/connectors';

export interface PlannedQuery {
  connector: string;
  queryIndex: number;
  query: ConnectorQuery;
  estimatedCostMicroUsd: number;
}

/**
 * Agent Recherche (planification, sans IA) : requêtes par connecteur retenu, entrelacées pour ne
 * dépendre d'aucune source, bornées par un nombre maximal de requêtes (budget de la campagne).
 */
export function planQueries(
  spec: TargetSpec,
  selection: Selection,
  maxQueries: number,
): PlannedQuery[] {
  const perConnector = selection.selected.map((c: SourceConnector) =>
    c.buildQueries(spec).map((query, queryIndex) => ({
      connector: c.manifest.code,
      queryIndex,
      query,
      estimatedCostMicroUsd: c.manifest.costMicroUsdPerRequest,
    })),
  );
  const out: PlannedQuery[] = [];
  for (let round = 0; out.length < maxQueries; round++) {
    let added = false;
    for (const list of perConnector) {
      const q = list[round];
      if (q && out.length < maxQueries) {
        out.push(q);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}
