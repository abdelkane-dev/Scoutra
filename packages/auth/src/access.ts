import { ORG_ROLES, type OrgRole } from '@scoutra/core';

/**
 * Contrôle d'accès CENTRALISÉ côté serveur (E2). Refus par défaut : une action absente
 * de la matrice, un rôle inconnu ou une valeur inattendue => refus.
 *
 * Les rôles ne forment PAS une hiérarchie linéaire (billing et viewer sont « de côté ») : chaque
 * action liste explicitement les rôles autorisés.
 * - `read` : action de consultation (encore permise quand la licence est en lecture seule) ;
 * - `sensitive` : 2FA exigée (E3) quel que soit le rôle qui l'effectue.
 */
interface ActionDef {
  roles: readonly OrgRole[];
  read?: true;
  sensitive?: true;
}

const ALL: readonly OrgRole[] = ORG_ROLES;
/** Rôles qui travaillent la prospection (tout sauf billing). */
const SALES_READ: readonly OrgRole[] = ['owner', 'admin', 'manager', 'member', 'viewer'];
const SALES_WRITE: readonly OrgRole[] = ['owner', 'admin', 'manager', 'member'];
/** Vue d'équipe : voit les données de tous les membres (le commercial ne voit que les siennes). */
const TEAM_READ: readonly OrgRole[] = ['owner', 'admin', 'manager', 'viewer'];
const TEAM_LEAD: readonly OrgRole[] = ['owner', 'admin', 'manager'];
const ADMINS: readonly OrgRole[] = ['owner', 'admin'];
const OWNER: readonly OrgRole[] = ['owner'];

export const ACTIONS = {
  // Organisation et équipe
  'org:read': { roles: ALL, read: true },
  'org:update': { roles: ADMINS, sensitive: true },
  /** Profil (type de compte, secteurs) : onboarding, donc sans 2FA exigée. */
  'org:profile': { roles: ADMINS },
  'org:delete': { roles: OWNER, sensitive: true },
  'member:list': { roles: ALL, read: true },
  'member:invite': { roles: ADMINS, sensitive: true },
  'member:remove': { roles: ADMINS, sensitive: true },
  'member:change_role': { roles: OWNER, sensitive: true },
  // Recherche (campagnes)
  'campaign:read': { roles: SALES_READ, read: true },
  'campaign:read_all': { roles: TEAM_READ, read: true },
  'campaign:write': { roles: SALES_WRITE },
  // Prospects
  'prospect:read': { roles: SALES_READ, read: true },
  'prospect:read_all': { roles: TEAM_READ, read: true },
  'prospect:write': { roles: SALES_WRITE },
  'prospect:assign': { roles: TEAM_LEAD },
  'prospect:export': { roles: TEAM_LEAD, read: true, sensitive: true },
  // Pipeline et séquences
  'pipeline:read': { roles: SALES_READ, read: true },
  'pipeline:write': { roles: SALES_WRITE },
  'pipeline:manage': { roles: TEAM_LEAD },
  'sequence:read': { roles: SALES_READ, read: true },
  'sequence:enroll': { roles: SALES_WRITE },
  'sequence:manage': { roles: TEAM_LEAD },
  // Contacts, signaux, messages, tâches (« Leads » = prospects dans l'interface)
  'contact:read': { roles: SALES_READ, read: true },
  'contact:write': { roles: SALES_WRITE },
  'signal:read': { roles: SALES_READ, read: true },
  'message:read': { roles: SALES_READ, read: true },
  'message:write': { roles: SALES_WRITE },
  'task:read': { roles: SALES_READ, read: true },
  'task:write': { roles: SALES_WRITE },
  // Automatisations (règles déclenchées sur événements, sans envoi automatique de DM)
  'automation:read': { roles: SALES_READ, read: true },
  'automation:manage': { roles: TEAM_LEAD },
  // Rapports
  'report:read_own': { roles: SALES_READ, read: true },
  'report:read_team': { roles: TEAM_READ, read: true },
  // Crédits et facturation
  'credits:read': { roles: ALL, read: true },
  'billing:read': { roles: ['owner', 'admin', 'billing'], read: true },
  'billing:manage': { roles: ['owner', 'billing'], sensitive: true },
  // Administration
  'apikey:manage': { roles: ADMINS, sensitive: true },
  'integration:manage': { roles: ADMINS, sensitive: true },
  'compliance:read': { roles: SALES_READ, read: true },
  'compliance:manage': { roles: ADMINS, sensitive: true },
  'license:manage': { roles: OWNER, sensitive: true },
  'audit:read': { roles: ADMINS, read: true, sensitive: true },
  'job:ping': { roles: SALES_WRITE },
} as const satisfies Record<string, ActionDef>;

