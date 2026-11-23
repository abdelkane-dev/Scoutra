import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import type { VerificationStatus } from '@scoutra/core';

const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;
const WEBMAIL = new Set([
  'gmail.com',
  'yahoo.com',
  'yahoo.fr',
  'hotmail.com',
  'hotmail.fr',
  'outlook.com',
  'outlook.fr',
  'live.com',
  'icloud.com',
  'aol.com',
  'orange.fr',
  'free.fr',
  'gmx.com',
  'proton.me',
  'protonmail.com',
]);
const DISPOSABLE = new Set([
  'mailinator.com',
  'yopmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'trashmail.com',
  'temp-mail.org',
]);
const ROLE_LOCALS =
  /^(contact|info|infos|hello|bonjour|sales|ventes|commercial|admin|office|accueil|support|service|team|equipe|direction|secretariat|marketing|rh|hr|jobs|recrutement)$/i;

export interface EmailCheck {
  status: VerificationStatus;
  normalized: string;
  isRoleAddress: boolean;
  checks: {
    syntax: boolean;
    mx: boolean | null;
    smtp: string | null;
    disposable: boolean;
    webmail: boolean;
  };
}

export interface VerifyDeps {
  /** Résolution MX (dns.promises.resolveMx en production, simulée en test). */
  resolveMx(domain: string): Promise<string[]>;
  /** Reacher auto-hébergé si configuré (vérification SMTP), sinon absent. */
  reacher?(email: string): Promise<'safe' | 'invalid' | 'risky' | 'unknown' | 'catch_all'>;
}

/** Vérification d'email : syntaxe → jetable/webmail → MX → SMTP (Reacher, optionnel). */
export async function verifyEmail(raw: string, deps: VerifyDeps): Promise<EmailCheck> {
  const normalized = raw.trim().toLowerCase();
  const syntax = normalized.length <= 254 && EMAIL_RE.test(normalized);
  const [local = '', domain = ''] = normalized.split('@');
  const base = { normalized, isRoleAddress: ROLE_LOCALS.test(local) };
  const checks: EmailCheck['checks'] = {
    syntax,
    mx: null,
    smtp: null,
    disposable: DISPOSABLE.has(domain),
    webmail: WEBMAIL.has(domain),
  };
  if (!syntax) return { ...base, status: 'invalid', checks };
  if (checks.disposable) return { ...base, status: 'disposable', checks };
  try {
    checks.mx = (await deps.resolveMx(domain)).length > 0;
  } catch {
    checks.mx = false;
  }
  if (!checks.mx) return { ...base, status: 'invalid', checks };
  if (checks.webmail) return { ...base, status: 'webmail', checks };
  if (deps.reacher) {
    try {
      const r = await deps.reacher(normalized);
      checks.smtp = r;
      const map = {
        safe: 'valid',
        invalid: 'invalid',
        risky: 'risky',
        catch_all: 'accept_all',
        unknown: 'unknown',
      } as const;
      return { ...base, status: map[r], checks };
    } catch {
      checks.smtp = 'error';
    }
  }
  // MX valide sans test SMTP : non garanti.
  return { ...base, status: 'unknown', checks };
}

export interface PhoneCheck {
  valid: boolean;
  e164?: string;
  country?: string;
  type?: string;
}

/** Téléphone : format, pays, type (libphonenumber-js). */
export function verifyPhone(raw: string, defaultCountry: string): PhoneCheck {
  const p = parsePhoneNumberFromString(raw, defaultCountry as CountryCode);
  if (!p || !p.isValid()) return { valid: false };
  return { valid: true, e164: p.number, country: p.country, type: p.getType() };
}
