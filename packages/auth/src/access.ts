import { ORG_ROLES, type OrgRole } from '@scoutra/core';

/**
 * Contrôle d'accès CENTRALISÉ côté serveur (E2). Refus par défaut : une action absente
 * de la matrice, un rôle inconnu ou une valeur inattendue => refus.
 */
export const ACTIONS = {
  'org:read': 'member',
  'org:update': 'admin',
  'org:delete': 'owner',
  'member:list': 'member',
  'member:invite': 'admin',
  'member:remove': 'admin',
  'member:change_role': 'owner',
  'campaign:read': 'member',
  'campaign:write': 'member',
  'prospect:read': 'member',
  'prospect:export': 'admin',
  'apikey:manage': 'admin',
  'billing:manage': 'owner',
  'license:manage': 'owner',
  'audit:read': 'admin',
  'job:ping': 'member',
} as const satisfies Record<string, OrgRole>;

export type Action = keyof typeof ACTIONS;

const RANK: Record<OrgRole, number> = { owner: 3, admin: 2, member: 1 };

export function isOrgRole(v: unknown): v is OrgRole {
  return typeof v === 'string' && (ORG_ROLES as readonly string[]).includes(v);
}

export function can(role: unknown, action: unknown): boolean {
  if (!isOrgRole(role) || typeof action !== 'string' || !Object.hasOwn(ACTIONS, action))
    return false;
  return RANK[role] >= RANK[ACTIONS[action as Action]];
}

/** Actions de consultation (encore permises quand la licence est en lecture seule). */
export function isReadAction(action: Action): boolean {
  return /:(read|list|export)$/.test(action);
}

/** Rôles qu'un acteur peut attribuer (jamais au-dessus du sien ; owner réservé au propriétaire). */
export function assignableRoles(actor: unknown): OrgRole[] {
  if (actor === 'owner') return ['owner', 'admin', 'member'];
  if (actor === 'admin') return ['member'];
  return [];
}
