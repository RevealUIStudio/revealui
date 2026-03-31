# RevealUI CI/CD Deployment Guide

**Last Updated**: March 2026
**Status**: Deployment Guide (Production — live at cms.revealui.com and api.revealui.com)

---

## Overview

This comprehensive guide covers deploying RevealUI to production using Vercel with NeonDB Postgres, including monitoring setup and rollback procedures. RevealUI uses its own native database adapters and Lexical rich text editor.

**What's Covered**:
- Deployment setup (Vercel + NeonDB)
- CI/CD pipeline configuration
- Production monitoring (Sentry, Vercel Analytics)
- Rollback procedures
- Troubleshooting

## Prerequisites

- NeonDB Postgres database
- Vercel account (for deployment)
- GitHub repository (for CI/CD)

---

## Required Environment Variables

**Complete Reference**: See [Environment Variables Guide](./ENVIRONMENT_VARIABLES_GUIDE.md) for comprehensive configuration with quick reference tables.

### Minimum Required (8 variables)

```env
# Core (3)
REVEALUI_SECRET=<32+ char random string>
REVEALUI_PUBLIC_SERVER_URL=https://cms.yourdomain.com
NEXT_PUBLIC_SERVER_URL=https://cms.yourdomain.com

# Database (1)
POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require

# Storage (1)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx

# Stripe (3)
STRIPE_SECRET_KEY=sk_live_xxx  # Use sk_test_xxx for development
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Optional Variables

For monitoring, Supabase client integration, and other optional features, see [Environment Variables Guide - Optional Variables](./ENVIRONMENT_VARIABLES_GUIDE.md#optional-variables).

---

## Database Setup

**Complete Guide**: See [Database Guide](./DATABASE.md) for detailed database setup with all providers (Neon, Supabase, Vercel Postgres).

### Quick Setup for Production

**1. Get Database Connection String**

For NeonDB (recommended):
- Go to [neon.tech](https://neon.tech)
- Create a new project
- Copy connection string: `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require`

**2. Initialize Database**

RevealUI automatically creates tables on first run. Or run manually:

```bash
# Initialize database tables
POSTGRES_URL="your-neondb-url" pnpm db:init

# Run migrations (if needed)
POSTGRES_URL="your-neondb-url" pnpm db:migrate
```

See [Database Guide](./DATABASE.md) for all database commands and operations.

---

## Vercel Deployment

### 1. Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Select the `apps/cms` directory as root

### 2. Configure Build Settings

**Framework Preset:** Next.js

**Build Command:**
```bash
pnpm run vercel-build
```

**Output Directory:** `.next`

**Install Command:**
```bash
pnpm install
```

### 3. Add Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add all required variables from [Environment Variables Guide](./ENVIRONMENT_VARIABLES_GUIDE.md#minimum-viable-configuration).

**Minimum required (8 variables)** - See guide for complete list and descriptions.

### 4. Deploy

Click "Deploy" - Vercel will build and deploy automatically.

---

## GitHub Actions CI/CD

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 9
          
      - uses: actions/setup-node@v4
        with:
          node-version: '24.13.0'
          cache: 'pnpm'
          
      - run: pnpm install
      
      - name: Run Tests
        run: pnpm test
        
      - name: Type Check
        run: pnpm typecheck

  deploy-preview:
    needs: test
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Vercel CLI
        run: npm install -g vercel
        
      - name: Deploy Preview
        run: vercel deploy --token=${{ secrets.VERCEL_TOKEN }}

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Vercel CLI
        run: npm install -g vercel
        
      - name: Deploy Production
        run: vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}
```

### GitHub Secrets Required

Add these secrets in GitHub → Settings → Secrets and Variables → Actions:

- `VERCEL_TOKEN` - Vercel API token
- `VERCEL_ORG_ID` - From Vercel project settings
- `VERCEL_PROJECT_ID` - From Vercel project settings

---

## Local Development

### 1. Copy Environment Template

```bash
cp .env.template .env.development.local
```

### 2. Configure Local Variables

