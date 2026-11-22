import type {
  IsoCountry,
  LegalBasis,
  ProspectKind,
  ProspectingModel,
  ScoutraMode,
  SignalKey,
  TargetSpec,
} from '@scoutra/core';

export const LEGAL_STATUSES = [
  'official_api',
  'open_data',
  'public_web',
  'opt_in',
  'first_party',
] as const;
export type LegalStatus = (typeof LEGAL_STATUSES)[number];

/** Palier de coût : sert au garde-fou de coût réel (bascule vers le gratuit à 70 %). */
export type CostTier = 'free' | 'cheap' | 'paid';

/**
 * Manifeste déclaratif d'un connecteur (CLAUDE.md : statut légal et pays obligatoires).
 * Le planificateur ne retient un connecteur que si modèle, types, pays, mode, clé, garde-fou de
 * coût et état du disjoncteur sont compatibles.
 */
export interface ConnectorManifest {
  code: string;
  name: { fr: string; en: string };
  version: string;
  /** `search` : découvre des candidats ; `enrich` : complète un prospect existant. */
  role: 'search' | 'enrich';
  prospectKinds: readonly ProspectKind[];
  models: readonly ProspectingModel[] | 'all';
  countries: readonly IsoCountry[] | 'WORLD';
  legalStatus: LegalStatus;
  defaultLegalBasis: LegalBasis;
  /** Licence des données (attribution à afficher), ex. ODbL. */
  dataLicense?: string;
  /** Coût réel estimé par requête, en micro-dollars (journalisé dans usage_events). */
  costMicroUsdPerRequest: number;
  costTier: CostTier;
  /** Clé requise : nom du fournisseur (clé plateforme en SaaS, clé du client en licence). */
  requiresKey: string | null;
  /** Service interne configuré (SearXNG, Crawl4AI) : URL de base requise. */
  requiresServiceUrl?: 'searxng' | 'crawl4ai' | 'overpass';
  rateLimit: { perSecond: number; perDay?: number };
  availableIn: readonly ScoutraMode[];
  /** Signaux que la source peut révéler. */
  signals: readonly SignalKey[];
  /** Notes juridiques courtes (affichées dans la fiche de conformité). */
  legalNotes: string;
}

export interface ConnectorQuery {
  /** Texte de recherche (mots-clés, éventuellement opérateurs site:). */
  text: string;
  country: IsoCountry;
  city?: string;
  /** Intention : découverte d'entités ou signaux publics indexés. */
  intent: 'entities' | 'public_signals';
  signal?: SignalKey;
  limit: number;
}

export interface CandidateSignal {
  key: SignalKey;
  /** Date de l'événement si connue (ISO). */
  observedAt?: string;
  snippet?: string;
  url?: string;
}

/** Candidat brut renvoyé par un connecteur, AVANT dédoublonnage et vérification. */
export interface RawCandidate {
  sourceCode: string;
  sourceUrl?: string;
  /** Identifiant stable chez la source (place_id, SIREN, n° Companies House, id OSM…). */
  externalId?: string;
  kind: ProspectKind;
  displayName: string;
  countryCode: IsoCountry;
  city?: string;
  address?: string;
  websiteDomain?: string;
  /** Coordonnées PROFESSIONNELLES publiées par l'entité elle-même (standard, contact@). */
  phones: string[];
  emails: string[];
  category?: string;
  registryId?: string;
  snippet?: string;
  publishedAt?: string;
  signals: CandidateSignal[];
  attributes: Record<string, string | number | boolean | null>;
  legalBasis: LegalBasis;
  dataLicense?: string;
}

export interface HttpResponse {
  status: number;
  text(): string;
  json<T = unknown>(): T;
}
export interface HttpRequest {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}
/** Client HTTP injecté : safeFetch en production, réponses enregistrées en test. */
export interface HttpClient {
  request(url: string, req?: HttpRequest): Promise<HttpResponse>;
  /** Services internes configurés (SearXNG, Crawl4AI) : URL de base fixée par l'exploitant. */
  internal(url: string, req?: HttpRequest): Promise<HttpResponse>;
}

export interface ConnectorConfig {
  searxngUrl?: string;
  crawl4aiUrl?: string;
  overpassUrl?: string;
}

export interface ConnectorCtx {
  http: HttpClient;
  /** Clé d'API d'un fournisseur (jamais journalisée, jamais envoyée à un LLM). */
  key(provider: string): string | undefined;
  config: ConnectorConfig;
  signal?: AbortSignal;
  now(): Date;
}

export interface SearchResult {
  candidates: RawCandidate[];
  /** Requêtes réellement facturables effectuées (coût réel). */
  billableRequests: number;
}

export interface SourceConnector {
  manifest: ConnectorManifest;
  /** Pur et testable : requêtes à lancer pour une cible. */
  buildQueries(spec: TargetSpec): ConnectorQuery[];
  search(q: ConnectorQuery, ctx: ConnectorCtx, spec?: TargetSpec): Promise<SearchResult>;
}

/** Erreur d'un fournisseur : `retryable` (429, 5xx, réseau) ou non (400, clé invalide). */
export class ConnectorError extends Error {
  constructor(
    readonly connector: string,
    readonly code: 'rate_limited' | 'unavailable' | 'bad_response' | 'auth' | 'invalid_query',
    readonly retryable: boolean,
  ) {
    super(`${connector}: ${code}`);
    this.name = 'ConnectorError';
  }
}
