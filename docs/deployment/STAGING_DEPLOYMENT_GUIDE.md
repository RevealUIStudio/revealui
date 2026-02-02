# Staging Deployment Guide

**Project**: RevealUI CMS
**Target**: Staging Environment
**Platform**: Vercel
**Date**: February 2, 2026

---

## Deployment Readiness Assessment

### ✅ Prerequisites Complete

1. **Code Quality**:
   - ✅ 100% test pass rate (206/206 tests)
   - ✅ No failing tests
   - ✅ All TypeScript compilation successful

2. **Security**:
   - ✅ Security scan completed (A- grade, 9.0/10)
   - ✅ JWT validation hardened
   - ✅ No critical vulnerabilities found
   - ✅ Security headers properly configured

3. **Performance**:
   - ✅ Load testing completed
   - ✅ Module resolution issues fixed
   - ⚠️  Production build required for accurate metrics

4. **Infrastructure**:
   - ✅ Vercel configuration present (apps/cms/vercel.json)
   - ✅ GitHub workflows configured
   - ✅ Environment promotion workflow available
   - ✅ Emergency rollback workflow present

---

## Pre-Deployment Checklist

### Required Actions Before Deployment

- [ ] **Production Build**
  ```bash
  cd /home/joshua-v-dev/projects/RevealUI
  pnpm --filter cms build
  ```

- [ ] **Environment Variables**
  Configure in Vercel dashboard for staging:
  ```
  REVEALUI_SECRET=<32+ character secret>
  DATABASE_URL=<staging database url>
  NEXT_PUBLIC_SERVER_URL=<staging url>
  NEXT_PUBLIC_CMS_URL=<staging url>
  # ... other environment variables from .env
  ```

- [ ] **Database Setup**
  ```bash
  # Run migrations on staging database
  pnpm db:migrate

  # Optional: Seed test data
  pnpm db:seed
  ```

- [ ] **Vercel CLI Setup**
  ```bash
  # Install Vercel CLI if not present
  pnpm add -g vercel

  # Login to Vercel
  vercel login

  # Link project to Vercel
  cd apps/cms
  vercel link
  ```

---

## Deployment Methods

### Method 1: Vercel CLI (Recommended for Staging)

```bash
# Navigate to CMS app
cd /home/joshua-v-dev/projects/RevealUI/apps/cms

# Deploy to staging
vercel --prod=false

# Or deploy to production
vercel --prod
```

**Advantages**:
- Fast deployment
- Preview URL provided immediately
- Can test before promoting to production
- Rollback capability

### Method 2: GitHub Actions Workflow

```bash
# Trigger environment promotion workflow
# Via GitHub UI: Actions → Environment Promotion → Run workflow

# Or via gh CLI
gh workflow run environment-promotion.yml \
  -f source_env=development \
  -f target_env=staging \
  -f performance_threshold=85 \
  -f require_manual_approval=true
```

**Advantages**:
- Automated validation checks
- Performance testing before deployment
- Security scanning
- Manual approval gates
- Audit trail

### Method 3: Git Push (Automatic)

```bash
# Push to staging branch (if configured)
git checkout staging
git merge main
git push origin staging
```

**Advantages**:
- Automatic deployment on push
- GitOps workflow
- CI/CD integration

---

## Post-Deployment Validation

### 1. Health Check

```bash
# Check health endpoint
curl https://your-staging-url.vercel.app/api/health

# Expected: HTTP 200 with health status
```

### 2. Smoke Tests

```bash
# Test critical endpoints
curl https://your-staging-url.vercel.app/
curl https://your-staging-url.vercel.app/admin
curl https://your-staging-url.vercel.app/api/users

# All should return appropriate responses (not 500)
```

### 3. Authentication Test

```bash
# Test login endpoint
curl -X POST https://your-staging-url.vercel.app/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword"}'

# Expected: JWT token or appropriate error
```

### 4. Database Connectivity

```bash
# Test database-dependent endpoint
curl https://your-staging-url.vercel.app/api/pages

# Expected: Data or empty array, not database error
```

### 5. Security Headers

```bash
# Verify security headers in production
curl -I https://your-staging-url.vercel.app/

# Check for:
# - Content-Security-Policy
# - X-Frame-Options
# - X-Content-Type-Options
# - Strict-Transport-Security (HTTPS)
```

---

## Rollback Procedures

### Quick Rollback (Vercel CLI)

```bash
# List recent deployments
vercel ls

# Rollback to specific deployment
vercel rollback <deployment-url>
```

### Emergency Rollback (GitHub Actions)

```bash
# Trigger emergency rollback workflow
gh workflow run emergency-rollback.yml \
  -f environment=staging \
  -f target_deployment=<previous-deployment-id>
```

---

## Monitoring & Validation

### Performance Monitoring

