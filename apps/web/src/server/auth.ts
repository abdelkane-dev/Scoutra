import 'server-only';
import { createAuth, createDevEmailSender, type Auth } from '@scoutra/auth';
import { authDb } from './db';
import { getEnv } from './env';

let instance: Auth | undefined;

/** Instance Better Auth unique (route /api/auth/* et lecture de session côté serveur). */
export function getAuth(): Auth {
  if (!instance) {
    const env = getEnv();
    instance = createAuth({ env, authDb: authDb(), email: createDevEmailSender(env.NODE_ENV) });
  }
  return instance;
}
