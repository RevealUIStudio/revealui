# syntax=docker/dockerfile:1

# Base stage with Node.js and pnpm
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

# Dependencies stage
FROM base AS deps
# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY .npmrc* ./

# Copy workspace package.json files needed by api
COPY packages/ai/package.json ./packages/ai/
COPY packages/auth/package.json ./packages/auth/
COPY packages/cache/package.json ./packages/cache/
COPY packages/config/package.json ./packages/config/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/dev/package.json ./packages/dev/
COPY packages/knowledge-graph/package.json ./packages/knowledge-graph/
COPY packages/mcp/package.json ./packages/mcp/
COPY packages/openapi/package.json ./packages/openapi/
COPY packages/paywall/package.json ./packages/paywall/
COPY packages/resilience/package.json ./packages/resilience/
COPY packages/security/package.json ./packages/security/
COPY packages/services/package.json ./packages/services/
COPY packages/setup/package.json ./packages/setup/
COPY packages/utils/package.json ./packages/utils/
COPY apps/server/package.json ./apps/server/

# Install dependencies with frozen lockfile
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter server...

# Builder stage
FROM base AS builder
COPY --from=deps /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules

# Copy source code
COPY turbo.json ./
COPY tsconfig.json ./
COPY packages ./packages
COPY apps/server ./apps/server

# Build the application (tsup bundles workspace deps into dist/)
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=true

RUN pnpm turbo run build --filter=server...

# Create a self-contained deploy directory with only production deps
# pnpm deploy resolves hoisted packages into a flat node_modules
RUN pnpm --filter server deploy /app/server-deploy --prod --legacy

# Runner stage — minimal image with only the built bundle
FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 hono

# Copy built application (tsup bundles workspace deps into dist/)
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/server-deploy/package.json ./

# Copy production node_modules (pnpm deploy flattens hoisted deps)
COPY --from=builder /app/server-deploy/node_modules ./node_modules

# Set ownership
RUN chown -R hono:nodejs /app

USER hono

EXPOSE 3004

# PORT is read by src/worker.ts (WORKER_PORT || PORT, falling back to 8080);
# setting it explicitly here keeps the container's default bind port at 3004
# to match this image's EXPOSE + every compose file's port mapping. A PaaS
# that injects its own PORT (Railway, Render, etc.) overrides this at runtime
# and the app follows it automatically.
ENV PORT=3004

# Health check — reads PORT so it still probes the right port when a
# platform overrides it at runtime (see PORT comment above).
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3004)+'/health',(r)=>{process.exit(r.statusCode===200?0:1)})"

# dist/index.ts is the Vercel serverless handler and is side-effect-free in
# production (no serve() call — see the NODE_ENV==='production' guard in
# src/index.ts). dist/worker.ts is the long-running entry that actually calls
# serve() and binds a port; it is what every real container deploy (Fly's
# apps/server/Dockerfile.forge, and this image) must run. Previously this
# Dockerfile ran dist/index.js, which meant `docker compose up` on
# docker-compose.yml booted the api container, passed validateStartup(), and
# then exited without ever listening on 3004 (GAP-430 audit finding).
CMD ["node", "dist/worker.js"]
