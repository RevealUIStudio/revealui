# syntax=docker/dockerfile:1

# Base stage with Node.js and pnpm
FROM node:24.12.0-alpine AS base
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

# Build the application
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=true

RUN pnpm --filter web run build

# Runner stage with nginx
FROM nginx:1.27-alpine AS runner

# Copy nginx configuration
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Create health check endpoint
RUN echo 'OK' > /usr/share/nginx/html/health

# Set ownership
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
