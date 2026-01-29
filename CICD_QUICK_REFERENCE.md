# CI/CD Quick Reference Guide

## Docker Commands

### Build Individual Apps
```bash
# CMS (Next.js)
docker build -f apps/cms/Dockerfile -t revealui-cms:latest .

# Web (Vite + nginx)
docker build -f apps/web/Dockerfile -t revealui-web:latest .

# Docs (Vite + nginx)
docker build -f apps/docs/Dockerfile -t revealui-docs:latest .

# Dashboard (Next.js)
docker build -f apps/dashboard/Dockerfile -t revealui-dashboard:latest .

# Landing (Next.js)
docker build -f apps/landing/Dockerfile -t revealui-landing:latest .
```

### Production Stack
```bash
# Start all services
docker-compose -f docker-compose.production.yml up -d

# View logs
docker-compose -f docker-compose.production.yml logs -f

# Check status
docker-compose -f docker-compose.production.yml ps

# Stop services
docker-compose -f docker-compose.production.yml down

# Stop and remove volumes
docker-compose -f docker-compose.production.yml down -v
```

### Health Checks
```bash
# CMS health check
curl http://localhost:4000/api/health

# Web health check
curl http://localhost:8000/health

# Electric health check
curl http://localhost:3001/health

# Postgres health check
docker exec revealui-postgres pg_isready -U revealui
```

### Troubleshooting
```bash
# View container logs
docker logs revealui-cms
docker logs revealui-web
docker logs revealui-postgres
docker logs revealui-electric

# Inspect image
docker inspect revealui-cms:latest

# Check image history
docker history revealui-cms:latest

# Exec into container
docker exec -it revealui-cms sh
docker exec -it revealui-postgres psql -U revealui

# Clean up
docker system prune -a --volumes
```

## Testing Commands

### Unit Tests
```bash
# Run all unit tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run specific package tests
pnpm --filter @revealui/core test
pnpm --filter @revealui/services test
pnpm --filter @revealui/contracts test
```

### Integration Tests
```bash
# Run all integration tests
pnpm test:integration

# Run integration tests directly
tsx scripts/engineer/test/run-integration-tests.ts
```

### E2E Tests
```bash
# Run all E2E tests
pnpm --filter @revealui/test exec playwright test

# Run smoke tests only
pnpm --filter @revealui/test exec playwright test --grep @smoke

# Run specific browser
pnpm --filter @revealui/test exec playwright test --project=chromium
pnpm --filter @revealui/test exec playwright test --project=firefox
pnpm --filter @revealui/test exec playwright test --project=webkit

# Run in UI mode
pnpm --filter @revealui/test exec playwright test --ui

# Show report
pnpm --filter @revealui/test exec playwright show-report
```

## CI/CD Commands

### Local CI Validation
```bash
# Lint
pnpm lint
pnpm lint:biome
pnpm lint:eslint

# Typecheck
pnpm typecheck:all

# Build all apps
pnpm build

# Build specific app
pnpm --filter cms build
pnpm --filter web build
```

### Environment Validation
```bash
# Validate CI environment
tsx scripts/ci/validate-env.ts ci

# Validate staging environment
tsx scripts/ci/validate-env.ts staging

# Validate production environment
tsx scripts/ci/validate-env.ts production
```

### Security Scanning
```bash
# Run dependency audit
pnpm audit --audit-level=moderate

# Fix vulnerabilities
pnpm audit --fix
```

## Deployment Commands

### Manual Deployment
```bash
# Deploy to staging (requires Vercel CLI)
vercel --scope=<org-id>

# Deploy to production
vercel --prod --scope=<org-id>
```

### GitHub Actions
```bash
# Trigger staging deployment
# (Automatic on push to main)

# Trigger production deployment
# Go to: Actions → Deploy to Production → Run workflow
# Enter version (e.g., v1.0.0)

# Trigger PR preview
# (Automatic on PR open/sync)
```

## Monitoring Commands

### Check CI Status
```bash
# View recent workflow runs
gh run list

# View specific run
gh run view <run-id>

# Watch run in real-time
gh run watch

# View logs
gh run view <run-id> --log
```

### Check Deployment Status
```bash
# List Vercel deployments
vercel ls

# Get deployment info
vercel inspect <deployment-url>

# View logs
vercel logs <deployment-url>
```

## Maintenance Commands

