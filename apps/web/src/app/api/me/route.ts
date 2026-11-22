import { AppError } from '@scoutra/core';
import { apiRoute, json } from '@/server/http';
import { getSession, requireOrgAccess } from '@/server/session';

export const dynamic = 'force-dynamic';

/** Utilisateur connecté, organisation active, rôle et état de licence (pour l'interface). */
// Déclarée publique pour l'enveloppe : la session est vérifiée ci-dessous (401 sinon).
export const GET = apiRoute({ public: true }, async () => {
  const s = await getSession();
  if (!s) throw new AppError('unauthenticated');
  let organization: { id: string; role: string; license: unknown } | null = null;
  if (s.session.activeOrganizationId) {
    const ctx = await requireOrgAccess('org:read');
    organization = { id: ctx.orgId, role: ctx.role, license: ctx.license };
  }
  return json({
    user: {
      id: s.user.id,
      email: s.user.email,
      name: s.user.name,
      emailVerified: s.user.emailVerified,
    },
    organization,
  });
});
