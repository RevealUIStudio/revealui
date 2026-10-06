FROM node:24-alpine AS builder

RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /repo
RUN corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY .npmrc* tsconfig.json ./
COPY packages ./packages
COPY apps/review-controller ./apps/review-controller

RUN pnpm install --frozen-lockfile --filter "@revealui/review-controller..." --filter @revealui/harnesses
RUN pnpm --filter @revealui/harnesses build:gates
RUN pnpm --filter @revealui/review-controller build
RUN pnpm --filter @revealui/review-controller deploy /app/review-controller-deploy --prod --legacy

FROM node:24-alpine
WORKDIR /app
COPY --from=builder /repo/apps/review-controller/dist ./dist
COPY --from=builder /app/review-controller-deploy/package.json ./package.json
COPY --from=builder /app/review-controller-deploy/node_modules ./node_modules
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
