import type { ProspectKind, ScoutraMode, TargetSpec } from '@scoutra/core';
import type { CircuitBreaker } from './breaker';
import { googlePlacesConnector } from './sources/google-places';
import { osmConnector } from './sources/osm';
import { crtshConnector } from './sources/crtsh';
import { companiesHouseConnector, frRechercheEntreprisesConnector } from './sources/registries';
import { webSearchConnector, type SearchProvider } from './sources/web-search';
import type { ConnectorConfig, SourceConnector } from './types';

/** Liste blanche COMPILÉE (ARCHITECTURE §5.3) : aucun chargement dynamique de connecteur. */
export const ALL_CONNECTORS: readonly SourceConnector[] = [
  webSearchConnector('searxng'),
  webSearchConnector('serper'),
  webSearchConnector('brave'),
  webSearchConnector('tavily'),
  osmConnector,
  googlePlacesConnector,
  companiesHouseConnector,
  frRechercheEntreprisesConnector,
  crtshConnector,
];

export function connectorByCode(code: string): SourceConnector | undefined {
  return ALL_CONNECTORS.find((c) => c.manifest.code === code);
}

/** Niveau du garde-fou de coût réel : `economy` à 70 % du plafond, `free_only` à 100 %. */
export type CostMode = 'normal' | 'economy' | 'free_only';

export type ExclusionReason =
  | 'not_in_playbook'
  | 'model'
  | 'kind'
  | 'country'
  | 'mode'
  | 'missing_key'
  | 'missing_service'
  | 'cost_guard'
  | 'circuit_open'
  | 'search_provider_already_chosen';

export interface Selection {
  selected: SourceConnector[];
  excluded: { code: string; reason: ExclusionReason }[];
  /** Vrai si aucune source payante n'est utilisée (explication « mode dégradé » à l'écran). */
  degraded: boolean;
}

export interface SelectOptions {
  spec: TargetSpec;
  mode: ScoutraMode;
  hasKey: (provider: string) => boolean;
  config: ConnectorConfig;
  costMode: CostMode;
  /** Connecteurs autorisés par le playbook du modèle (ordre = priorité). */
  playbookConnectors?: readonly string[];
  /** Ordre de préférence des moteurs de recherche (configuration). */
  searchProviders?: readonly SearchProvider[];
  breaker?: CircuitBreaker;
}

/**
 * Sélection déterministe des sources pour une campagne. Jamais de dépendance à une seule
 * source : les sources gratuites (OSM, registres, SearXNG, crt.sh) restent retenues quand une
 * clé manque ou qu'un disjoncteur est ouvert. Un seul moteur de recherche web (le premier
 * disponible dans l'ordre configuré, le moins cher en mode économie).
 */
export function selectConnectors(o: SelectOptions): Selection {
  const excluded: Selection['excluded'] = [];
  const selected: SourceConnector[] = [];
  const order = o.searchProviders ?? ['searxng', 'serper', 'brave', 'tavily'];
  const rank = (c: SourceConnector) => {
    const i = order.indexOf(c.manifest.code.replace('search_', '') as SearchProvider);
    return i === -1 ? 99 : i;
  };
  const candidates = [...ALL_CONNECTORS].sort((a, b) => {
    const pa = o.playbookConnectors?.indexOf(a.manifest.code) ?? 0;
    const pb = o.playbookConnectors?.indexOf(b.manifest.code) ?? 0;
    return pa - pb || rank(a) - rank(b);
  });
  let searchChosen = false;
  for (const c of candidates) {
    const m = c.manifest;
    const exclude = (reason: ExclusionReason) => excluded.push({ code: m.code, reason });
    const isSearchEngine = m.code.startsWith('search_');
    if (
      o.playbookConnectors &&
      !o.playbookConnectors.some((p) => p === m.code || (p === 'web_search' && isSearchEngine))
    )
      exclude('not_in_playbook');
    else if (m.models !== 'all' && !m.models.includes(o.spec.model)) exclude('model');
    else if (!o.spec.kinds.some((k: ProspectKind) => m.prospectKinds.includes(k))) exclude('kind');
    else if (
      m.countries !== 'WORLD' &&
      !o.spec.countries.some((cc) => (m.countries as readonly string[]).includes(cc))
    )
      exclude('country');
    else if (!m.availableIn.includes(o.mode)) exclude('mode');
    else if (m.requiresKey && !o.hasKey(m.requiresKey)) exclude('missing_key');
    else if (m.requiresServiceUrl && !o.config[`${m.requiresServiceUrl}Url`])
      exclude('missing_service');
    else if (
      (o.costMode === 'free_only' && m.costTier !== 'free') ||
      (o.costMode === 'economy' && m.costTier === 'paid')
    )
      exclude('cost_guard');
    else if (o.breaker && !o.breaker.canCall(m.code)) exclude('circuit_open');
    else if (isSearchEngine && searchChosen) exclude('search_provider_already_chosen');
    else {
      if (isSearchEngine) searchChosen = true;
      selected.push(c);
    }
  }
  return {
    selected,
    excluded,
    degraded: selected.every((c) => c.manifest.costTier === 'free'),
  };
}
