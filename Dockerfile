# syntax=docker/dockerfile:1
# Images épinglées par empreinte (digest) : mise à jour volontaire et relue uniquement.
ARG NODE_IMAGE=node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee

FROM ${NODE_IMAGE} AS build
ENV NEXT_TELEMETRY_DISABLED=1 CI=1
RUN corepack enable
WORKDIR /repo
COPY . .
# Scripts d'installation bloqués par défaut (pnpm 10), lockfile figé.
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @scoutra/web build && pnpm --filter @scoutra/worker build

# --- Application web (Next.js standalone) ---
FROM ${NODE_IMAGE} AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]

# --- Worker + migrations (bundle esbuild autonome) ---
FROM ${NODE_IMAGE} AS worker
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/worker/dist ./dist
USER node
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8081/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