### Update Dependencies
```bash
# Update all dependencies
pnpm update

# Update specific package
pnpm update <package-name>

# Interactive updates
pnpm update -i

# Check outdated packages
pnpm outdated
```

### Clean Build Artifacts
```bash
# Clean all build artifacts
pnpm clean

# Clean and reinstall
pnpm clean:install

# Remove Docker volumes
docker volume prune
```

### Database Operations
```bash
# Initialize database
pnpm db:init

# Run migrations
pnpm db:migrate

# Reset database
pnpm db:reset

# Seed database
pnpm db:seed

# Backup database
pnpm db:backup

# Restore database
pnpm db:restore

# Check database status
pnpm db:status
```

## Useful GitHub CLI Commands

### Pull Requests
```bash
# Create PR
gh pr create --title "Title" --body "Description"

# List PRs
gh pr list

# View PR
gh pr view <number>

# Check PR status
gh pr checks <number>

# Merge PR
gh pr merge <number>
```

### Issues
```bash
# Create issue
gh issue create --title "Title" --body "Description"

# List issues
gh issue list

# View issue
gh issue view <number>
```

### Releases
```bash
# Create release
gh release create v1.0.0 --title "Release v1.0.0" --notes "Release notes"

# List releases
gh release list

# View release
gh release view v1.0.0
```

## Environment Variables Quick Reference

### Required for CI
```bash
export CI=true
export NODE_ENV=test
export REVEALUI_SKIP_SUPABASE_TYPEGEN=1
```

### Required for Staging
```bash
export NODE_ENV=staging
export POSTGRES_URL=postgresql://...
export REVEALUI_SECRET=<32-char-secret>
export SUPABASE_URL=https://...
export SUPABASE_ANON_KEY=...
export NEXT_PUBLIC_SERVER_URL=https://staging.example.com
```

### Required for Production
```bash
export NODE_ENV=production
export POSTGRES_URL=postgresql://...
export REVEALUI_SECRET=<32-char-secret>
export STRIPE_SECRET_KEY=sk_live_...
export STRIPE_WEBHOOK_SECRET=whsec_...
export SUPABASE_URL=https://...
export SUPABASE_ANON_KEY=...
export SUPABASE_SERVICE_ROLE_KEY=...
export ELECTRIC_API_KEY=...
export ELECTRIC_DATABASE_URL=postgresql://...
export NEXT_PUBLIC_SERVER_URL=https://example.com
```

## Troubleshooting

### CI Failures

#### Lint Failures
```bash
# Fix automatically
pnpm lint:fix

# Check specific files
pnpm lint apps/cms/src/file.ts
```

#### Type Errors
```bash
# Typecheck specific package
pnpm --filter @revealui/core typecheck

# Build to see full errors
pnpm --filter cms build
```

#### Test Failures
```bash
# Run tests in watch mode
pnpm --filter @revealui/core test:watch

# Run with coverage to see gaps
pnpm --filter @revealui/core test:coverage

# Debug E2E tests
pnpm --filter @revealui/test exec playwright test --debug
```

### Docker Build Failures

#### Out of Memory
```bash
# Increase Docker memory limit
# Docker Desktop → Settings → Resources → Memory

# Use lighter base image
# (Already using alpine images)
```

#### Build Context Too Large
```bash
# Check .dockerignore is present
cat .dockerignore

# Verify node_modules excluded
docker build --no-cache -f apps/cms/Dockerfile -t test . 2>&1 | grep "Sending build context"
```

#### Layer Caching Issues
```bash
# Build without cache
docker build --no-cache -f apps/cms/Dockerfile -t revealui-cms:latest .

# Prune build cache
docker builder prune
```

### Deployment Failures

#### Vercel Build Failures
```bash
# Check Vercel logs
vercel logs <deployment-url>

# Build locally to debug
pnpm --filter cms build

# Check environment variables
vercel env ls
```

#### Health Check Failures
```bash
# Check application logs
docker logs revealui-cms

# Test health endpoint locally
curl -v http://localhost:4000/api/health

# Check if port is accessible
netstat -an | grep 4000
```

## Quick Links

- **GitHub Actions**: https://github.com/owner/RevealUI/actions
- **Codecov**: https://codecov.io/gh/owner/RevealUI
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Docker Hub**: https://hub.docker.com/u/<username>

## Support

For issues or questions:
1. Check the main implementation summary: `CICD_IMPLEMENTATION_SUMMARY.md`
2. Review GitHub Actions logs
3. Check Docker container logs
4. Open an issue on GitHub
