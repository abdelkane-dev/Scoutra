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

/**
 * Actions sensibles : un owner/admin doit avoir activé la 2FA pour les effectuer (E3).
 */
export const SENSITIVE_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  'org:update',
  'org:delete',
  'member:invite',
  'member:remove',
  'member:change_role',
  'prospect:export',
  'apikey:manage',
  'billing:manage',
  'license:manage',
  'audit:read',
]);

export function requiresTwoFactor(role: unknown, action: Action): boolean {
  return (role === 'owner' || role === 'admin') && SENSITIVE_ACTIONS.has(action);
}

/** Un acteur ne gère (retire, modifie) que des membres de rang strictement inférieur. */
export function canManageMember(actor: unknown, target: unknown): boolean {
  if (!isOrgRole(actor) || !isOrgRole(target)) return false;
  return actor === 'owner' || RANK[actor] > RANK[target];
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

export type LicenseStatusLike = 'valid' | 'grace' | 'read_only' | 'invalid';
export type AccessDenial = 'forbidden' | 'two_factor_required' | 'read_only';

/**
 * Décision d'accès unique (routes métier) : rôle → 2FA des actions sensibles → licence.
 * Pure et testée ; `requireOrgAccess` (apps/web) ne fait que lire les entrées en base.
 */
export function decideAccess(input: {
  role: unknown;
  action: Action;
  twoFactorEnabled: boolean;
  enforceTwoFactor: boolean;
  licenseStatus: LicenseStatusLike;
}): { ok: true } | { ok: false; reason: AccessDenial } {
  if (!can(input.role, input.action)) return { ok: false, reason: 'forbidden' };
  if (
    input.enforceTwoFactor &&
    requiresTwoFactor(input.role, input.action) &&
    !input.twoFactorEnabled
  ) {
    return { ok: false, reason: 'two_factor_required' };
  }
  if (input.licenseStatus === 'invalid') return { ok: false, reason: 'read_only' };
  if (input.licenseStatus === 'read_only' && !isReadAction(input.action))
    return { ok: false, reason: 'read_only' };
  return { ok: true };
}