export type Action = keyof typeof ACTIONS;
export const ACTION_NAMES = Object.keys(ACTIONS) as Action[];

function def(action: unknown): ActionDef | undefined {
  if (typeof action !== 'string' || !Object.hasOwn(ACTIONS, action)) return undefined;
  return ACTIONS[action as Action];
}

export function isOrgRole(v: unknown): v is OrgRole {
  return typeof v === 'string' && (ORG_ROLES as readonly string[]).includes(v);
}

export function can(role: unknown, action: unknown): boolean {
  const d = def(action);
  if (!d || !isOrgRole(role)) return false;
  return d.roles.includes(role);
}

/** Actions sensibles : 2FA exigée pour les effectuer (E3), quel que soit le rôle. */
export const SENSITIVE_ACTIONS: ReadonlySet<Action> = new Set<Action>(
  ACTION_NAMES.filter((a) => (ACTIONS[a] as ActionDef).sensitive === true),
);

export function requiresTwoFactor(role: unknown, action: Action): boolean {
  return isOrgRole(role) && SENSITIVE_ACTIONS.has(action);
}

/** Actions de consultation (encore permises quand la licence est en lecture seule). */
export function isReadAction(action: Action): boolean {
  return (def(action) as ActionDef | undefined)?.read === true;
}

/**
 * Portée des données de prospection : `team` (toute l'organisation), `own` (seulement ce que
 * le membre a créé ou qui lui est assigné), `none` (billing).
 */
export type DataScope = 'team' | 'own' | 'none';
export function dataScope(role: unknown): DataScope {
  if (can(role, 'prospect:read_all')) return 'team';
  if (can(role, 'prospect:read')) return 'own';
  return 'none';
}

/** Rang pour la gestion des membres (pas pour les permissions). */
const RANK: Record<OrgRole, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  member: 1,
  viewer: 1,
  billing: 1,
};

/** Un acteur ne gère (retire, modifie) que des membres de rang strictement inférieur. */
export function canManageMember(actor: unknown, target: unknown): boolean {
  if (!isOrgRole(actor) || !isOrgRole(target)) return false;
  if (!can(actor, 'member:remove') && !can(actor, 'member:change_role')) return false;
  return actor === 'owner' || RANK[actor] > RANK[target];
}

/** Rôles qu'un acteur peut attribuer (jamais au-dessus du sien ; owner réservé au propriétaire). */
export function assignableRoles(actor: unknown): OrgRole[] {
  if (actor === 'owner') return [...ORG_ROLES];
  if (actor === 'admin') return ['manager', 'member', 'viewer', 'billing'];
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

/**
 * Permissions effectives (pour que l'interface masque ce qui n'est pas permis ; le serveur
 * revérifie TOUJOURS). `allowed` : actions possibles maintenant ; `needsTwoFactor` : actions
 * permises par le rôle mais bloquées tant que la 2FA n'est pas activée.
 */
export function effectivePermissions(input: Omit<Parameters<typeof decideAccess>[0], 'action'>): {
  allowed: Action[];
  needsTwoFactor: Action[];
  dataScope: DataScope;
} {
  const allowed: Action[] = [];
  const needsTwoFactor: Action[] = [];
  for (const action of ACTION_NAMES) {
    const d = decideAccess({ ...input, action });
    if (d.ok) allowed.push(action);
    else if (d.reason === 'two_factor_required') needsTwoFactor.push(action);
  }
  return { allowed, needsTwoFactor, dataScope: dataScope(input.role) };
}

/**
 * Opérateur de la plateforme (console super-admin, mode SaaS uniquement). Hors rôles
 * d'organisation : stocké sur l'utilisateur (`users.platform_role`, jamais modifiable par
 * l'API d'authentification). PRÉVU, NON IMPLÉMENTÉ : aucune route ne l'utilise encore ; en mode
 * licence il est toujours faux.
 */
export const PLATFORM_ROLES = ['operator'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];
export function isPlatformOperator(platformRole: unknown, mode: 'saas' | 'license'): boolean {
  return mode === 'saas' && platformRole === 'operator';
}
