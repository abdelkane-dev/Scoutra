import 'server-only';
import { headers } from 'next/headers';
import { AppError, type OrgRole } from '@scoutra/core';
import { can, isOrgRole, isReadAction, type Action } from '@scoutra/auth';
import { count, eq, schema, withTenant } from '@scoutra/db';
import { licenseAllowsWrites } from '@scoutra/license';
import { getAuth } from './auth';
import { appDb } from './db';
import { licenseStateFor, type LicenseState } from './license';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}

export interface OrgContext {
  user: SessionUser;
  orgId: string;
  role: OrgRole;
  license: LicenseState;
}

/** Session courante ou null (cookies HttpOnly lus côté serveur). */
export async function getSession() {
  return getAuth().api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const s = await getSession();
  if (!s) throw new AppError('unauthenticated');
  return s;
}

function toUser(u: {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  twoFactorEnabled?: boolean | null;
}): SessionUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    emailVerified: u.emailVerified,
    twoFactorEnabled: !!u.twoFactorEnabled,
  };
}

/**
 * Contrôle d'accès CENTRALISÉ pour toute donnée d'organisation (E2) :
 * 1. session valide ;
 * 2. organisation ACTIVE issue de la session (jamais du corps de requête ni de l'URL) ;
 * 3. rôle relu en base (adhésion vérifiée sous RLS), jamais pris du client ;
 * 4. matrice `can(rôle, action)` à refus par défaut ;
 * 5. licence : en lecture seule, seules les actions de lecture/export passent.
 */
export async function requireOrgAccess(action: Action): Promise<OrgContext> {
  const s = await requireSession();
  const orgId = s.session.activeOrganizationId;
  if (!orgId) throw new AppError('forbidden', 'no_active_organization');
  const user = toUser(s.user);
  const db = await appDb();

  const found = await withTenant(db, { orgId, userId: user.id }, async (tx) => {
    const [org] = await tx
      .select({ id: schema.organizations.id, countryCode: schema.organizations.countryCode })
      .from(schema.organizations);
    const [member] = await tx
      .select({ role: schema.members.role })
      .from(schema.members)
      .where(eq(schema.members.userId, user.id));
    const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(schema.members);
    return { org, role: member?.role, members: n };
  });

  if (!found.org || found.org.id !== orgId || !isOrgRole(found.role))
    throw new AppError('forbidden');
  if (!can(found.role, action)) throw new AppError('forbidden');

  const license = licenseStateFor(found.org, found.members);
  if (license.status === 'invalid')
    throw new AppError('read_only', `licence invalide (${license.reason ?? '?'})`);
  if (!isReadAction(action) && !licenseAllowsWrites(license.status))
    throw new AppError('read_only');

  return { user, orgId, role: found.role, license };
}
