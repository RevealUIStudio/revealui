# Docker Setup Notes

## Important: Next.js Standalone Output

The Dockerfiles for CMS, Dashboard, and Landing apps assume Next.js standalone output mode. This needs to be configured in each app's `next.config.js` or `next.config.mjs`.

### Required Configuration

Add to `next.config.js` or `next.config.mjs`:

```javascript
// next.config.js
export default {
  // ... other config
  output: 'standalone',
  // ... other config
}
```

Or if using TypeScript config:

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  // ... other config
  output: 'standalone',
  // ... other config
}

export default config
```

### Files to Update

1. `apps/cms/next.config.js` or `apps/cms/next.config.mjs`
2. `apps/dashboard/next.config.js` or `apps/dashboard/next.config.mjs`
3. `apps/landing/next.config.js` or `apps/landing/next.config.mjs`

### What This Does

The `output: 'standalone'` setting tells Next.js to:
- Create a minimal standalone deployment in `.next/standalone/`
- Include only necessary production dependencies
- Generate a `server.js` file for running the app
- Optimize the output for Docker deployment

### Dockerfile Expectations

The Dockerfiles expect this structure:
```
.next/
├── standalone/          # Minimal production build
│   ├── server.js       # Entry point
│   ├── node_modules/   # Only required deps
│   └── apps/cms/       # App files
├── static/             # Static assets
└── ...
```

### Testing Locally

After adding `output: 'standalone'`, test the build:

```bash
# Build the app
pnpm --filter cms build

# Check that standalone output exists
ls -la apps/cms/.next/standalone/

# Should see server.js
ls -la apps/cms/.next/standalone/apps/cms/
```

### Alternative: Modify Dockerfiles

If you don't want to use standalone output, you can modify the Dockerfiles to use the standard Next.js build:

**Current (standalone):**
```dockerfile
COPY --from=builder /app/apps/cms/.next/standalone ./
COPY --from=builder /app/apps/cms/.next/static ./apps/cms/.next/static
CMD ["node", "apps/cms/server.js"]
```

**Alternative (standard):**
```dockerfile
COPY --from=builder /app/apps/cms/.next ./apps/cms/.next
COPY --from=builder /app/apps/cms/package.json ./apps/cms/
CMD ["pnpm", "--filter", "cms", "start"]
```

### Health Check Endpoint

The Dockerfiles assume a health check endpoint at `/api/health`. If this doesn't exist, create it:

**File:** `apps/cms/app/api/health/route.ts` (App Router)
```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
}
```

Or **File:** `apps/cms/pages/api/health.ts` (Pages Router)
```typescript
import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
}
```

### Troubleshooting

#### Error: "Cannot find module 'server.js'"

**Solution:** Add `output: 'standalone'` to next.config.js and rebuild.

#### Error: "Module not found" during Docker build

**Solution:** Check that the dependencies are correctly installed in the deps stage. The `pnpm install --filter <app>...` command should install all workspace dependencies.

#### Large Image Size

**Solution:**
1. Verify `.dockerignore` is excluding unnecessary files
2. Use `docker history <image>` to identify large layers
3. Consider multi-stage build optimizations

#### Slow Builds

**Solution:**
1. Use BuildKit caching: `DOCKER_BUILDKIT=1 docker build ...`
2. Verify pnpm store is being cached
3. Use `--mount=type=cache` for node_modules (already in Dockerfiles)

## Build Order Recommendations

When building multiple apps, build in this order for optimal cache usage:

1. **web** (smallest, static only)
2. **docs** (similar to web)
3. **landing** (Next.js, fewer dependencies)
4. **dashboard** (Next.js, moderate dependencies)
5. **cms** (largest, most dependencies)

Example:
```bash
docker build -f apps/web/Dockerfile -t revealui-web:latest .
docker build -f apps/docs/Dockerfile -t revealui-docs:latest .
docker build -f apps/landing/Dockerfile -t revealui-landing:latest .
docker build -f apps/dashboard/Dockerfile -t revealui-dashboard:latest .
docker build -f apps/cms/Dockerfile -t revealui-cms:latest .
```

## Production Deployment Checklist

Before deploying to production:

- [ ] Add `output: 'standalone'` to all Next.js apps
- [ ] Create `/api/health` endpoints in all apps
- [ ] Test Docker builds locally
- [ ] Verify `.dockerignore` excludes secrets
- [ ] Set all required environment variables
- [ ] Test health checks work
- [ ] Verify resource limits are appropriate
- [ ] Test the full production stack with docker-compose
- [ ] Run security scan on images
- [ ] Check image sizes are reasonable (<500MB per app)

## Security Checklist

- [ ] No secrets in images (verify with `docker history`)
- [ ] Non-root user configured
- [ ] Resource limits set
- [ ] Health checks configured
- [ ] Only required files copied (via .dockerignore)
- [ ] Latest base images used
- [ ] Vulnerability scanning enabled (Trivy in CI)

## Performance Optimization

### Build Performance
- Use BuildKit for better caching
- Leverage layer caching with `--cache-from`
- Use pnpm store cache mount
- Order Dockerfile commands from least to most frequently changing

### Runtime Performance
- Use alpine base images (already done)
- Minimize layer count in final image
- Use multi-stage builds (already done)
- Set appropriate resource limits

### Network Performance
- Use CDN for static assets
- Enable gzip compression (nginx)
- Optimize image formats
- Minimize bundle sizes

## Monitoring

### Docker Health Checks
```bash
# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# View health check logs
docker inspect revealui-cms | jq '.[0].State.Health'
```

### Resource Usage
```bash
# Monitor resource usage
docker stats

# Specific container
docker stats revealui-cms
```

### Logs
```bash
# View logs
docker logs revealui-cms

# Follow logs
docker logs -f revealui-cms

# Last 100 lines
docker logs --tail 100 revealui-cms
```

## Additional Resources

- [Next.js Docker Documentation](https://nextjs.org/docs/deployment#docker-image)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Dockerfile Reference](https://docs.docker.com/engine/reference/builder/)
- [pnpm Docker Guide](https://pnpm.io/docker)
