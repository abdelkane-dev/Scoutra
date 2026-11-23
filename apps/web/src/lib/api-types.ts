/** Types des réponses de l'API (docs/api.md). Les champs non utilisés par l'interface sont omis. */
export type CampaignStatus =
  | 'interpreting'
  | 'awaiting_confirmation'
  | 'running'
  | 'paused'
  | 'cancelling'
  | 'cancelled'
  | 'completed'
  | 'failed';

export interface ApiCampaign {
  id: string;
  name: string;
  prompt: string;
  model: string;
  status: CampaignStatus;
  quality: 'standard' | 'careful' | 'premium';
  maxProspects: number;
  credits?: { reserved: number; consumed: number } | null;
  counts?: { candidates: number; duplicates: number; delivered: number; rejected: number };
  degraded?: boolean;
  costMode?: string;
  estimate?: {
    prospects: { requested: number; low: number };
    credits: { low: number; high: number; perProspect: number } | null;
    plannedQueries: number;
    degraded: boolean;
  } | null;
  sources?: { selected: string[]; excluded: { code: string; reason: string }[]; degraded: boolean };
  target?: {
    version: number;
    confirmed: boolean;
    spec: {
      model: string;
      kinds: string[];
      summary: string;
      countries: string[];
      regions: string[];
      keywords: string[];
      signals: { key: string }[];
    };
    interpretation: {
      method: 'ai' | 'heuristic';
      confidence: number;
      clarifyingQuestions: string[];
    };
  } | null;
  createdAt: string;
}

export interface ApiProspectItem {
  id: string;
  campaignId: string;
  kind: string;
  displayName: string;
  countryCode: string | null;
  city: string | null;
  websiteDomain: string | null;
  status: string;
  score: number | null;
  sourceCodes: string[];
  channels: { channel: string; outcome: string }[];
  deliveredAt: string | null;
  createdAt: string;
}

export interface ApiProspectDetail {
  prospect: {
    id: string;
    displayName: string;
    kind: string;
    countryCode: string | null;
    city: string | null;
    websiteDomain: string | null;
    status: string;
  };
  score: {
    value: number;
    reasons: {
      criterion: string;
      points: number;
      max: number;
      finding: string;
      params?: Record<string, string>;
    }[];
  } | null;
  channels: { channel: string; outcome: string }[];
  evidence: Record<
    string,
    { source: string; url?: string; collectedAt: string; legalBasis: string }[]
  >;
  contacts: {
    id: string;
    channel: string;
    value: string;
    revealed: boolean;
    verificationStatus: string;
  }[];
  messages: {
    id: string;
    channel: string;
    subject: string | null;
    body: string;
    footer: string | null;
    status: string;
  }[];
}

export interface ApiCredits {
  mode: 'saas' | 'license';
  balance?: number;
  buckets?: { origin: string; remaining: number; expiresAt: string }[];
  plan?: {
    code: string;
    monthlyCredits: number;
    concurrentCampaigns: number;
    maxProspectsPerCampaign: number;
  };
}
