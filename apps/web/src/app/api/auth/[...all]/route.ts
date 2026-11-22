import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/server/auth';

// Better Auth : inscription, connexion, sessions, organisations, invitations, 2FA.
// Contrôle d'origine, limites de tentatives et cookies sûrs configurés dans @scoutra/auth.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return toNextJsHandler(getAuth()).GET(req);
}

export async function POST(req: Request) {
  return toNextJsHandler(getAuth()).POST(req);
}
