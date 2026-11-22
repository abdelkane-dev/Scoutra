import { z } from 'zod';
import { base64KeyWeakness, secretWeakness } from './secrets';

const secret = (minLength: number) =>
  z.string().superRefine((v, ctx) => {
    const w = secretWeakness(v, { minLength });
    if (w) ctx.addIssue({ code: 'custom', message: w });
  });

const base64Key = z.string().superRefine((v, ctx) => {
  const w = base64KeyWeakness(v);
  if (w) ctx.addIssue({ code: 'custom', message: w });
});

const postgresUrl = z
  .string()
  .url()
  .refine((u) => /^postgres(ql)?:\/\//.test(u), 'URL postgres:// attendue')
  .superRefine((u, ctx) => {
    let password = '';
    try {
      password = decodeURIComponent(new URL(u).password);
    } catch {
      /* déjà signalé par .url() */
    }
    const w = secretWeakness(password, { minLength: 24 });
    if (w) ctx.addIssue({ code: 'custom', message: `mot de passe ${w}` });
  });

const bool = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SCOUTRA_MODE: z.enum(['saas', 'license']).default('saas'),
  /** Rôle scoutra_app (RLS appliquée). */
  DATABASE_URL: postgresUrl,
  SCOUTRA_MASTER_KEY: base64Key,
  SCOUTRA_MASTER_KEY_VERSION: z.coerce.number().int().min(1).max(32767).default(1),
  /** Ancienne clé maître pendant une rotation : « version:base64 ». */
  SCOUTRA_MASTER_KEY_PREVIOUS: z
    .string()
    .regex(/^\d+:[A-Za-z0-9+/=]+$/)
    .optional(),
  SCOUTRA_HASH_KEY: base64Key,
  SCOUTRA_LICENSE_TOKEN: z.string().max(4096).optional(),
  SCOUTRA_LICENSE_PUBLIC_KEYS: z.string().optional(),
});

export const webEnvSchema = baseSchema
  .extend({
    /** Rôle scoutra_auth (Better Auth, tables d'identité uniquement). */
    DATABASE_AUTH_URL: postgresUrl,
    BETTER_AUTH_SECRET: secret(32),
    BETTER_AUTH_URL: z.string().url(),
    /** Origines supplémentaires autorisées (séparées par des virgules). */
    SCOUTRA_TRUSTED_ORIGINS: z.string().optional(),
    /** Inscription publique ; sinon seul le premier compte (installation) ou une invitation. */
    SCOUTRA_ALLOW_SIGNUP: bool,
    SCOUTRA_REQUIRE_EMAIL_VERIFICATION: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    GOOGLE_CLIENT_ID: z.string().min(10).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(10).optional(),
  })
  .superRefine((env, ctx) => {
    if (!!env.GOOGLE_CLIENT_ID !== !!env.GOOGLE_CLIENT_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['GOOGLE_CLIENT_SECRET'],
        message: 'GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET vont ensemble',
      });
    }
    if (env.NODE_ENV === 'production' && !env.BETTER_AUTH_URL.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['BETTER_AUTH_URL'],
        message: 'HTTPS obligatoire en production',
      });
    }
    if (env.SCOUTRA_MODE === 'license' && !env.SCOUTRA_LICENSE_TOKEN) {
      ctx.addIssue({
        code: 'custom',
        path: ['SCOUTRA_LICENSE_TOKEN'],
        message: 'obligatoire en mode licence',
      });
    }
  });

export const workerEnvSchema = baseSchema.extend({
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1024).max(65535).default(8081),
});

export const migrateEnvSchema = z.object({
  /** Rôle propriétaire : uniquement pour les migrations. */
  DATABASE_MIGRATOR_URL: postgresUrl,
});

export type WebEnv = z.infer<typeof webEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type MigrateEnv = z.infer<typeof migrateEnvSchema>;

export class EnvError extends Error {
  constructor(issues: string[]) {
    super(
      `Configuration invalide, démarrage refusé :\n${issues.map((i) => `  - ${i}`).join('\n')}\nVoir .env.example et scripts/init-secrets.sh.`,
    );
    this.name = 'EnvError';
  }
}

/** Valide l'environnement. Les messages citent les NOMS de variables, jamais leurs valeurs. */
export function loadEnv<S extends z.ZodType>(
  schema: S,
  source: Record<string, string | undefined> = process.env,
): z.infer<S> {
  // Les chaînes vides valent « absente ».
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== undefined && v !== ''),
  );
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    throw new EnvError(
      result.error.issues.map((i) => `${i.path.join('.') || '(racine)'} : ${i.message}`),
    );
  }
  return result.data;
}
