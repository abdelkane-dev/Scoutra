import 'server-only';
import { loadEnv, webEnvSchema, type WebEnv } from '@scoutra/config';

let cached: WebEnv | undefined;

/** Configuration validée (chargée paresseusement : `next build` n'a pas besoin des secrets). */
export function getEnv(): WebEnv {
  cached ??= loadEnv(webEnvSchema);
  return cached;
}
