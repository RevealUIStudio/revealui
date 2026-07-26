# syntax=docker/dockerfile:1
#
# Multi-stage pnpm-workspace build, mirroring the fleet's proven pattern in
# apps/server/Dockerfile (monorepo-context build + `pnpm deploy` for a
# self-contained runtime dir). This actor is a workspace package
# (packages/apify-actor-governed-run) that depends on two other workspace
# packages (@revealui/ai, @revealui/security), so the build needs the
# monorepo context rather than Apify's standalone `apify/actor-node` base --
# Apify supports an arbitrary custom Dockerfile via .actor/actor.json's
# `dockerfile` field, which is what this is.
#
# NOT YET SMOKE-TESTED against a live `apify run` / Apify build system --
# verify with the Apify CLI before Store submission (see README.md).

FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY .npmrc* ./

# Workspace package.json files needed by the actor's dependency graph
COPY packages/ai/package.json ./packages/ai/
COPY packages/security/package.json ./packages/security/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/dev/package.json ./packages/dev/
COPY packages/resilience/package.json ./packages/resilience/
COPY packages/utils/package.json ./packages/utils/
COPY packages/apify-actor-governed-run/package.json ./packages/apify-actor-governed-run/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @revealui/apify-actor-governed-run...

# Builder stage
FROM base AS builder
COPY --from=deps /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

COPY turbo.json ./
COPY tsconfig.json ./
COPY packages ./packages

ENV NODE_ENV=production

RUN pnpm turbo run build --filter=@revealui/apify-actor-governed-run...

# Self-contained deploy dir with only production deps (pnpm deploy flattens
# the hoisted workspace packages into a flat node_modules)
RUN pnpm --filter @revealui/apify-actor-governed-run deploy /app/actor-deploy --prod --legacy

# Runner stage -- minimal image with only the built bundle
FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup --system --gid 1001 apify && \
    adduser --system --uid 1001 actor

COPY --from=builder /app/packages/apify-actor-governed-run/dist ./dist
COPY --from=builder /app/actor-deploy/package.json ./
COPY --from=builder /app/actor-deploy/node_modules ./node_modules

RUN chown -R actor:apify /app
USER actor

CMD ["node", "dist/main.js"]
