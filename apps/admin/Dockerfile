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

# Copy all workspace package.json files for dependency resolution.
# knowledge-graph, mcp, test, tokens were missing here (GAP-430 audit finding,
# proven via a real `docker build`): apps/admin/package.json depends on all
# four (directly or transitively through editor/mcp), but pnpm never saw
# their package.json during `pnpm install --filter admin...` below, so their
# own dependencies (e.g. packages/test's @electric-sql/pglite-pgvector
# devDependency) never installed and `turbo run build` failed downstream.
COPY packages/ai/package.json ./packages/ai/
COPY packages/auth/package.json ./packages/auth/
COPY packages/cache/package.json ./packages/cache/
COPY packages/config/package.json ./packages/config/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/dev/package.json ./packages/dev/
COPY packages/editor/package.json ./packages/editor/
COPY packages/knowledge-graph/package.json ./packages/knowledge-graph/
COPY packages/mcp/package.json ./packages/mcp/
COPY packages/paywall/package.json ./packages/paywall/
COPY packages/presentation/package.json ./packages/presentation/
COPY packages/resilience/package.json ./packages/resilience/
COPY packages/security/package.json ./packages/security/
COPY packages/services/package.json ./packages/services/
COPY packages/setup/package.json ./packages/setup/
COPY packages/sync/package.json ./packages/sync/
COPY packages/test/package.json ./packages/test/
COPY packages/tokens/package.json ./packages/tokens/
COPY packages/utils/package.json ./packages/utils/
COPY apps/admin/package.json ./apps/admin/

# Install dependencies with frozen lockfile
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter admin...

# Builder stage
FROM base AS builder
# Root manifest + lockfile — pnpm needs these in /app to resolve the workspace
# root before `turbo run build` below; without them it fails immediately with
# ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND (GAP-430 audit finding, proven via a
# real `docker build`). apps/server/Dockerfile already copies these.
COPY --from=deps /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules

# Copy source code
COPY turbo.json ./
COPY tsconfig.json ./
COPY packages ./packages
COPY apps/admin ./apps/admin

# Build the application
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=true

RUN pnpm turbo run build --filter=admin...

# Runner stage
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder /app/apps/admin/public ./apps/admin/public

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 4000

ENV PORT=4000
ENV HOSTNAME="0.0.0.0"
# GAP-214: run the engine's onInit (first-admin seeder) at runtime, not build.
# `next build` sets NEXT_PHASE so the build still correctly skips onInit; this
# only flips the *running* container out of RevealUIInstance's build-time
# guard (NODE_ENV=production && !RUNTIME_INIT). Without it a fresh container
# boots healthy but never seeds an admin, so login is impossible (signup is
# closed outside hosted SaaS). Mirrors apps/admin/Dockerfile.forge, which
# already sets this (GAP-430 audit finding: this plain Dockerfile did not).
ENV RUNTIME_INIT=1

# Health check — reads PORT so it still probes the right port when a
# platform overrides it at runtime.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||4000)+'/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "apps/admin/server.js"]