See [Environment Variables Guide - Development Configuration](./ENVIRONMENT_VARIABLES_GUIDE.md#development-configuration) for complete local development setup.

**Quick start:** Use test/development keys for all services. Generate `REVEALUI_SECRET` with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Start Development Server

```bash
cd apps/cms
pnpm dev
```

Visit `http://localhost:4000/admin`

---

## Build Process

The CMS build uses these fallback environment variables when not set:

```bash
# In package.json vercel-build script
REVEALUI_SECRET=${REVEALUI_SECRET:-dev-secret-for-build-only}
POSTGRES_URL=${POSTGRES_URL:-postgres://build:build@localhost:5432/build}
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-sk_test_build}
```

**Important:** These fallbacks are only for build-time compilation. Production deployments MUST have real values set in Vercel environment variables.

---

## Troubleshooting

For comprehensive troubleshooting including build failures, deployment issues, and database problems, see [Troubleshooting Guide](./TROUBLESHOOTING.md).

**Common deployment issues**:
- **Build fails** - Missing environment variables, module errors → [Troubleshooting - Build & Deployment](./TROUBLESHOOTING.md#build--deployment)
- **Database errors** - Connection timeouts, missing tables → [Troubleshooting - Database Issues](./TROUBLESHOOTING.md#database-issues)
- **Vercel failures** - Deployment errors, environment config → [Troubleshooting - Vercel Deployment](./TROUBLESHOOTING.md#vercel-deployment-fails)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel Edge                           │
├─────────────────────────────────────────────────────────┤
│  apps/cms (Next.js 16)                                   │
│  ├── /admin/* - RevealUI Admin Panel                    │
│  ├── /api/* - REST API endpoints                        │
│  └── /* - Frontend pages (SSR/SSG)                      │
├─────────────────────────────────────────────────────────┤
│  @revealui/core                                           │
│  ├── Database adapters (PostgreSQL, PGlite, ElectricSQL)│
│  ├── Lexical rich text editor (vanilla)                 │
│  ├── Auth system                                         │
│  └── Plugins (form-builder, nested-docs, redirects)     │
├─────────────────────────────────────────────────────────┤
│  External Services                                       │
│  ├── NeonDB (Postgres) - Primary database               │
│  ├── Vercel Blob - Media storage                        │
│  ├── Stripe - Payments                                   │
│  └── Supabase (optional) - Additional features          │
└─────────────────────────────────────────────────────────┘
```

---

## Security Checklist

- [ ] `REVEALUI_SECRET` is 32+ characters
- [ ] `REVEALUI_SECRET` is unique per environment
- [ ] Stripe uses live keys in production
- [ ] Database connection uses SSL (`sslmode=require`)
- [ ] CORS origins properly configured
- [ ] Admin credentials not committed to repo

---

## Monitoring Setup

### Overview

RevealUI supports multiple monitoring services:
- **Error Monitoring**: Sentry (already configured)
- **Performance Monitoring**: Vercel Analytics, Speed Insights
- **Application Performance Monitoring (APM)**: Can be extended

### Error Monitoring (Sentry)

#### Current Setup

Sentry is already configured in `apps/cms/next.config.mjs`:

```javascript
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const { withSentryConfig } = await import('@sentry/nextjs')
  config = withSentryConfig(config, {
    // Sentry configuration
  })
}
```

#### Configuration

**Environment Variables:**
```bash
# Sentry DSN (required)
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Optional: Sentry organization and project for releases
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project

# Optional: Sentry auth token for releases
SENTRY_AUTH_TOKEN=your-auth-token
```

**Setup Steps:**
1. Create Sentry account at https://sentry.io
2. Create a new project (Next.js)
3. Copy DSN to `.env` file
4. Restart dev server

#### Usage

**Automatic Error Capture:**
Sentry automatically captures:
- Unhandled exceptions
- API route errors
- Next.js errors

**Manual Error Capture:**
```typescript
import * as Sentry from '@sentry/nextjs'

try {
  // Code that might fail
} catch (error) {
  Sentry.captureException(error, {
    tags: { component: 'user-service' },
    extra: { userId: '123' },
  })
}
```

**User Context:**
```typescript
Sentry.setUser({
  id: user.id,
  email: user.email,
})
```

#### Viewing Errors

1. Go to https://sentry.io
2. Navigate to your project
3. View errors in Issues tab
4. Set up alerts for critical errors

### Performance Monitoring

#### Vercel Analytics

**Current Setup:**
Vercel Analytics is configured in `apps/cms/src/instrumentation.ts`:

```typescript
if (process.env.NEXT_PUBLIC_VERCEL_ENV) {
  const { SpeedInsights } = await import('@vercel/speed-insights/next')
  // Speed Insights is automatically initialized
}
```

**Configuration:**
Automatically enabled when deployed to Vercel.

**Usage:**
- View analytics in Vercel dashboard
- Access performance metrics
- View user analytics

#### Speed Insights

**Current Setup:**
Speed Insights is configured in `apps/cms/src/app/layout.tsx`:

```typescript
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
```

**Metrics:**
- Core Web Vitals (LCP, FID, CLS)
- Real User Monitoring (RUM)
- Performance insights

### Application Performance Monitoring (APM)

#### Recommended Services

1. **Datadog APM**
   - Application performance monitoring
   - Distributed tracing
   - Custom metrics

2. **New Relic**
   - Full-stack observability
   - Application performance
   - Infrastructure monitoring

3. **Dynatrace**
   - AI-powered APM
   - Automatic discovery
   - Performance insights

#### Implementation Example (Datadog)

```typescript
// apps/cms/src/instrumentation.ts
import tracer from 'dd-trace'

export async function register() {
  if (process.env.DD_SERVICE) {
    tracer.init({
      service: 'revealui-cms',
      env: process.env.NODE_ENV,
    })
    tracer.use('http')
    tracer.use('next')
  }
}
```

**Environment Variables:**
```bash
DD_SERVICE=revealui-cms
DD_ENV=production
DD_VERSION=1.0.0
DD_API_KEY=your-api-key
DD_AGENT_HOST=datadog-agent
```

### Health Checks

#### API Health Check

Create a health check endpoint:

```typescript
// apps/cms/src/app/api/health/route.ts
import { NextResponse } from 'next/server'
import { getClient } from '@revealui/db/client'

export async function GET() {
  try {
    // Check database connection
    const db = getClient()
    await db.query.users.findFirst({ limit: 1 })

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}
```

**Usage:**
```bash
curl https://your-domain.com/api/health
```

### Alerts

#### Sentry Alerts

1. Go to Sentry project settings
2. Navigate to Alerts
3. Create alert rules:
   - Error rate threshold
   - Critical errors
   - New issues

#### Custom Alerts

Use monitoring service APIs to create custom alerts:
- High error rate
- Performance degradation
- Database connection issues
- External service failures

### Monitoring Checklist

#### Error Monitoring
- [x] Sentry configured
- [ ] Sentry DSN set in production
- [ ] Alerts configured
- [ ] Error tracking verified

#### Performance Monitoring
- [x] Vercel Analytics enabled
- [x] Speed Insights configured
- [ ] Performance baseline established
- [ ] Performance alerts configured

#### Health Checks
- [ ] Health check endpoint created
- [ ] Monitoring service configured
- [ ] Health check alerts set up

### Monitoring Best Practices

1. **Monitor Critical Paths**
   - Authentication flows
   - Payment processing
   - Database operations
   - External API calls

2. **Set Appropriate Alerts**
   - Error rate thresholds
   - Performance degradation
   - Service availability

3. **Use Structured Logging**
   - Include context
   - Use appropriate log levels
   - Don't log sensitive data

4. **Regular Reviews**
   - Review error trends
   - Analyze performance metrics
   - Adjust alert thresholds

---

## Rollback Procedures

### When to Rollback

Rollback should be considered when:
- Critical security vulnerability discovered
- System-wide outage or unavailability
- Data corruption or loss detected
- Payment processing failures
- Authentication system failures
- Performance degradation > 50%
- Error rate > 5%

### Pre-Rollback Checklist

Before initiating rollback:

- [ ] Confirm issue severity (Critical/High/Medium)
- [ ] Document the issue and impact
- [ ] Notify stakeholders
- [ ] Verify rollback target version is stable
- [ ] Ensure database backup is available
- [ ] Confirm rollback procedure with team

### Rollback Methods

#### Method 1: Vercel Dashboard (Fastest - Recommended)

**Time**: 2-5 minutes

1. **Access Vercel Dashboard**
   - Go to https://vercel.com/dashboard
   - Select your project

2. **Navigate to Deployments**
   - Click on "Deployments" tab
   - Find the last known good deployment
   - Look for deployment with:
     - ✅ Successful build
     - ✅ All tests passing
     - ✅ No critical errors

3. **Promote to Production**
   - Click the "..." menu on the deployment
   - Select "Promote to Production"
   - Confirm the promotion

4. **Verify Rollback**
   - Check health endpoint: `https://your-domain.com/api/health`
   - Verify critical user flows
   - Monitor error rates
   - Check Sentry for new errors

**Advantages**:
- Fastest method
- No code changes needed
- Preserves deployment history
- Can be done by non-technical team members

#### Method 2: Git Revert (Code-Based)

**Time**: 5-10 minutes

1. **Identify Last Good Commit**
   ```bash
   git log --oneline -20
   # Find the commit hash of last known good version
   ```

2. **Create Revert Commit**
   ```bash
   # Revert to specific commit
   git revert <commit-hash> --no-commit

   # Or revert last commit
   git revert HEAD --no-commit
   ```

3. **Review Changes**
   ```bash
   git status
   git diff
   ```

4. **Commit and Push**
   ```bash
   git commit -m "Rollback: Reverting to previous stable version"
   git push origin main
   ```

5. **Wait for Deployment**
   - Vercel will automatically deploy the revert
   - Monitor deployment status

6. **Verify Rollback**
   - Check health endpoint
   - Verify critical flows
   - Monitor for issues

#### Method 3: Database Rollback (If Needed)

**⚠️ Only if database schema changes were made**

**Time**: 15-30 minutes

1. **Stop Application**
   - Prevent new writes during rollback

2. **Restore Database Backup**
   ```bash
   # For NeonDB
   # Use NeonDB console or CLI to restore from backup

   # For Supabase
   # Use Supabase dashboard: Settings → Database → Backups
   ```

3. **Run Migration Rollback** (if applicable)
   ```bash
   # If using custom migrations
   # Run rollback migration scripts
   cd packages/db
   pnpm db:rollback
   ```

4. **Verify Database State**
   - Check critical tables
   - Verify data integrity
   - Test database queries

5. **Restart Application**
   - Deploy previous version
   - Verify application works

### Post-Rollback Actions

#### Immediate (First Hour)

- [ ] Verify system is operational
- [ ] Check all critical endpoints
- [ ] Monitor error rates
- [ ] Test payment processing
- [ ] Verify authentication
- [ ] Check database connectivity
- [ ] Monitor performance metrics

#### First 24 Hours

- [ ] Document root cause of issue
- [ ] Create incident report
- [ ] Review what went wrong
- [ ] Plan fix for rolled-back version
- [ ] Update monitoring alerts
- [ ] Communicate status to stakeholders

#### Follow-Up

- [ ] Fix the issue in development
- [ ] Add tests to prevent recurrence
- [ ] Update deployment procedures
- [ ] Review and improve rollback process
- [ ] Conduct post-mortem meeting

### Rollback Verification Checklist

After rollback, verify:

#### System Health
- [ ] Health endpoint returns 200: `/api/health`
- [ ] Database connectivity working
- [ ] External services (Stripe, Blob) accessible
- [ ] No critical errors in logs

#### Critical User Flows
- [ ] User registration works
- [ ] User login works
- [ ] Admin panel accessible
- [ ] Payment processing works
- [ ] Form submissions work
- [ ] Multi-tenant isolation working

#### Performance
- [ ] Response times normal (< 2s p95)
- [ ] Error rate < 0.1%
- [ ] No memory leaks
- [ ] Database queries performant

#### Security
- [ ] Authentication working
- [ ] Authorization checks working
- [ ] Rate limiting active
- [ ] Security headers present
- [ ] No security vulnerabilities introduced

### Communication Template

**Subject**: Production Rollback - [Issue Description]

**Body**:
```
We have initiated a rollback of the production deployment due to [issue description].

**Issue**: [Brief description]
**Impact**: [Who/what is affected]
**Action Taken**: Rolled back to version [version/commit]
**Status**: System is now stable
**Next Steps**: [What will happen next]

We will provide updates as we investigate and fix the issue.

Timeline:
- Rollback initiated: [time]
- System stable: [time]
- Fix expected: [time]
```

### Prevention Measures

To reduce need for rollbacks:

1. **Staging Validation**
   - Always test in staging first
   - Run full test suite
   - Load test before production

2. **Gradual Rollouts**
   - Use feature flags
   - Deploy to small percentage first
   - Monitor before full rollout

3. **Monitoring**
   - Set up alerts for critical metrics
   - Monitor error rates
   - Watch performance metrics

4. **Testing**
   - Comprehensive test coverage
   - E2E tests for critical flows
   - Load testing before launch

### Emergency Contacts

- **Primary On-Call**: [Name] - [Phone/Email]
- **Secondary On-Call**: [Name] - [Phone/Email]
- **Technical Lead**: [Name] - [Phone/Email]
- **DevOps**: [Name] - [Phone/Email]

---

## Deployment Runbook

**Last Updated**: March 2026
**Status**: Deployment Guide (Production)

### Pre-Deployment Checklist

#### 1. Code Quality
- [ ] All tests passing (`pnpm test`)
- [ ] No linter errors (`pnpm lint`)
- [ ] No TypeScript errors (`pnpm typecheck:all`)
- [ ] Security audit clean (`pnpm audit --audit-level=high`)
- [ ] Code review completed and approved

#### 2. Environment Configuration
- [ ] All environment variables configured in Vercel
- [ ] `REVEALUI_SECRET` is cryptographically strong (32+ chars)
- [ ] Database connection string verified
- [ ] Stripe webhook secret configured
- [ ] Vercel Blob storage token configured

#### 3. Security Verification
- [ ] Security headers configured
- [ ] CORS origins properly set
- [ ] Rate limiting enabled on auth endpoints
- [ ] No test/debug endpoints exposed
- [ ] Environment variables not hardcoded

#### 4. Database
- [ ] Database tables created (see CI_CD_GUIDE.md)
- [ ] Database backup created
- [ ] Rollback procedure tested
- [ ] Connection pooling configured

### Deployment Steps

#### Staging Deployment

1. **Prepare Staging Environment**
   ```bash
   # Ensure on correct branch
   git checkout cursor
   git pull origin cursor
   ```

2. **Run Pre-Deployment Tests**
   ```bash
   pnpm install
   pnpm lint
   pnpm typecheck:all
   pnpm test
   pnpm build
   ```

3. **Deploy to Vercel Staging**
   ```bash
   # Vercel automatically deploys on push to cursor branch
   git push origin cursor
   ```

4. **Verify Staging Deployment**
   - [ ] Health check endpoint responds: `https://staging.your-domain.com/api/health`
   - [ ] Admin login works
   - [ ] Authentication flow complete
   - [ ] Payment processing works

#### Production Deployment

1. **Final Pre-Production Checks**
   ```bash
   # Run security audit one final time
   pnpm audit --audit-level=high

   # Verify no console.log statements in production code
   grep -r "console.log" apps/cms/src/lib apps/mainframe/src --exclude="*.test.ts"
   ```

2. **Create Production Release**
   ```bash
   # Merge cursor into main
   git checkout main
   git merge cursor --no-ff
   git tag -a v1.0.0 -m "Production release v1.0.0"
   ```

3. **Deploy to Production**
   ```bash
   # Push to main (triggers production deployment)
   git push origin main
   git push origin v1.0.0
   ```

4. **Post-Deployment Verification**
   - [ ] Health check: `https://your-domain.com/api/health`
   - [ ] Sentry receiving events
   - [ ] No error spikes in logs
   - [ ] Authentication working
   - [ ] Payment processing working
   - [ ] Performance metrics acceptable

### Environment Variables

**Complete Configuration**: See [Environment Variables Guide](./ENVIRONMENT_VARIABLES_GUIDE.md) for all variables with detailed descriptions.

**Quick Reference**:
- Required (8 variables): Core, Database, Storage, Stripe
- Optional: Supabase, Sentry, ElectricSQL

**Production Checklist**:
- Use production URLs (HTTPS)
- Use live Stripe keys (not test keys)
- Set strong REVEALUI_SECRET (32+ chars)
- Enable SSL for database (`?sslmode=require`)

### Rollback Procedure

#### If Critical Issues Detected

1. **Immediate Rollback via Vercel**
   - Go to Vercel Dashboard
   - Select deployment to roll back to
   - Click "Promote to Production"

2. **Or via Git**
   ```bash
   # Revert to previous release
   git revert HEAD --no-commit
   git commit -m "Rollback: Reverting to previous version"
   git push origin main
   ```

3. **Verify Rollback**
   - [ ] Health check responds
   - [ ] Critical flows working
   - [ ] No error spikes
   - [ ] Communicate status to team

### Monitoring & Alerts

#### Health Checks

- **Endpoint**: `/api/health`
- **Expected Response**:
  ```json
  {
    "status": "healthy",
    "checks": {
      "database": "connected"
    }
  }
  ```

#### Metrics to Monitor

1. **Performance**
   - Response times (p50, p95, p99)
   - Database query performance
   - API endpoint latency

2. **Errors**
   - 5xx error rate (should be < 0.1%)
   - 4xx error rate (monitor for unusual spikes)
   - Unhandled exceptions

3. **Security**
   - Failed login attempts
   - Rate limit violations
   - Invalid JWT tokens

4. **Business Metrics**
   - Successful payments
   - Webhook delivery success rate
   - User registrations

#### Alert Thresholds

- **Critical**: 5xx error rate > 1%
- **High**: Response time p95 > 2000ms
- **Medium**: 4xx error rate spike > 50% increase
- **Low**: Webhook failures > 5% of total

### Database Maintenance

#### Backup Strategy (NeonDB)

- **Frequency**: Point-in-time recovery available
- **Retention**: 7 days (free tier) / 30 days (Pro)
- **Test Restore**: Monthly verification

#### Migration Process

1. **Before deployment**:
   - Review SQL changes
   - Test migrations in staging
   - Create manual backup

2. **During deployment**:
   - Run SQL migrations manually or via CI
   - Monitor for errors

3. **After deployment**:
   - Verify schema changes applied
   - Check data integrity

### Troubleshooting Common Issues

#### Build Failures

**Issue**: Dependency conflicts
- **Solution**: Run `pnpm install --frozen-lockfile`

**Issue**: Type errors
- **Solution**: Run `pnpm typecheck:all` and fix errors

#### Runtime Errors

**Issue**: Database connection fails
- **Solution**: Verify `POSTGRES_URL` is correct
- **Check**: Connection string format, SSL mode, credentials

**Issue**: JWT verification fails
- **Solution**: Ensure `REVEALUI_SECRET` matches across all instances

**Issue**: Media upload fails
- **Solution**: Verify `BLOB_READ_WRITE_TOKEN` is correct and has Read/Write permissions

#### Performance Issues

**Issue**: Slow API responses
- **Solution**: Check database query performance
- **Enable**: Query logging and analyze slow queries

**Issue**: High memory usage
- **Solution**: Check for memory leaks
- **Monitor**: Node.js heap usage

### Post-Deployment Tasks

#### Immediate (First Hour)
- [ ] Monitor error logs
- [ ] Check health endpoint
- [ ] Verify critical user flows
- [ ] Monitor Sentry for errors

#### First Day
- [ ] Review performance metrics
- [ ] Check all integrations (Stripe)
- [ ] Verify webhooks processing
- [ ] Monitor user feedback

#### First Week
- [ ] Review security logs
- [ ] Analyze performance trends
- [ ] Check for any regression issues
- [ ] Gather user feedback

### Useful Commands

```bash
# Check deployment status
vercel ls

# View production logs
vercel logs <deployment-url>

# Inspect specific deployment
vercel inspect <deployment-url>

# Promote specific deployment to production
vercel promote <deployment-url>

# Set environment variable
vercel env add <KEY> production

# Trigger redeploy
vercel deploy --prod
```

---

---

## Quick Reference Commands

### Docker Commands

#### Build Individual Apps
```bash
# CMS (Next.js)
docker build -f apps/cms/Dockerfile -t revealui-cms:latest .

# Mainframe (Hono SSR + React)
docker build -f apps/mainframe/Dockerfile -t revealui-mainframe:latest .

# Docs (Vite + nginx)
docker build -f apps/docs/Dockerfile -t revealui-docs:latest .

# Marketing (Next.js)
docker build -f apps/marketing/Dockerfile -t revealui-marketing:latest .
```

#### Production Stack
```bash
# Start all services
docker-compose -f infrastructure/docker-compose/production.yml up -d

# View logs
docker-compose -f infrastructure/docker-compose/production.yml logs -f

# Check status
docker-compose -f infrastructure/docker-compose/production.yml ps

# Stop services
docker-compose -f infrastructure/docker-compose/production.yml down

# Stop and remove volumes
docker-compose -f infrastructure/docker-compose/production.yml down -v
```

#### Health Checks
```bash
# CMS health check
curl http://localhost:4000/api/health

# Mainframe health check
curl http://localhost:3001/health

# Postgres health check
docker exec revealui-postgres pg_isready -U revealui
```

#### Troubleshooting
```bash
# View container logs
docker logs revealui-cms
docker logs revealui-mainframe
docker logs revealui-postgres

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

### Testing Commands

#### Unit Tests
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

#### Integration Tests
```bash
# Run all integration tests
pnpm test:integration

# Run integration tests directly
tsx scripts/dev-tools/run-integration-tests.ts
```

#### E2E Tests
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

### CI/CD Commands

#### Local CI Validation
```bash
# Lint
pnpm lint

# Typecheck
pnpm typecheck:all

# Build all apps
pnpm build

# Build specific app
pnpm --filter cms build
pnpm --filter web build
```

#### Environment Validation
```bash
# Validate CI environment
tsx scripts/ci/validate-env.ts ci

# Validate staging environment
tsx scripts/ci/validate-env.ts staging

# Validate production environment
tsx scripts/ci/validate-env.ts production
```

#### Security Scanning
```bash
# Run dependency audit
pnpm audit --audit-level=moderate

# Fix vulnerabilities
pnpm audit --fix
```

### Deployment Commands

#### Manual Deployment
```bash
# Deploy to staging (requires Vercel CLI)
vercel --scope=<org-id>

# Deploy to production
vercel --prod --scope=<org-id>
```

#### GitHub Actions
```bash
# Trigger staging deployment
# (Automatic on push to main)

# Trigger production deployment
# Go to: Actions → Deploy to Production → Run workflow
# Enter version (e.g., v1.0.0)

# Trigger PR preview
# (Automatic on PR open/sync)
```

### Monitoring Commands

#### Check CI Status
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

#### Check Deployment Status
```bash
# List Vercel deployments
vercel ls

# Get deployment info
vercel inspect <deployment-url>

# View logs
vercel logs <deployment-url>
```

### Maintenance Commands

#### Update Dependencies
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

#### Clean Build Artifacts
```bash
# Clean all build artifacts
pnpm clean

# Clean and reinstall
pnpm clean:install

# Remove Docker volumes
docker volume prune
```

#### Database Operations
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

### Useful GitHub CLI Commands

#### Pull Requests
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

#### Issues
```bash
# Create issue
gh issue create --title "Title" --body "Description"

# List issues
gh issue list

# View issue
gh issue view <number>
```

#### Releases
```bash
# Create release
gh release create v1.0.0 --title "Release v1.0.0" --notes "Release notes"

# List releases
gh release list

# View release
gh release view v1.0.0
```

### CI Troubleshooting

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

#### Docker Build Failures
```bash
# Out of Memory
# Increase Docker memory limit
# Docker Desktop → Settings → Resources → Memory

# Build Context Too Large
# Check .dockerignore is present
cat .dockerignore

# Verify node_modules excluded
docker build --no-cache -f apps/cms/Dockerfile -t test . 2>&1 | grep "Sending build context"

# Layer Caching Issues
# Build without cache
docker build --no-cache -f apps/cms/Dockerfile -t revealui-cms:latest .

# Prune build cache
docker builder prune
```

#### Deployment Failures
```bash
# Vercel Build Failures
# Check Vercel logs
vercel logs <deployment-url>

# Build locally to debug
pnpm --filter cms build

# Check environment variables
vercel env ls

# Health Check Failures
# Check application logs
docker logs revealui-cms

# Test health endpoint locally
curl -v http://localhost:4000/api/health

# Check if port is accessible
netstat -an | grep 4000
```

---

## Docker Infrastructure Setup

### Important: Next.js Standalone Output

The Dockerfiles for CMS, Dashboard, and Landing apps assume Next.js standalone output mode. This needs to be configured in each app's `next.config.js` or `next.config.mjs`.

#### Required Configuration

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

#### Files to Update

1. `apps/cms/next.config.js` or `apps/cms/next.config.mjs`
2. `apps/marketing/next.config.js` or `apps/marketing/next.config.mjs`

#### What This Does

The `output: 'standalone'` setting tells Next.js to:
- Create a minimal standalone deployment in `.next/standalone/`
- Include only necessary production dependencies
- Generate a `server.js` file for running the app
- Optimize the output for Docker deployment

#### Dockerfile Expectations

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

#### Testing Locally

After adding `output: 'standalone'`, test the build:

```bash
# Build the app
pnpm --filter cms build

# Check that standalone output exists
ls -la apps/cms/.next/standalone/

# Should see server.js
ls -la apps/cms/.next/standalone/apps/cms/
```

#### Alternative: Modify Dockerfiles

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

### Health Check Endpoints

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

### Docker Build Troubleshooting

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

### Build Order Recommendations

When building multiple apps, build in this order for optimal cache usage:

1. **mainframe** (smallest, static only)
2. **docs** (similar to mainframe)
3. **marketing** (Next.js, fewer dependencies)
4. **cms** (largest, most dependencies)

Example:
```bash
docker build -f apps/mainframe/Dockerfile -t revealui-mainframe:latest .
docker build -f apps/docs/Dockerfile -t revealui-docs:latest .
docker build -f apps/marketing/Dockerfile -t revealui-marketing:latest .
docker build -f apps/cms/Dockerfile -t revealui-cms:latest .
```

### Docker Production Deployment Checklist

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

### Docker Security Checklist

- [ ] No secrets in images (verify with `docker history`)
- [ ] Non-root user configured
- [ ] Resource limits set
- [ ] Health checks configured
- [ ] Only required files copied (via .dockerignore)
- [ ] Latest base images used
- [ ] Vulnerability scanning enabled (Trivy in CI)

### Performance Optimization

#### Build Performance
- Use BuildKit for better caching
- Leverage layer caching with `--cache-from`
- Use pnpm store cache mount
- Order Dockerfile commands from least to most frequently changing

#### Runtime Performance
- Use alpine base images (already done)
- Minimize layer count in final image
- Use multi-stage builds (already done)
- Set appropriate resource limits

#### Network Performance
- Use CDN for static assets
- Enable gzip compression (nginx)
- Optimize image formats
- Minimize bundle sizes

### Docker Monitoring

#### Docker Health Checks
```bash
# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# View health check logs
docker inspect revealui-cms | jq '.[0].State.Health'
```

#### Resource Usage
```bash
# Monitor resource usage
docker stats

# Specific container
docker stats revealui-cms
```

#### Logs
```bash
# View logs
docker logs revealui-cms

# Follow logs
docker logs -f revealui-cms

# Last 100 lines
docker logs --tail 100 revealui-cms
```

---

## Docker Security

### Overview

The `infrastructure/docker-compose/services/electric.yml` and `infrastructure/docker-compose/services/test.yml` files are configured for development by default. For production deployments, additional security measures must be implemented.

### Docker Hardened Images (DHI) - Secure by Default

#### What are Docker Hardened Images?

As of **December 17, 2025**, Docker made its catalog of **1,000+ Docker Hardened Images (DHI)** free and open source under the Apache 2.0 license. These images provide:

- **Minimal attack surface**: Up to 95% smaller than typical community images
- **Non-root execution** by default
- **Continuous vulnerability scanning** with public CVE reporting
- **Full SBOM** (Software Bill of Materials)
- **SLSA Build Level 3 provenance** and signed attestations
- **Transparent security**: All CVEs are publicly reported

#### Why Use DHI?

**Benefits**:
- **Free and open source** - No cost for core hardened images
- **Production-ready** - Minimal, secure images optimized for containers
- **Transparent** - Full visibility into security posture and vulnerabilities
- **Compliance-ready** - Includes SBOM, provenance, and attestations

**Resources**:
- Official website: https://dhi.io
- Documentation: https://docs.docker.com/dhi/
- GitHub: https://github.com/docker-hardened-images

#### Current DHI Availability for RevealUI

| Service | DHI Available? | Current Image | DHI Alternative | Notes |
|---------|---------------|---------------|-----------------|-------|
| **PostgreSQL** | ✅ Yes | `pgvector/pgvector:pg16` | `dhi.io/postgres:17-debian13` | DHI postgres available, but pgvector not yet included |
| **PostgreSQL + pgvector** | ❌ Not yet | `pgvector/pgvector:pg16` | N/A | Monitor DHI catalog for future support |
| **ElectricSQL** | ❌ Not yet | `electricsql/electric:latest` | N/A | Consider custom DHI-based build |

#### Using DHI Images

**Option 1: Use DHI PostgreSQL (when pgvector not required)**

```yaml
services:
  postgres:
    image: dhi.io/postgres:17-debian13  # Debian-based, hardened
    # Or use Alpine for smaller size:
    # image: dhi.io/postgres:17-alpine3.22
```

**Option 2: Build Custom DHI-Based Image with pgvector**

Since DHI doesn't yet support PostgreSQL + pgvector, you can build a custom hardened image:

```dockerfile
# Dockerfile.example-hardened-pgvector
FROM dhi.io/postgres:17-debian13

# Install pgvector extension
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    postgresql-17-pgvector && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Ensure non-root execution (DHI already does this)
USER postgres
```

**Option 3: Monitor for Official DHI Support**

- Watch Docker DHI announcements for PostgreSQL + pgvector support
- Monitor ElectricSQL releases for DHI compatibility
- Consider contributing to DHI community requests for these images

#### DHI Free vs Enterprise

**Free Tier (Available Now)**:
- ✅ All hardened images (1,000+ images)
- ✅ Continuous vulnerability scanning
- ✅ SBOM and provenance
- ✅ Public CVE reporting
- ✅ Non-root execution

**Enterprise Tier (Paid)**:
- ⚡ SLA-backed security updates (critical CVEs in ≤7 days)
- 🔒 Compliance variants (FIPS, STIG, FedRAMP)
- 🛠️ Custom image builds and customization
- 📅 Extended Lifecycle Support (post-EOL maintenance)

#### Migration Recommendations

1. **Immediate**: Review DHI catalog for available alternatives to current images
2. **Short-term**: Use DHI base images where available (e.g., for services not requiring pgvector)
3. **Long-term**: Build custom DHI-based images for services requiring extensions (pgvector)
4. **Monitoring**: Watch for official DHI support for PostgreSQL + pgvector and ElectricSQL

#### Docker Scout Integration

Docker Scout provides vulnerability scanning for images. In the **free tier**:
- **1 Scout-enabled repository** (private or public)
- Unlimited public repositories
- Continuous vulnerability analysis
- CVE visibility and reporting

**Enable Scout**:
```bash
# Enable Scout for a repository
docker scout repo enable <repo-name>

# View vulnerabilities
docker scout cves <image-name>
```

### ElectricSQL Production Security

#### Critical Security Requirements

**1. Disable Insecure Mode**

**Development (Current)**:
```yaml
environment:
  - ELECTRIC_INSECURE=true  # ⚠️ NEVER use in production
```

**Production**:
```yaml
environment:
  - ELECTRIC_INSECURE=false  # Or omit entirely
  - ELECTRIC_SECRET=${ELECTRIC_SECRET}  # Required for production
```

**2. Set Strong ELECTRIC_SECRET**

Generate a secure secret:

```bash
# Generate a strong random secret (32+ characters)
openssl rand -hex 32

# Or use the project's secret generator
pnpm generate:secret
```

Set in your production environment:

```bash
export ELECTRIC_SECRET="your-generated-secret-here-minimum-32-characters"
```

**⚠️ Never commit secrets to git or expose them in logs**

**3. JWT Authentication (Recommended)**

For production, configure JWT authentication:

```yaml
environment:
  - AUTH_MODE=jwt  # Use JWT instead of insecure
  - AUTH_JWT_ALG=HS256  # Algorithm (HS256, RS256, etc.)
  - AUTH_JWT_KEY=${AUTH_JWT_KEY}  # JWT secret key
  - AUTH_JWT_NAMESPACE=${AUTH_JWT_NAMESPACE:-}  # Optional namespace
```

**JWT Configuration**:
- Generate JWT key: `openssl rand -hex 32`
- Use HS256 for symmetric keys (simpler)
- Use RS256 for asymmetric keys (more secure, requires public/private key pair)
- Set `AUTH_JWT_NAMESPACE` if using namespaced JWT claims

**4. Database Connection Security**

**Secure Database URL**:
- Use SSL-enabled database connections in production
- Never expose database credentials in compose files
- Use environment variables or secrets management:

```yaml
environment:
  - DATABASE_URL=${POSTGRES_URL}  # Load from secure secrets manager
```

**Recommended Format**:
```
postgresql://user:password@host:port/database?sslmode=require
```

**5. Network Security**

**Production Network Configuration**:

```yaml
networks:
  revealui-network:
    driver: bridge
    # Consider using overlay network for multi-host deployments
    # driver: overlay
    # attachable: true
```

**Firewall Rules**:
- Only expose necessary ports (5133 for service, 65432 for proxy)
- Use reverse proxy (nginx, Traefik) instead of direct port exposure
- Implement rate limiting and DDoS protection

**6. Resource Limits**

The compose file includes resource limits. Adjust for your production needs:

```yaml
deploy:
  resources:
    limits:
      cpus: '2'      # Adjust based on load
      memory: 2G     # Adjust based on data volume
    reservations:
      cpus: '0.5'
      memory: 512M
```

**7. Logging and Monitoring**

**Production Logging**:
- Logs are configured with rotation (10MB max, 3 files)
- Forward logs to centralized logging system (e.g., ELK, Datadog)
- Never log sensitive information (secrets, passwords, tokens)

**Monitor**:
- Service health via `/health` endpoint
- Resource usage (CPU, memory, disk)
- Connection pool status
- Replication lag

### Test Database Security (infrastructure/docker-compose/services/test.yml)

#### Security Considerations

**1. Never Use in Production**

**⚠️ CRITICAL**: The test database configuration uses insecure credentials:

```yaml
environment:
  POSTGRES_USER: test
  POSTGRES_PASSWORD: test  # ⚠️ Insecure - OK for testing only
```

**This configuration is ONLY for local development and CI/CD testing.**

**2. Test Environment Isolation**

- Test database runs on port `5433` to avoid conflicts
- Uses isolated network (`test-network`)
- Data is ephemeral (consider using volumes in CI/CD)

**3. CI/CD Usage**

For CI/CD environments:

```yaml
# Override with secure credentials if needed
environment:
  POSTGRES_USER: ${CI_POSTGRES_USER:-test}
  POSTGRES_PASSWORD: ${CI_POSTGRES_PASSWORD:-test}
  POSTGRES_DB: ${CI_POSTGRES_DB:-test_revealui}
```

**Best Practice**: Use randomly generated credentials in CI/CD:

```bash
export TEST_POSTGRES_USER=$(openssl rand -hex 8)
export TEST_POSTGRES_PASSWORD=$(openssl rand -hex 16)
export TEST_POSTGRES_DB="test_$(openssl rand -hex 4)"
```

### Production Deployment Checklist

#### Pre-Deployment

- [ ] `ELECTRIC_INSECURE` is set to `false` or omitted
- [ ] `ELECTRIC_SECRET` is set with strong random value (32+ characters)
- [ ] JWT authentication is configured (if using)
- [ ] Database URL uses SSL (`sslmode=require`)
- [ ] All secrets are stored in secure secrets manager (not in files)
- [ ] Resource limits are appropriate for expected load
- [ ] Network firewall rules are configured
- [ ] Health checks are working
- [ ] Logging is configured and monitored
- [ ] Backup strategy is in place

#### Deployment

- [ ] Use secrets management (Docker secrets, Kubernetes secrets, AWS Secrets Manager, etc.)
- [ ] Deploy behind reverse proxy with TLS termination
- [ ] Enable rate limiting
- [ ] Configure monitoring and alerting
- [ ] Test health checks and failover scenarios

#### Post-Deployment

- [ ] Verify service is accessible via health endpoint
- [ ] Monitor logs for errors or warnings
- [ ] Verify resource usage is within limits
- [ ] Test authentication/authorization
- [ ] Verify database connection and replication
- [ ] Test failover and recovery procedures

### Docker Environment Variables Reference

See [Environment Variables Guide - ElectricSQL Section](./ENVIRONMENT_VARIABLES_GUIDE.md#electricsql-optional) for complete ElectricSQL configuration.

**Key Production Requirements**:
- Set `ELECTRIC_SECRET` (32+ chars)
- Disable `ELECTRIC_INSECURE` (set to `false` or omit)
- Use `AUTH_MODE=jwt` for production
- Configure SSL for `DATABASE_URL`

### Secrets Management

#### Docker Secrets (Docker Swarm)

```yaml
services:
  electric-sql:
    secrets:
      - electric_secret
      - database_url
    environment:
      - ELECTRIC_SECRET_FILE=/run/secrets/electric_secret
      - DATABASE_URL_FILE=/run/secrets/database_url

secrets:
  electric_secret:
    external: true
  database_url:
    external: true
```

#### Environment Files (Not Recommended for Production)

For local development only:

```bash
# .env.electric (DO NOT COMMIT)
ELECTRIC_SECRET=your-secret-here
DATABASE_URL=postgresql://...
```

**⚠️ Never commit `.env` files with production secrets to git**

#### Recommended: External Secrets Manager

- **AWS**: AWS Secrets Manager, AWS Parameter Store
- **Azure**: Azure Key Vault
- **GCP**: Google Secret Manager
- **HashiCorp**: Vault
- **Kubernetes**: Kubernetes Secrets (encrypted at rest)

### Reverse Proxy Configuration

#### Example: Nginx

```nginx
upstream electric_sql {
    server localhost:5133;
}

server {
    listen 443 ssl http2;
    server_name electric.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://electric_sql;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Rate limiting
        limit_req zone=api burst=20 nodelay;
    }

    # Health check endpoint (internal only)
    location /health {
        allow 127.0.0.1;
        deny all;
        proxy_pass http://electric_sql/health;
    }
}
```

### Docker Monitoring and Alerting

#### Health Check

```bash
# Check service health
curl -f http://localhost:5133/health

# Or use Docker health check
docker compose -f infrastructure/docker-compose/services/electric.yml ps
```

#### Metrics to Monitor

- **Service Uptime**: Container restart count
- **Resource Usage**: CPU, memory, disk I/O
- **Connection Pool**: Active connections, pool size
- **Replication Lag**: Sync delays
- **Error Rate**: Failed requests, connection errors
- **Response Time**: API latency

#### Alerting Rules

- Container restarts > 3 in 5 minutes
- CPU usage > 80% for 5 minutes
- Memory usage > 90%
- Health check failures > 3 consecutive
- Error rate > 5% for 5 minutes

### Docker Troubleshooting

#### Service Won't Start

1. Check logs: `docker compose -f infrastructure/docker-compose/services/electric.yml logs -f`
2. Verify `DATABASE_URL` is correct and accessible
3. Verify `ELECTRIC_SECRET` is set (if `ELECTRIC_INSECURE=false`)
4. Check resource limits aren't too restrictive
5. Verify ports aren't already in use

#### Authentication Failures

1. Verify `ELECTRIC_SECRET` matches between client and server
2. Check JWT configuration if using JWT auth
3. Verify `ELECTRIC_INSECURE` is not `true` in production
4. Check logs for authentication errors

#### Connection Issues

1. Verify database is accessible from container
2. Check network configuration
3. Verify SSL certificates if using SSL
4. Check firewall rules

### Docker Security Best Practices Summary

1. ✅ **Use Docker Hardened Images (DHI)** where available - secure by default, free, and production-ready
2. ✅ **Always disable `ELECTRIC_INSECURE` in production**
3. ✅ **Use strong, randomly generated secrets** (32+ characters)
4. ✅ **Store secrets in secure secrets manager**, never in files
5. ✅ **Use SSL/TLS for all database connections**
6. ✅ **Deploy behind reverse proxy with TLS termination**
7. ✅ **Enable resource limits** to prevent resource exhaustion
8. ✅ **Monitor and log** all service activity
9. ✅ **Enable Docker Scout** for vulnerability scanning (1 repo free)
10. ✅ **Regular security audits** and updates
11. ✅ **Use JWT authentication** for production deployments
12. ✅ **Never commit secrets** to version control
13. ✅ **Review SBOM and provenance** from DHI images for compliance

---

## Implementation History

This guide consolidates information from multiple CI/CD implementation documents. For historical context, see:

- [Implementation Summary (Jan 2026)](../archive/cicd/implementation-summary-2026-01.md) - Complete implementation summary with verification steps
- [Critical Fixes Applied (Jan 2026)](../archive/cicd/critical-fixes-2026-01.md) - All critical issues resolved before production
- [Quick Reference (Jan 2026)](../archive/cicd/cicd-quick-reference-2026-01.md) - Original quick reference (now integrated above)
- [Docker Setup Notes (Jan 2026)](../archive/cicd/docker-setup-notes-2026-01.md) - Original Docker notes (now integrated above)

These archives are preserved for historical reference and troubleshooting.

---

## Related Documentation

### Essential Guides
- **[Environment Variables Guide](./ENVIRONMENT_VARIABLES_GUIDE.md)** - ⭐ Complete configuration guide with quick reference tables
- [Database Guide](./DATABASE.md) - Complete database setup and management
- [Quick Start Guide](./QUICK_START.md) - 5-minute setup guide

### Reference
- [Testing Guide](./TESTING.md) - Comprehensive testing guide
- [Standards](./STANDARDS.md) - Code standards and conventions

### Docker
- [Docker Hardened Images](https://docs.docker.com/dhi/) - Official DHI documentation
- [DHI Catalog](https://dhi.io) - Browse available hardened images

---

**Status:** Deployment Guide (Production)
**Last Verified:** March 2026
**Consolidated:** January 31, 2026 (5 files → 1 file)

---

# RevealUI Deployment Guide

Comprehensive guide for deploying RevealUI to production and staging environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring](#monitoring)
- [Disaster Recovery](#disaster-recovery)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **Docker** (v24+): Container runtime
- **kubectl** (v1.28+): Kubernetes CLI
- **Node.js** (v20+): For local development
- **pnpm** (v8+): Package manager
- **helm** (v3+): Kubernetes package manager (optional)

### Required Access

- Kubernetes cluster (GKE, EKS, AKS, or self-hosted)
- Container registry (Docker Hub, GCR, ECR, or ACR)
- GitHub repository access (for CI/CD)
- Domain name with DNS control

### Infrastructure Requirements

**Minimum Resources:**
- 4 CPU cores
- 8GB RAM
- 100GB storage

**Production Resources:**
- 16+ CPU cores
- 32GB+ RAM
- 500GB+ storage
- Load balancer
- SSL certificates

## Local Development

### Using Docker Compose

The easiest way to run RevealUI locally is with Docker Compose:

```bash
# Clone repository
git clone https://github.com/your-org/revealui.git
cd revealui

# Copy environment file
cp .env.template .env

# Edit .env with your configuration
nano .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

**Services Available:**
- **CMS**: http://localhost:3000
- **Dashboard**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **MinIO**: http://localhost:9000
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3003

### Using pnpm (Native)

For faster development iteration:

```bash
# Install dependencies
pnpm install

# Set up database
pnpm db:push
pnpm db:seed

# Start development servers
pnpm dev

# CMS: http://localhost:3000
# Dashboard: http://localhost:3001
```

## Docker Deployment

### Building Images

Build production Docker images:

```bash
# Build base image
docker build -f docker/Dockerfile.base -t revealui/base:latest .

# Build CMS
docker build -f docker/Dockerfile.cms -t revealui/cms:v1.0.0 .

# Build Dashboard
docker build -f docker/Dockerfile.dashboard -t revealui/dashboard:v1.0.0 .
```

### Multi-Architecture Builds

Build for multiple platforms:

```bash
# Set up buildx
docker buildx create --use

# Build and push multi-arch images
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f docker/Dockerfile.cms \
  -t revealui/cms:v1.0.0 \
  --push .
```

### Pushing to Registry

```bash
# Login to registry
docker login

# Tag images
docker tag revealui/cms:v1.0.0 registry.example.com/revealui/cms:v1.0.0

# Push images
docker push registry.example.com/revealui/cms:v1.0.0
docker push registry.example.com/revealui/dashboard:v1.0.0
```

## Kubernetes Deployment

### Cluster Setup

#### Google Kubernetes Engine (GKE)

```bash
# Create cluster
gcloud container clusters create revealui \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n1-standard-4 \
  --enable-autoscaling \
  --min-nodes 3 \
  --max-nodes 10

# Get credentials
gcloud container clusters get-credentials revealui --zone us-central1-a
```

#### Amazon EKS

```bash
# Create cluster
eksctl create cluster \
  --name revealui \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.xlarge \
  --nodes 3 \
  --nodes-min 3 \
  --nodes-max 10

# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name revealui
```

#### Azure AKS

```bash
# Create cluster
az aks create \
  --resource-group revealui-rg \
  --name revealui \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3 \
  --enable-cluster-autoscaler \
  --min-count 3 \
  --max-count 10

# Get credentials
az aks get-credentials --resource-group revealui-rg --name revealui
```

### Installing cert-manager

For automatic SSL certificate management:

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Verify installation
kubectl get pods -n cert-manager
```

### Installing NGINX Ingress Controller

```bash
# Install NGINX Ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.0/deploy/static/provider/cloud/deploy.yaml

# Get external IP
kubectl get service ingress-nginx-controller -n ingress-nginx
```

### Deploying RevealUI

#### 1. Create Namespace

```bash
kubectl apply -f k8s/namespace.yaml
```

#### 2. Configure Secrets

Copy `k8s/secrets.yaml.example` to `k8s/secrets.yaml`, fill in your actual secrets (or use a secrets manager):

```bash
# Generate base64 encoded secrets
echo -n "your-database-password" | base64
echo -n "your-jwt-secret" | base64

# Apply secrets
kubectl apply -f k8s/secrets.yaml  # your local copy, not the .example
```

**Production Best Practice:** Use external secrets management:

```bash
# Using Google Secret Manager
kubectl create secret generic revealui-secrets \
  --from-literal=DATABASE_URL="$(gcloud secrets versions access latest --secret=database-url)" \
  --namespace=revealui

# Using AWS Secrets Manager
kubectl create secret generic revealui-secrets \
  --from-literal=DATABASE_URL="$(aws secretsmanager get-secret-value --secret-id database-url --query SecretString --output text)" \
  --namespace=revealui
```

#### 3. Deploy StatefulSets (Databases)

```bash
# Deploy PostgreSQL
kubectl apply -f k8s/statefulsets/postgres.yaml

# Wait for database to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n revealui --timeout=300s
```

#### 4. Deploy Applications

```bash
# Deploy CMS
kubectl apply -f k8s/deployments/cms.yaml

# Deploy Dashboard
kubectl apply -f k8s/deployments/dashboard.yaml

# Wait for deployments
kubectl rollout status deployment/revealui-cms -n revealui
kubectl rollout status deployment/revealui-dashboard -n revealui
```

#### 5. Configure Ingress

Update `k8s/ingress.yaml` with your domain:

```yaml
spec:
  rules:
    - host: revealui.example.com  # Your domain
    - host: api.revealui.example.com
    - host: dashboard.revealui.example.com
```

Apply ingress:

```bash
kubectl apply -f k8s/ingress.yaml
```

#### 6. Configure DNS

Point your domains to the ingress controller's external IP:

```bash
# Get external IP
kubectl get ingress revealui-ingress -n revealui

# Add DNS A records:
# revealui.example.com        -> EXTERNAL_IP
# api.revealui.example.com    -> EXTERNAL_IP
# dashboard.revealui.example.com -> EXTERNAL_IP
```

### Using Deployment Script

Automated deployment:

```bash
# Deploy to production
ENVIRONMENT=production VERSION=v1.0.0 ./scripts/deploy.sh

# Deploy to staging
ENVIRONMENT=staging VERSION=v1.0.0-rc.1 ./scripts/deploy.sh

# Skip tests
SKIP_TESTS=true ./scripts/deploy.sh

# Skip build (use existing images)
SKIP_BUILD=true VERSION=v1.0.0 ./scripts/deploy.sh
```

## CI/CD Pipeline

### GitHub Actions Workflows

The project includes automated CI/CD workflows:

#### Continuous Integration (.github/workflows/ci.yml)

Runs on every push and pull request:

- Linting (Biome)
- Type checking (TypeScript)
- Unit tests (Vitest)
- Integration tests
- E2E tests (Playwright)
- Security scanning (Trivy)
- Docker image builds

#### Deployment (.github/workflows/deploy.yml)

**Staging Deployment:**
- Triggered on push to `main` branch
- Builds and pushes Docker images
- Deploys to staging namespace
- Runs smoke tests

**Production Deployment:**
- Manual trigger via workflow_dispatch
- Blue-green deployment strategy
- Database migrations
- Health checks
- Automatic rollback on failure

### Setting Up GitHub Actions

1. **Configure Repository Secrets:**

Go to Settings > Secrets and variables > Actions, add:

```
KUBE_CONFIG          - Base64 encoded kubeconfig
DOCKER_USERNAME      - Container registry username
DOCKER_PASSWORD      - Container registry password
SLACK_WEBHOOK_URL    - Slack notification webhook (optional)
```

2. **Generate Kubeconfig:**

```bash
# Get kubeconfig and encode
kubectl config view --flatten --minify | base64 -w 0
```

3. **Trigger Deployment:**

```bash
# Push to main (staging)
git push origin main

# Production deployment
gh workflow run deploy.yml \
  -f environment=production \
  -f version=v1.0.0
```

## Monitoring

### Prometheus + Grafana

Deploy monitoring stack:

```bash
# Deploy Prometheus
kubectl apply -f k8s/monitoring/prometheus.yaml

# Deploy Grafana
kubectl apply -f k8s/monitoring/grafana.yaml

# Access Grafana
kubectl port-forward -n revealui svc/grafana 3000:3000
# Open http://localhost:3000
# Default credentials: admin / admin
```

### Pre-configured Dashboards

Import dashboards from `k8s/monitoring/dashboards/`:

1. **RevealUI Overview**: System health, request rates, errors
2. **Database Metrics**: PostgreSQL connections, query performance
3. **Kubernetes Metrics**: Pod CPU/memory, network I/O

### Alerts

Configure alerts in `k8s/monitoring/alerts/`:

- High error rate (>5%)
- High response time (>2s p95)
- Database connection pool exhausted
- Pod crash loop
- Deployment failed

Alerts are sent to:
- Slack (if webhook configured)
- Email (if SMTP configured)
- PagerDuty (if configured)

## Disaster Recovery

### Database Backups

#### Automated Backups

PostgreSQL backups run daily at 2 AM (configured in `k8s/statefulsets/postgres.yaml`):

```bash
# View backup CronJob
kubectl get cronjob postgres-backup -n revealui

# View backup history
kubectl get jobs -n revealui | grep postgres-backup

# List backup files
kubectl exec -n revealui postgres-0 -- ls -lh /backup
```

#### Manual Backup

```bash
# Create immediate backup
kubectl create job postgres-backup-manual \
  --from=cronjob/postgres-backup \
  -n revealui

# Download backup
kubectl exec -n revealui postgres-0 -- \
  cat /backup/postgres-20240101-120000.sql.gz > backup.sql.gz
```

#### Restore from Backup

```bash
# Upload backup to pod
kubectl cp backup.sql.gz revealui/postgres-0:/tmp/

# Restore database
kubectl exec -n revealui postgres-0 -- bash -c \
  "gunzip -c /tmp/backup.sql.gz | psql -U postgres revealui"
```

### Rollback Deployments

Use the rollback script:

```bash
# View deployment history
./scripts/rollback.sh history

# Rollback to previous version
./scripts/rollback.sh rollback-all

# Rollback to specific revision
./scripts/rollback.sh rollback-cms 5

# Rollback database migration
./scripts/rollback.sh rollback-db
```

### Emergency Procedures

#### Scale Down (Maintenance Mode)

```bash
# Pause all deployments
./scripts/rollback.sh pause

# Or manually
kubectl scale deployment/revealui-cms --replicas=0 -n revealui
kubectl scale deployment/revealui-dashboard --replicas=0 -n revealui
```

#### Scale Up (Resume Operations)

```bash
# Resume deployments
./scripts/rollback.sh resume

# Or manually
kubectl scale deployment/revealui-cms --replicas=3 -n revealui
kubectl scale deployment/revealui-dashboard --replicas=2 -n revealui
```

#### Complete Disaster Recovery

```bash
# 1. Restore from backup
kubectl apply -f k8s/statefulsets/postgres.yaml
kubectl exec -n revealui postgres-0 -- restore-from-backup.sh

# 2. Redeploy applications
kubectl apply -f k8s/deployments/

# 3. Verify health
kubectl get pods -n revealui
./scripts/rollback.sh health
```

## Troubleshooting

### Common Issues

#### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n revealui

# View pod events
kubectl describe pod <pod-name> -n revealui

# Check logs
kubectl logs <pod-name> -n revealui

# Check previous logs (if pod restarted)
kubectl logs <pod-name> -n revealui --previous
```

#### Database Connection Issues

```bash
# Test database connectivity
kubectl exec -n revealui postgres-0 -- pg_isready

# Check database logs
kubectl logs -n revealui postgres-0

# Verify secrets
kubectl get secret revealui-secrets -n revealui -o jsonpath='{.data.DATABASE_URL}' | base64 -d
```

#### Ingress Not Working

```bash
# Check ingress status
kubectl get ingress -n revealui

# Describe ingress
kubectl describe ingress revealui-ingress -n revealui

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx

# Verify cert-manager
kubectl get certificate -n revealui
kubectl describe certificate revealui-tls -n revealui
```

#### High Memory Usage

```bash
# Check pod resource usage
kubectl top pods -n revealui

# Increase resource limits
kubectl set resources deployment/revealui-cms \
  --limits=memory=2Gi \
  -n revealui
```

#### Slow Response Times

```bash
# Check HPA status
kubectl get hpa -n revealui

# Manually scale up
kubectl scale deployment/revealui-cms --replicas=10 -n revealui

# Check database performance
kubectl exec -n revealui postgres-0 -- psql -U postgres revealui -c \
  "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

### Debugging Commands

```bash
# Get all resources in namespace
kubectl get all -n revealui

# Check pod resource usage
kubectl top pods -n revealui
kubectl top nodes

# View cluster events
kubectl get events -n revealui --sort-by='.lastTimestamp'

# Execute shell in pod
kubectl exec -it <pod-name> -n revealui -- /bin/sh

# Port forward to pod
kubectl port-forward -n revealui pod/<pod-name> 3000:3000

# View deployment status
kubectl rollout status deployment/revealui-cms -n revealui
kubectl rollout history deployment/revealui-cms -n revealui

# Check configuration
kubectl get configmap revealui-config -n revealui -o yaml
kubectl get secret revealui-secrets -n revealui -o yaml
```

### Performance Tuning

#### Application Level

```yaml
# Increase replicas
spec:
  replicas: 10

# Adjust HPA
spec:
  minReplicas: 5
  maxReplicas: 20
  targetCPUUtilizationPercentage: 60
```

#### Database Level

```bash
# Increase connection pool
kubectl set env deployment/revealui-cms \
  DATABASE_POOL_SIZE=50 \
  -n revealui

# Add read replicas
kubectl scale statefulset/postgres --replicas=3 -n revealui
```


## Security Best Practices

1. **Secrets Management**
   - Use external secrets manager (Vault, Google Secret Manager, AWS Secrets Manager)
   - Rotate secrets regularly
   - Never commit secrets to git

2. **Network Policies**
   - Implement network policies to restrict pod-to-pod communication
   - Use service mesh (Istio, Linkerd) for mTLS

3. **Image Security**
   - Scan images for vulnerabilities (Trivy, Snyk)
   - Use minimal base images (Alpine)
   - Run as non-root user
   - Keep images updated

4. **RBAC**
   - Follow principle of least privilege
   - Use service accounts with minimal permissions
   - Audit access regularly

5. **Monitoring & Logging**
   - Enable audit logging
   - Monitor for suspicious activity
   - Set up alerts for security events

## Support

For issues and questions:

- **Documentation**: https://docs.revealui.example.com
- **GitHub Issues**: https://github.com/your-org/revealui/issues
- **Slack**: #revealui-support
- **Email**: support@revealui.example.com
