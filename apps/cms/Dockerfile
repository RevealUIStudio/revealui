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

# Copy all workspace package.json files for dependency resolution
COPY packages/auth/package.json ./packages/auth/
COPY packages/cache/package.json ./packages/cache/
COPY packages/config/package.json ./packages/config/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/dev/package.json ./packages/dev/
COPY packages/presentation/package.json ./packages/presentation/
COPY packages/resilience/package.json ./packages/resilience/
COPY packages/security/package.json ./packages/security/
COPY packages/sync/package.json ./packages/sync/
COPY packages/utils/package.json ./packages/utils/
COPY apps/cms/package.json ./apps/cms/

# Install dependencies with frozen lockfile
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter cms...

# Builder stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/cms/node_modules ./apps/cms/node_modules

# Copy source code
COPY turbo.json ./
COPY tsconfig.json ./
COPY packages ./packages
COPY apps/cms ./apps/cms

# Build the application
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=true

RUN pnpm --filter cms run build

# Runner stage
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/apps/cms/.next/standalone ./
COPY --from=builder /app/apps/cms/.next/static ./apps/cms/.next/static
COPY --from=builder /app/apps/cms/public ./apps/cms/public

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 4000

ENV PORT=4000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "apps/cms/server.js"]
