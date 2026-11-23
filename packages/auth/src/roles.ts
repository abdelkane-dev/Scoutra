import { adminAc, memberAc, ownerAc } from 'better-auth/plugins/organization/access';
import type { OrgRole } from '@scoutra/core';

/**
 * Rôles déclarés à Better Auth (serveur ET client : `organizationClient({ roles })`), sans
 * dépendance serveur : importable depuis l'interface via `@scoutra/auth/roles`. Seuls owner et
 * admin ont des droits de gestion côté Better Auth ; la décision fine reste la matrice access.ts.
 */
export const BETTER_AUTH_ROLES = {
  owner: ownerAc,
  admin: adminAc,
  manager: memberAc,
  member: memberAc,
  viewer: memberAc,
  billing: memberAc,
} satisfies Record<OrgRole, unknown>;
