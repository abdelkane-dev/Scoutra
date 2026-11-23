'use client';
import { createAuthClient } from 'better-auth/react';
import {
  inferOrgAdditionalFields,
  organizationClient,
  twoFactorClient,
} from 'better-auth/client/plugins';
import { BETTER_AUTH_ROLES } from '@scoutra/auth/roles';

/**
 * Client Better Auth (routes /api/auth/*, même origine : cookies HttpOnly, aucun jeton côté JS).
 * Organisation : champ supplémentaire countryCode (pays d'établissement, figé après création).
 */
export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      roles: BETTER_AUTH_ROLES,
      schema: inferOrgAdditionalFields({
        organization: {
          additionalFields: { countryCode: { type: 'string', required: true, input: true } },
        },
      }),
    }),
    twoFactorClient({
      onTwoFactorRedirect() {
        const next = new URLSearchParams(window.location.search).get('next');
        window.location.assign(`/two-factor${next ? `?next=${encodeURIComponent(next)}` : ''}`);
      },
    }),
  ],
});

export type AuthErrorLike =
  | { code?: string | undefined; message?: string | undefined; status?: number | undefined }
  | null
  | undefined;

/** Code d'erreur normalisé (Better Auth renvoie un code, ou un message court côté Scoutra). */
export function authErrorCode(err: AuthErrorLike): string {
  if (!err) return 'unknown';
  if (err.status === 429) return 'rate_limited';
  const raw = (err.code || err.message || '').toString();
  const known = [
    'signup_disabled',
    'rate_limited',
    'two_factor_required',
    'invalid_country_code',
    'country_change_forbidden',
    'forbidden',
  ];
  if (known.includes(raw)) return raw;
  return raw.toUpperCase();
}

/** N'accepte qu'un chemin interne comme destination après connexion (pas de redirection ouverte). */
export function safeNext(next: string | null | undefined, fallback = '/home'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
    return fallback;
  return next;
}
