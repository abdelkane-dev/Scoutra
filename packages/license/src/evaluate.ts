import {
  LicenseFormatError,
  verifyLicenseToken,
  type LicensePayload,
  type PublicKeyring,
} from './token';

export type LicenseStatus = 'valid' | 'grace' | 'read_only' | 'invalid';

export interface LicenseEvaluation {
  status: LicenseStatus;
  /** Raison lisible (code stable) quand le statut n'est pas `valid`. */
  reason?:
    | 'format'
    | 'not_yet_valid'
    | 'expired_grace'
    | 'expired'
    | 'country_mismatch'
    | 'org_mismatch'
    | 'max_users_exceeded';
  payload?: LicensePayload;
  /** Date (s) réellement utilisée pour le calcul, après protection contre le recul d'horloge. */
  effectiveNow: number;
  clockRollbackDetected: boolean;
}

export interface EvaluateOptions {
  keyring: PublicKeyring;
  /** Heure courante, secondes Unix. */
  now: number;
  /** Plus grande heure déjà observée (persistée en base) pour détecter un recul d'horloge. */
  lastSeen?: number;
  /** Pays d'établissement de l'organisation installée. */
  orgCountry?: string;
  orgId?: string;
  activeUsers?: number;
}

const DAY = 86_400;
const ROLLBACK_TOLERANCE = DAY;

/**
 * Évalue une licence hors ligne. Jamais de suppression de données : au pire `read_only`
 * (consultation, export et effacement RGPD restent possibles).
 */
export function evaluateLicense(token: string, opts: EvaluateOptions): LicenseEvaluation {
  const clockRollbackDetected =
    opts.lastSeen !== undefined && opts.lastSeen - opts.now > ROLLBACK_TOLERANCE;
  const effectiveNow = clockRollbackDetected ? opts.lastSeen! : opts.now;
  const base = { effectiveNow, clockRollbackDetected };

  let payload: LicensePayload;
  try {
    payload = verifyLicenseToken(token, opts.keyring);
  } catch (e) {
    if (e instanceof LicenseFormatError) return { ...base, status: 'invalid', reason: 'format' };
    throw e;
  }

  if (effectiveNow < payload.nbf)
    return { ...base, payload, status: 'invalid', reason: 'not_yet_valid' };
  if (opts.orgCountry && opts.orgCountry.toUpperCase() !== payload.country) {
    return { ...base, payload, status: 'invalid', reason: 'country_mismatch' };
  }
  if (opts.orgId && opts.orgId !== payload.orgId) {
    return { ...base, payload, status: 'invalid', reason: 'org_mismatch' };
  }
  if (effectiveNow >= payload.exp + payload.graceDays * DAY) {
    return { ...base, payload, status: 'read_only', reason: 'expired' };
  }
  if (opts.activeUsers !== undefined && opts.activeUsers > payload.maxUsers) {
    return { ...base, payload, status: 'read_only', reason: 'max_users_exceeded' };
  }
  if (effectiveNow >= payload.exp)
    return { ...base, payload, status: 'grace', reason: 'expired_grace' };
  return { ...base, payload, status: 'valid' };
}

/** Les écritures (nouvelles campagnes, etc.) ne sont permises qu'en `valid` ou `grace`. */
export function licenseAllowsWrites(status: LicenseStatus): boolean {
  return status === 'valid' || status === 'grace';
}

export function licenseHasFeature(
  ev: LicenseEvaluation,
  feature: LicensePayload['features'][number],
): boolean {
  return licenseAllowsWrites(ev.status) && !!ev.payload?.features.includes(feature);
}
