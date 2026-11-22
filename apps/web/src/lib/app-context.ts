import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { effectivePermissions, isOrgRole, isPlatformOperator, type Action } from '@scoutra/auth';
import type { OrgRole } from '@scoutra/core';
import { getAuth } from '@/server/auth';
import { getEnv } from '@/server/env';
import { getSession, requireOrgAccess, toUser } from '@/server/session';

/** Contexte transmis à la coquille de l'application (aucun secret, uniquement ce que l'UI affiche). */
export interface AppContext {
  user: { id: string; name: string; email: string; twoFactorEnabled: boolean; platformOperator: boolean };
  mode: 'saas' | 'license';
  org: {
    id: string;
    name: string;
    countryCode: string;
    accountType: string | null;
    sectors: string[];
    role: OrgRole;
    permissions: Action[];
    needsTwoFactor: Action[];
    dataScope: 'team' | 'own' | 'none';
    license: { status: string; mode?: string; expiresAt?: string | null };
    onboardingComplete: boolean;
  };
  orgs: { id: string; name: string }[];
  /** Vrai si le rôle affiché est un aperçu de développement (cookie scoutra_ui_role). */
  rolePreview: boolean;
}

const PREVIEW_COOKIE = 'scoutra_ui_role';

/**
 * Charge la session, l'organisation active, le rôle relu en base et les permissions effectives
 * (même calcul que GET /api/me). Redirige vers /login ou /onboarding si nécessaire.
 * Masquer un élément d'interface n'est jamais une protection : chaque route API revérifie.
 */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const s = await getSession();
  if (!s) redirect('/login');
  if (!s.session.activeOrganizationId) redirect('/onboarding');
  const env = getEnv();
  const user = toUser(s.user);
  const ctx = await requireOrgAccess('org:read');

  // Aperçu d'un autre rôle (développement uniquement, interface seulement).
  let role: OrgRole = ctx.role;
  let rolePreview = false;
  if (env.NODE_ENV !== 'production') {
    const preview = (await cookies()).get(PREVIEW_COOKIE)?.value;
    if (preview && isOrgRole(preview) && preview !== role) {
      role = preview;
      rolePreview = true;
    }
  }
  const perms = effectivePermissions({
    role,
    twoFactorEnabled: user.twoFactorEnabled,
    enforceTwoFactor: env.SCOUTRA_ENFORCE_ADMIN_2FA,
    licenseStatus: ctx.license.status,
  });

  let orgs: { id: string; name: string }[];
  try {
    const list = await getAuth().api.listOrganizations({ headers: await headers() });
    orgs = (list ?? []).map((o) => ({ id: o.id, name: o.name }));
  } catch {
    orgs = [];
  }
  const name = orgs.find((o) => o.id === ctx.orgId)?.name ?? '—';
  const license = ctx.license as unknown as { status: string; mode?: string; expiresAt?: string | null };

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      twoFactorEnabled: user.twoFactorEnabled,
      platformOperator: isPlatformOperator(user.platformRole, env.SCOUTRA_MODE),
    },
    mode: env.SCOUTRA_MODE,
    org: {
      id: ctx.orgId,
      name,
      countryCode: ctx.org.countryCode,
      accountType: ctx.org.accountType,
      sectors: ctx.org.sectors,
      role,
      permissions: perms.allowed,
      needsTwoFactor: perms.needsTwoFactor,
      dataScope: perms.dataScope,
      license: { status: license.status, mode: license.mode, expiresAt: license.expiresAt ?? null },
      onboardingComplete: ctx.org.accountType !== null && ctx.org.sectors.length > 0,
    },
    orgs,
    rolePreview,
  };
});

export function can(ctx: AppContext, action: Action) {
  return ctx.org.permissions.includes(action);
}
