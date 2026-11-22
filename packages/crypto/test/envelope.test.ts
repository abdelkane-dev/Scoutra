import { randomBytes } from 'node:crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DecryptionError,
  createKeyring,
  decodeMasterKey,
  decryptSecret,
  encryptSecret,
  keyedHash,
  normalizeContactValue,
  rewrapSecret,
} from '../src';

const k1 = randomBytes(32).toString('base64');
const k2 = randomBytes(32).toString('base64');
const ring = createKeyring(1, { 1: k1 });
const ORG_A = '0193a1b2-0000-7000-8000-00000000000a';
const ORG_B = '0193a1b2-0000-7000-8000-00000000000b';
const ctxA = { orgId: ORG_A, purpose: 'api_credential:anthropic' };

describe('chiffrement par enveloppe', () => {
  it('aller-retour (propriété)', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (plain) => {
        expect(decryptSecret(encryptSecret(plain, ctxA, ring), ctxA, ring)).toBe(plain);
      }),
    );
  });

  it('IV et DEK différents à chaque chiffrement', () => {
    const a = encryptSecret('sk-test', ctxA, ring);
    const b = encryptSecret('sk-test', ctxA, ring);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.wrappedDek).not.toBe(b.wrappedDek);
  });

  it('refuse une autre organisation (AAD)', () => {
    const enc = encryptSecret('sk-secret', ctxA, ring);
    expect(() => decryptSecret(enc, { ...ctxA, orgId: ORG_B }, ring)).toThrow(DecryptionError);
    expect(() => decryptSecret(enc, { ...ctxA, purpose: 'autre' }, ring)).toThrow(DecryptionError);
  });

  it('refuse une mauvaise clé maître', () => {
    const enc = encryptSecret('sk-secret', ctxA, ring);
    expect(() => decryptSecret(enc, ctxA, createKeyring(1, { 1: k2 }))).toThrow(DecryptionError);
  });

  it('toute altération d’un octet est détectée (propriété)', () => {
    const enc = encryptSecret('valeur sensible', ctxA, ring);
    fc.assert(
      fc.property(
        fc.constantFrom('ciphertext', 'wrappedDek'),
        fc.nat(),
        fc.integer({ min: 1, max: 255 }),
        (field, pos, xor) => {
          const buf = Buffer.from(enc[field], 'base64');
          const i = pos % buf.length;
          buf[i] = buf[i]! ^ xor;
          const tampered = { ...enc, [field]: buf.toString('base64') };
          expect(() => decryptSecret(tampered, ctxA, ring)).toThrow(DecryptionError);
        },
      ),
    );
  });

  it('rotation : ré-enveloppe la DEK puis l’ancienne clé peut être retirée', () => {
    const enc = encryptSecret('sk-rotate', ctxA, ring);
    const ring2 = createKeyring(2, { 1: k1, 2: k2 });
    const rewrapped = rewrapSecret(enc, ctxA, ring2);
    expect(rewrapped.keyVersion).toBe(2);
    expect(rewrapped.ciphertext).toBe(enc.ciphertext);
    expect(decryptSecret(rewrapped, ctxA, createKeyring(2, { 2: k2 }))).toBe('sk-rotate');
  });

  it('refuse une clé maître faible ou mal formée', () => {
    expect(() => decodeMasterKey(Buffer.alloc(32).toString('base64'))).toThrow(/faible/);
    expect(() => decodeMasterKey(randomBytes(16).toString('base64'))).toThrow(/32 octets/);
    expect(() => decodeMasterKey('changeme')).toThrow();
  });
});

describe('empreintes', () => {
  const hk = randomBytes(32);
  it('stable après normalisation, dépend du périmètre', () => {
    const a = keyedHash(normalizeContactValue('email', ' Jean@Exemple.ML '), hk, 'email');
    const b = keyedHash(normalizeContactValue('email', 'jean@exemple.ml'), hk, 'email');
    expect(a).toBe(b);
    expect(keyedHash('jean@exemple.ml', hk, 'phone')).not.toBe(a);
    expect(normalizeContactValue('phone', '+223 70 00-00-00')).toBe('+22370000000');
  });
});
