import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  // Paquets du monorepo publiés en TypeScript source.
  transpilePackages: [
    '@scoutra/core',
    '@scoutra/config',
    '@scoutra/db',
    '@scoutra/queue',
    '@scoutra/auth',
    '@scoutra/i18n',
    '@scoutra/license',
    '@scoutra/crypto',
  ],
  // Modules natifs / serveur : jamais empaquetés côté client.
  serverExternalPackages: ['@node-rs/argon2', 'pg', 'pg-boss'],
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
};

export default nextConfig;
