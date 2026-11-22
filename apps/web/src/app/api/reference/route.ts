import {
  ACCOUNT_TYPES,
  ORG_ROLES,
  PROSPECTING_MODELS,
  PROSPECT_KINDS,
  SECTORS,
} from '@scoutra/core';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Référentiels pour l'interface (onboarding, filtres) : codes stables + libellés FR/EN. */
export const GET = apiRoute({ action: 'org:read' }, async () =>
  json({
    accountTypes: ACCOUNT_TYPES,
    sectors: SECTORS,
    roles: ORG_ROLES,
    prospectingModels: PROSPECTING_MODELS.map((m) => ({
      code: m.code,
      defaultKinds: m.defaultKinds,
      involvesIndividuals: m.involvesIndividuals,
    })),
    prospectKinds: PROSPECT_KINDS,
  }),
);
