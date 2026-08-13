# apps/license-signer/Dockerfile
#
# Isolated license JWT mint service (GAP-260 P4-2 / P4-4).
# Holds REVEALUI_LICENSE_PRIVATE_KEY; HMAC-authed POST /internal/mint.
#
# Build context: monorepo root.
#   cd ~/revfleet/revealui
#   flyctl deploy --config apps/license-signer/fly.toml \
#     --dockerfile apps/license-signer/Dockerfile --remote-only

FROM node:24-alpine AS builder

RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /repo
RUN corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY .npmrc* tsconfig.json ./
COPY packages ./packages
COPY apps/license-signer ./apps/license-signer

RUN pnpm install --frozen-lockfile --filter "@revealui/license-signer..."
RUN pnpm --filter "@revealui/license-signer..." build

FROM node:24-alpine

WORKDIR /app
# tsup emits index.js plus code-split chunks; copy the whole dist.
COPY --from=builder /repo/apps/license-signer/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]
