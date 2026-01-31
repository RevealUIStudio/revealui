# RevealUI CI/CD Deployment Guide

**Last Updated**: January 31, 2026
**Status**: Setup Guide (Project Not Yet Production Ready)

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

### Core Variables (Required)

| Variable | Description | Example |
|----------|-------------|---------|
| `REVEALUI_SECRET` | Encryption key for JWT/sessions (32+ chars) | `your-32-character-secret-minimum` |
| `POSTGRES_URL` | NeonDB connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `REVEALUI_PUBLIC_SERVER_URL` | Public URL of the CMS | `https://cms.yourdomain.com` |

### Storage (Required for Media)

| Variable | Description | Example |
|----------|-------------|---------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token | `vercel_blob_rw_xxx` |

### Stripe (Required for Payments)

| Variable | Description | Example |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_live_xxx` or `sk_test_xxx` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_live_xxx` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | `whsec_xxx` |

### Supabase Client (Optional)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | `eyJ...` |

### Monitoring (Optional)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry error tracking DSN | `https://xxx@sentry.io/xxx` |

---

## NeonDB Setup

### 1. Create NeonDB Database

1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string from the dashboard

### 2. Connection String Format

```
postgresql://[user]:[password]@[endpoint-host]/[database]?sslmode=require
```

**Example:**
```
postgresql://neondb_owner:npg_xxx@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### 3. Create Database Tables (Drizzle ORM)

RevealUI uses Drizzle ORM with NeonDB. The schema is defined in `@revealui/db`.

**Option A: Push schema directly (recommended)**

```bash
cd packages/db
DATABASE_URL="your-neondb-url" pnpm db:push
```

**Option B: Generate and run migrations**

```bash
cd packages/db
DATABASE_URL="your-neondb-url" pnpm db:generate
DATABASE_URL="your-neondb-url" pnpm db:migrate
```

**Option C: Run raw SQL**

If you prefer raw SQL, use this in your NeonDB console:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  roles TEXT[] DEFAULT ARRAY['user'],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Pages table
CREATE TABLE IF NOT EXISTS pages (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  slug VARCHAR(255) UNIQUE,
  hero JSONB,
  layout JSONB,
  meta JSONB,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  slug VARCHAR(255) UNIQUE,
  content JSONB,
  excerpt TEXT,
  published BOOLEAN DEFAULT false,
  publish_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Media table
CREATE TABLE IF NOT EXISTS media (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255),
  mime_type VARCHAR(100),
  filesize INTEGER,
  url VARCHAR(500),
  alt VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Global: Header
CREATE TABLE IF NOT EXISTS global_header (
  id SERIAL PRIMARY KEY,
  nav_items JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Global: Footer  
CREATE TABLE IF NOT EXISTS global_footer (
  id SERIAL PRIMARY KEY,
  columns JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Global: Settings
CREATE TABLE IF NOT EXISTS global_settings (
  id SERIAL PRIMARY KEY,
  site_name VARCHAR(255),
  site_description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default globals
INSERT INTO global_header (nav_items) VALUES ('[]') ON CONFLICT DO NOTHING;
INSERT INTO global_footer (columns) VALUES ('[]') ON CONFLICT DO NOTHING;
INSERT INTO global_settings (site_name) VALUES ('RevealUI') ON CONFLICT DO NOTHING;
```

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

In Vercel Dashboard → Settings → Environment Variables, add:

```env
# Required
REVEALUI_SECRET=your-32-character-secret-minimum
POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require
REVEALUI_PUBLIC_SERVER_URL=https://your-project.vercel.app

# Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Optional
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

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
          node-version: '24.12.0'
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

```env
# Local development
REVEALUI_SECRET=dev-secret-32-chars-minimum-ok
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000

# Use your NeonDB for local dev too
POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require

# Or use PGlite for local dev/testing (in-memory PostgreSQL)
# Note: PGlite is used automatically when POSTGRES_URL is not set

# Storage - still need Vercel Blob for media
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx

# Stripe test keys
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
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

### Build Fails: "relation does not exist"

**Cause:** Database tables haven't been created.

**Solution:** Run the SQL migration script in your NeonDB console.

### Build Fails: "REVEALUI_SECRET is not set"

**Cause:** Missing required environment variable.

**Solution:** Add `REVEALUI_SECRET` to Vercel environment variables.

### Media Upload Fails

**Cause:** Missing or invalid Blob storage token.

**Solution:** 
1. Go to Vercel → Storage → Blob
2. Create a blob store
3. Generate Read/Write token
4. Add as `BLOB_READ_WRITE_TOKEN`

### Database Connection Timeout

**Cause:** Network issues or incorrect connection string.

**Solution:**
1. Verify connection string format
2. Ensure `?sslmode=require` is included
3. Check NeonDB dashboard for the correct endpoint

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

**Last Updated**: January 2, 2026
**Status**: Deployment Guide (Project Not Yet Production Ready)

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
   grep -r "console.log" apps/cms/src/lib apps/web/src --exclude="*.test.ts"
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

#### Required for Production

**RevealUI Core**
```env
REVEALUI_SECRET=<32+ char random string>
REVEALUI_PUBLIC_SERVER_URL=https://your-cms-domain.com
```

**Database (NeonDB Postgres)**
```env
POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require
```

**Storage (Vercel Blob)**
```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx
```

**Stripe**
```env
STRIPE_SECRET_KEY=sk_live_<your-key>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_<your-key>
STRIPE_WEBHOOK_SECRET=whsec_<your-webhook-secret>
```

**Next.js**
```env
NEXT_PUBLIC_SERVER_URL=https://your-cms-domain.com
```

**Supabase Client (Optional)**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

**Monitoring (Optional)**
```env
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn
```

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

## Related Documentation

- [Deployment Runbook](../guides/deployment/DEPLOYMENT-RUNBOOK.md) - Complete deployment guide
- [Environment Variables Guide](./ENVIRONMENT_VARIABLES_GUIDE.md) - Complete configuration guide with quick reference tables
- [Fresh Database Setup](../reference/database/FRESH-DATABASE-SETUP.md) - Database setup
- [Docker Production Security](./DOCKER_PRODUCTION_SECURITY.md) - Docker security guide
- [Drizzle Guide](./DRIZZLE_GUIDE.md) - Database ORM guide
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../INDEX.md) - Find docs by task

---

**Status:** Setup Guide (Project Not Yet Production Ready)
**Last Verified:** January 31, 2026
