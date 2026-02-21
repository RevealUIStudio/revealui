# syntax=docker/dockerfile:1

# Base stage with Node.js and pnpm
FROM node:24.13.0-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

# Dependencies stage
FROM base AS deps
# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Copy all workspace package.json files for dependency resolution
COPY packages/auth/package.json ./packages/auth/
COPY packages/config/package.json ./packages/config/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/core/package.json ./packages/core/
COPY packages/dev/package.json ./packages/dev/
COPY packages/presentation/package.json ./packages/presentation/
COPY packages/services/package.json ./packages/services/
COPY packages/sync/package.json ./packages/sync/
COPY packages/test/package.json ./packages/test/
COPY apps/web/package.json ./apps/web/

# Install dependencies with frozen lockfile
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter web...

# Builder stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy source code
COPY turbo.json ./
COPY tsconfig.json ./
COPY packages ./packages
COPY apps/web ./apps/web

# Build the application (Hono SSR)
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=true

RUN pnpm --filter web run build

# Runner stage with Node.js
FROM base AS runner
ENV NODE_ENV=production

# Install wget for health checks
RUN apk add --no-cache wget

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder /app/apps/web/dist ./dist
COPY --from=builder /app/apps/web/package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

# Set ownership
RUN chown -R appuser:nodejs /app

USER appuser

EXPOSE 8000

ENV PORT=8000
ENV HOSTNAME="0.0.0.0"

# Health check (assumes Hono app has /health endpoint)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health || exit 1

# Run the Hono server
CMD ["node", "dist/hono-entry.js"]
