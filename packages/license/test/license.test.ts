import { generateKeyPairSync } from 'node:crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  EMBEDDED_PUBLIC_KEYS,
  LicenseFormatError,
  loadPublicKeyring,
  evaluateLicense,
  licenseAllowsWrites,
  rawPublicKey,
  signLicense,
  verifyLicenseToken,
  type LicensePayload,
} from '../src';

function keypair() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    pem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    pub: rawPublicKey(publicKey),
  };
}

const k1 = keypair();
const k2 = keypair();
const keyring = { '2026-11': k1.pub, '2027-01': k2.pub };
const NOW = 1_795_000_000;
const DAY = 86_400;

const base: LicensePayload = {
  v: 1,
  lid: 'lic_01JTESTABCDEF',
  org: 'Société cliente SARL',
  orgId: '0193a1b2-0000-7000-8000-00000000000a',
  country: 'SN',
  maxUsers: 10,
  features: ['research', 'pipeline'],
  iat: NOW,
  nbf: NOW,
  exp: NOW + 365 * DAY,
  graceDays: 30,
  kid: '2026-11',
};

const payloadArb = fc.record({
  v: fc.constant(1 as const),
  lid: fc.stringMatching(/^lic_[A-Za-z0-9]{8,20}$/),
  org: fc.string({ minLength: 1, maxLength: 60 }),
  orgId: fc.uuid({ version: 7 }),
  country: fc.constantFrom('ML', 'SN', 'CI', 'FR', 'US'),
  maxUsers: fc.integer({ min: 1, max: 1000 }),
  features: fc.subarray(['research', 'pipeline', 'byo_keys'] as const),
  iat: fc.constant(NOW),
  nbf: fc.constant(NOW),
  exp: fc.integer({ min: NOW + 1, max: NOW + 3 * 365 * DAY }),
  graceDays: fc.integer({ min: 0, max: 90 }),
  kid: fc.constant('2026-11'),
});

describe('jeton de licence', () => {
  it('aller-retour signer/vérifier (propriété)', () => {
    fc.assert(
      fc.property(payloadArb, (p) => {
        expect(verifyLicenseToken(signLicense(p, k1.pem), keyring)).toEqual(p);
      }),
      { numRuns: 50 },
    );
  });

  it('toute altération d’un caractère du jeton est rejetée (propriété)', () => {
    const token = signLicense(base, k1.pem);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.=+/ ';
    fc.assert(
      fc.property(
        fc.nat({ max: token.length - 1 }),
        fc.constantFrom(...alphabet.split('')),
        (i, ch) => {
          fc.pre(token[i] !== ch);
          const tampered = token.slice(0, i) + ch + token.slice(i + 1);
          expect(() => verifyLicenseToken(tampered, keyring)).toThrow(LicenseFormatError);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('toute altération d’un octet du contenu ou de la signature est rejetée (propriété)', () => {
    const token = signLicense(base, k1.pem);
    const [body, sig] = token.split('.') as [string, string];
    fc.assert(
      fc.property(fc.boolean(), fc.nat(), fc.integer({ min: 1, max: 255 }), (inBody, pos, xor) => {
        const buf = Buffer.from(inBody ? body : sig, 'base64url');
        const i = pos % buf.length;
        buf[i] = buf[i]! ^ xor;
        const enc = buf.toString('base64url');
        const tampered = inBody ? `${enc}.${sig}` : `${body}.${enc}`;
        expect(() => verifyLicenseToken(tampered, keyring)).toThrow(LicenseFormatError);
      }),
      { numRuns: 500 },
    );
  });

  it('rejette une signature par une clé non autorisée ou un kid inconnu', () => {
    const forged = signLicense({ ...base, kid: '2026-11' }, keypair().pem);
    expect(() => verifyLicenseToken(forged, keyring)).toThrow(/signature/);
    expect(() =>
      verifyLicenseToken(signLicense({ ...base, kid: 'absent' }, k1.pem), keyring),
    ).toThrow(/kid/);
    expect(() =>
      verifyLicenseToken(signLicense({ ...base, kid: '__proto__' }, k1.pem), keyring),
    ).toThrow(/kid/);
  });

  it('rotation : une licence signée par la nouvelle clé (kid 2027-01) est acceptée', () => {
    const t = signLicense({ ...base, kid: '2027-01' }, k2.pem);
    expect(verifyLicenseToken(t, keyring).kid).toBe('2027-01');
    // Mais pas si le kid annonce l'ancienne clé.
    expect(() =>
      verifyLicenseToken(signLicense({ ...base, kid: '2026-11' }, k2.pem), keyring),
    ).toThrow();
  });

  it('rejette les structures douteuses', () => {
    for (const t of ['', 'a', 'a.b.c', `${'A'.repeat(5000)}.x`, 'e30.' + 'A'.repeat(86)]) {
      expect(() => verifyLicenseToken(t, keyring)).toThrow(LicenseFormatError);
    }
  });
});

describe('évaluation (dates, grâce, lecture seule)', () => {
  const token = signLicense(base, k1.pem);
  const ev = (now: number, extra = {}) => evaluateLicense(token, { keyring, now, ...extra });

  it('valide pendant la période', () => expect(ev(NOW + DAY).status).toBe('valid'));
  it('pas encore valide', () => expect(ev(NOW - DAY).reason).toBe('not_yet_valid'));
  it('période de grâce après expiration', () => {
    const r = ev(base.exp + 10 * DAY);
    expect(r.status).toBe('grace');
    expect(licenseAllowsWrites(r.status)).toBe(true);
  });
  it('lecture seule après la grâce', () => {
    const r = ev(base.exp + 31 * DAY);
    expect(r.status).toBe('read_only');
    expect(licenseAllowsWrites(r.status)).toBe(false);
  });
  it('pays et organisation vérifiés', () => {
    expect(ev(NOW + DAY, { orgCountry: 'ML' }).reason).toBe('country_mismatch');
    expect(ev(NOW + DAY, { orgCountry: 'sn' }).status).toBe('valid');
    expect(ev(NOW + DAY, { orgId: '0193a1b2-0000-7000-8000-00000000000b' }).reason).toBe(
      'org_mismatch',
    );
  });
  it('dépassement d’utilisateurs → lecture seule', () => {
    expect(ev(NOW + DAY, { activeUsers: 11 }).status).toBe('read_only');
    expect(ev(NOW + DAY, { activeUsers: 10 }).status).toBe('valid');
  });
  it('recul d’horloge détecté : calcul sur la date mémorisée', () => {
    const r = ev(NOW + DAY, { lastSeen: base.exp + 40 * DAY });
    expect(r.clockRollbackDetected).toBe(true);
    expect(r.status).toBe('read_only');
  });
  it('jeton invalide → invalid, jamais d’exception', () => {
    expect(evaluateLicense('nimporte.quoi', { keyring, now: NOW }).status).toBe('invalid');
  });
});

describe('trousseau (constat 10)', () => {
  const env = JSON.stringify({ 'client-1': k1.pub });
  it('clés d’environnement acceptées hors production', () => {
    expect(loadPublicKeyring(env)['client-1']).toBe(k1.pub);
  });
  it('ignorées quand allowEnvKeys=false (production licence) : licence auto-signée rejetée', () => {
    const ring = loadPublicKeyring(env, { allowEnvKeys: false });
    expect(ring).toBe(EMBEDDED_PUBLIC_KEYS);
    const selfSigned = signLicense({ ...base, kid: 'client-1' }, k1.pem);
    expect(evaluateLicense(selfSigned, { keyring: ring, now: NOW + DAY }).status).toBe('invalid');
  });
});
