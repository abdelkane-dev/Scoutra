import 'server-only';
import { evaluateLicense, loadPublicKeyring, type LicenseEvaluation } from '@scoutra/license';
import { getEnv } from './env';

export interface LicenseState {
  mode: 'saas' | 'license';
  status: LicenseEvaluation['status'];
  reason?: LicenseEvaluation['reason'];
}

/**
 * État de licence pour une organisation. En SaaS : toujours valide (abonnement géré ailleurs).
 * En mode licence : vérification hors ligne (signature, dates, pays et organisation, membres).
 * TODO étape 6 : mémoriser la plus grande date vue en base (anti-recul d'horloge).
 */
export function licenseStateFor(
  org: { id: string; countryCode: string },
  activeUsers: number,
): LicenseState {
  const env = getEnv();
  if (env.SCOUTRA_MODE === 'saas') return { mode: 'saas', status: 'valid' };
  const ev = evaluateLicense(env.SCOUTRA_LICENSE_TOKEN ?? '', {
    keyring: loadPublicKeyring(env.SCOUTRA_LICENSE_PUBLIC_KEYS),
    now: Math.floor(Date.now() / 1000),
    orgCountry: org.countryCode,
    orgId: org.id,
    activeUsers,
  });
  return { mode: 'license', status: ev.status, reason: ev.reason };
}
