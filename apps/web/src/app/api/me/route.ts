import { AppError } from '@scoutra/core';
import { effectivePermissions, isPlatformOperator } from '@scoutra/auth';
import { apiRoute, json } from '@/server/http';
import { getEnv } from '@/server/env';
import { getSession, requireOrgAccess, toUser } from '@/server/session';

export const dynamic = 'force-dynamic';

/**
 * Utilisateur connecté, organisation active, rôle, permissions EFFECTIVES (calculées par la
 * matrice serveur, pour que l'interface masque ce qui n'est pas permis) et état de licence.
 * Le serveur revérifie chaque action : masquer un bouton n'est jamais une protection.
 */
// Déclarée publique pour l'enveloppe : la session est vérifiée ci-dessous (401 sinon).
export const GET = apiRoute({ public: true }, async () => {
  const s = await getSession();
  if (!s) throw new AppError('unauthenticated');
  const env = getEnv();
  const user = toUser(s.user);
  let organization: Record<string, unknown> | null = null;
  if (s.session.activeOrganizationId) {
    const ctx = await requireOrgAccess('org:read');
    const perms = effectivePermissions({
      role: ctx.role,
      twoFactorEnabled: user.twoFactorEnabled,
      enforceTwoFactor: env.SCOUTRA_ENFORCE_ADMIN_2FA,
      licenseStatus: ctx.license.status,
    });
    organization = {
      id: ctx.orgId,
      role: ctx.role,
      countryCode: ctx.org.countryCode,
      accountType: ctx.org.accountType,
      sectors: ctx.org.sectors,
      website: ctx.org.websiteDomain,
      onboardingComplete: ctx.org.accountType !== null && ctx.org.sectors.length > 0,
      permissions: perms.allowed,
      twoFactorRequiredFor: perms.needsTwoFactor,
      dataScope: perms.dataScope,
      license: ctx.license,
    };
  }
  return json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      platformOperator: isPlatformOperator(user.platformRole, env.SCOUTRA_MODE),
    },
    mode: env.SCOUTRA_MODE,
    organization,
  });
});
