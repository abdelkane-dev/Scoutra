import { NextResponse, type NextRequest } from 'next/server';

/**
 * En-têtes de sécurité sur toutes les pages (E8) : CSP stricte à nonce (une valeur par
 * requête, lisible côté serveur via l'en-tête `x-nonce`), anti-cadrage, nosniff, etc.
 * L'authentification n'est PAS décidée ici : elle est vérifiée côté serveur dans chaque
 * route et layout (src/server/session.ts), le proxy n'étant qu'une couche optimiste.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Attributs style inline nécessaires aux composants/animations ; pas de script inline.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set('content-security-policy', csp);
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set(
    'permissions-policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  );
  response.headers.set('cross-origin-opener-policy', 'same-origin');
  if (!dev)
    response.headers.set('strict-transport-security', 'max-age=63072000; includeSubDomains');
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }],
    },
  ],
};
