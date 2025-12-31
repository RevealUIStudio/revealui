# Deployment Guide

Deploy your RevealUI application.

## Vercel (Recommended)

RevealUI is optimized for Vercel:

1. **Connect your repository:**

```bash
vercel
```

2. **Configure environment variables:**

- `PAYLOAD_SECRET`
- `POSTGRES_URL`
- `BLOB_READ_WRITE_TOKEN`

3. **Deploy:**

```bash
vercel --prod
```

## Other Platforms

### Self-Hosting

1. **Build your app:**

```bash
pnpm build
```

2. **Start the server:**

```bash
pnpm start
```

### Docker

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build
CMD ["pnpm", "start"]
```

## Environment Variables

Configure these in your deployment platform:

- `NODE_ENV` - Set to `production`
- `PAYLOAD_SECRET` - PayloadCMS secret
- `POSTGRES_URL` - Database connection string
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob token

## Build Optimization

Optimize your build:

```bash
# Production build
NODE_ENV=production pnpm build

# Analyze bundle size
pnpm build --analyze
```

## Health Checks

Configure health check endpoints:

```typescript
// Health check is available at /api/health
// Readiness probe at /api/health/ready
```

## Monitoring

Enable monitoring:

- Sentry for error tracking
- Vercel Speed Insights for performance
- Structured logging for observability

## Learn More

- [Environment Variables Guide](./environment-variables.md)
- [Deployment Runbook](../DEPLOYMENT-RUNBOOK.md)
- [Multi-Tenant Architecture](../MULTI-TENANT-ARCHITECTURE.md)