1. **Vercel Analytics**: Check Vercel dashboard for:
   - Response times
   - Error rates
   - Geographic distribution
   - Core Web Vitals

2. **Application Logs**:
   ```bash
   # View Vercel logs
   vercel logs <deployment-url>
   ```

3. **Database Monitoring**:
   - Query performance
   - Connection pool status
   - Error rates

### Security Monitoring

1. **Review Security Headers**: Use https://securityheaders.com/
2. **SSL/TLS Configuration**: Use https://www.ssllabs.com/ssltest/
3. **Error Logs**: Check for security-related errors
4. **Rate Limiting**: Verify rate limiting is active

---

## Known Issues & Workarounds

### Issue 1: Request Context in Client Components

**Problem**: `node:async_hooks` cannot be bundled for client components in development mode

**Status**: Dev environment issue, resolved in production build

**Workaround**: Ensure production build is used for staging deployment
```bash
pnpm --filter cms build
```

### Issue 2: Rate Limiting Storage Configuration

**Problem**: Rate limiting middleware storage configuration issue in dev mode

**Status**: Minor issue, does not affect core functionality

**Workaround**: Verify rate limiting works in production build

---

## Environment Configuration

### Staging Environment Variables

**Required**:
```env
# Core
REVEALUI_SECRET=<32+ chars, different from production>
DATABASE_URL=<staging database>
POSTGRES_URL=<staging postgres>

# URLs
NEXT_PUBLIC_SERVER_URL=https://staging-cms.yourdomain.com
NEXT_PUBLIC_CMS_URL=https://staging-cms.yourdomain.com
REVEALUI_PUBLIC_SERVER_URL=https://staging-cms.yourdomain.com

# CORS
REVEALUI_CORS_ORIGINS=https://staging-cms.yourdomain.com

# Optional
NEXT_PUBLIC_SENTRY_DSN=<staging sentry dsn>
```

**Database**: Use separate staging database, not production!

**Secrets**: Generate new secrets for staging, do not reuse production secrets

---

## Success Criteria

Deployment is successful when:

- ✅ Health endpoint returns HTTP 200
- ✅ Admin dashboard loads without errors
- ✅ Authentication flow works (login/logout)
- ✅ Database queries execute successfully
- ✅ Security headers present
- ✅ No console errors in browser
- ✅ API endpoints return expected data
- ✅ Response times < 2 seconds for critical paths

---

## Deployment Timeline

**Estimated Time**: 30-45 minutes

1. **Pre-deployment** (15 min):
   - Run production build
   - Configure environment variables
   - Run database migrations

2. **Deployment** (5 min):
   - Execute deployment command
   - Wait for build completion
   - Receive deployment URL

3. **Post-deployment** (15 min):
   - Run health checks
   - Execute smoke tests
   - Verify security configuration
   - Monitor for errors

4. **Validation** (10 min):
   - Manual testing of critical flows
   - Review logs and metrics
   - Document any issues

---

## Support & Escalation

### If Deployment Fails

1. **Check build logs**:
   ```bash
   vercel logs <deployment-url> --follow
   ```

2. **Review error messages**: Look for:
   - Module resolution errors
   - Environment variable issues
   - Database connection failures

3. **Rollback if necessary**:
   ```bash
   vercel rollback <previous-deployment>
   ```

4. **Contact escalation**: Document error and seek help

### If Deployment Succeeds But App Misbehaves

1. **Check Vercel dashboard**: Error rates, logs
2. **Test locally with production build**:
   ```bash
   pnpm --filter cms build
   pnpm --filter cms start
   ```
3. **Review environment variables**: Ensure all required vars are set
4. **Check database connectivity**: Verify staging database is accessible

---

## Next Steps After Staging

1. **Perform User Acceptance Testing** (UAT)
2. **Load testing on staging environment**
3. **Security scan with production build**
4. **Gather stakeholder feedback**
5. **Document any issues or improvements**
6. **Plan production deployment**

---

## Deployment Command Summary

```bash
# Quick Reference - Staging Deployment

# 1. Build for production
cd /home/joshua-v-dev/projects/RevealUI
pnpm --filter cms build

# 2. Deploy to Vercel staging
cd apps/cms
vercel --prod=false

# 3. Run health check
curl https://<staging-url>/api/health

# 4. Monitor logs
vercel logs <staging-url> --follow

# 5. If issues, rollback
vercel rollback <previous-deployment-url>
```

---

## References

- Vercel Documentation: https://vercel.com/docs
- Environment Promotion Workflow: packages/config/src/ci/github/workflows/environment-promotion.yml
- Emergency Rollback: packages/config/src/ci/github/workflows/emergency-rollback.yml
- Security Scan Report: SECURITY_SCAN_REPORT.md
- Path C Validation Report: PATH_C_VALIDATION_REPORT.md (if exists)
