import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { EnvError, loadEnv, secretWeakness, webEnvSchema, workerEnvSchema } from '../src';

const strong = () => randomBytes(24).toString('hex');
const pgUrl = (user: string, pw = strong()) => `postgres://${user}:${pw}@db:5432/scoutra`;
const valid = () => ({
  DATABASE_URL: pgUrl('scoutra_app'),
  DATABASE_AUTH_URL: pgUrl('scoutra_auth'),
  SCOUTRA_MASTER_KEY: randomBytes(32).toString('base64'),
  SCOUTRA_HASH_KEY: randomBytes(32).toString('base64'),
  BETTER_AUTH_SECRET: randomBytes(32).toString('base64url'),
  BETTER_AUTH_URL: 'http://localhost:3000',
});

describe('validation de l’environnement', () => {
  it('accepte une configuration générée', () => {
    const env = loadEnv(webEnvSchema, valid());
    expect(env.SCOUTRA_MODE).toBe('saas');
    expect(env.SCOUTRA_ALLOW_SIGNUP).toBe(false);
    expect(env.SCOUTRA_REQUIRE_EMAIL_VERIFICATION).toBe(true);
  });

  it.each([
    ['BETTER_AUTH_SECRET', 'changeme-changeme-changeme-changeme'],
    ['BETTER_AUTH_SECRET', 'a'.repeat(40)],
    ['BETTER_AUTH_SECRET', 'court'],
    ['SCOUTRA_MASTER_KEY', Buffer.alloc(32).toString('base64')],
    ['SCOUTRA_MASTER_KEY', 'pas-du-base64'],
    ['DATABASE_URL', 'postgres://scoutra_app:postgres@db:5432/scoutra'],
    ['DATABASE_URL', 'mysql://u:p@h/db'],
  ])('refuse %s faible : %s', (key, value) => {
    expect(() => loadEnv(webEnvSchema, { ...valid(), [key]: value })).toThrow(EnvError);
  });

  it('refuse un secret manquant ou vide, sans jamais afficher les valeurs', () => {
    const env = { ...valid(), BETTER_AUTH_SECRET: '' };
    try {
      loadEnv(webEnvSchema, env);
      expect.unreachable();
    } catch (e) {
      expect(String(e)).toMatch(/BETTER_AUTH_SECRET/);
      expect(String(e)).not.toContain(env.SCOUTRA_MASTER_KEY);
    }
  });

  it('Google : les deux variables ou aucune', () => {
    expect(() =>
      loadEnv(webEnvSchema, { ...valid(), GOOGLE_CLIENT_ID: '1234567890.apps' }),
    ).toThrow(/GOOGLE/);
  });

  it('HTTPS obligatoire en production, licence obligatoire en mode licence', () => {
    expect(() => loadEnv(webEnvSchema, { ...valid(), NODE_ENV: 'production' })).toThrow(/HTTPS/);
    expect(() => loadEnv(webEnvSchema, { ...valid(), SCOUTRA_MODE: 'license' })).toThrow(/LICENSE/);
  });

  it('worker', () => {
    const { DATABASE_URL, SCOUTRA_MASTER_KEY, SCOUTRA_HASH_KEY } = valid();
    expect(
      loadEnv(workerEnvSchema, { DATABASE_URL, SCOUTRA_MASTER_KEY, SCOUTRA_HASH_KEY })
        .WORKER_HEALTH_PORT,
    ).toBe(8081);
  });

  it('secretWeakness', () => {
    expect(secretWeakness(undefined, { minLength: 8 })).toBe('manquant');
    expect(secretWeakness('<votre-secret-ici-0123456789>', { minLength: 8 })).toBe(
      'valeur d’exemple',
    );
    expect(secretWeakness(strong(), { minLength: 32 })).toBeNull();
  });
});
