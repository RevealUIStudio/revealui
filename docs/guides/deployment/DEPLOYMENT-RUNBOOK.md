# Deployment Runbook for RevealUI Framework

**Last Updated**: January 2, 2026
**Status**: Deployment Guide (Project Not Yet Production Ready)

---

## Pre-Deployment Checklist

### 1. Code Quality
- [ ] All tests passing (`pnpm test`)
- [ ] No linter errors (`pnpm lint`)
- [ ] No TypeScript errors (`pnpm typecheck:all`)
- [ ] Security audit clean (`pnpm audit --audit-level=high`)
- [ ] Code review completed and approved

### 2. Environment Configuration
- [ ] All environment variables configured in Vercel
- [ ] `REVEALUI_SECRET` is cryptographically strong (32+ chars)
- [ ] Database connection string verified
- [ ] Stripe webhook secret configured
- [ ] Vercel Blob storage token configured

### 3. Security Verification
- [ ] Security headers configured
- [ ] CORS origins properly set
- [ ] Rate limiting enabled on auth endpoints
- [ ] No test/debug endpoints exposed
- [ ] Environment variables not hardcoded

### 4. Database
- [ ] Database tables created (see CI-CD-GUIDE.md)
- [ ] Database backup created
- [ ] Rollback procedure tested
- [ ] Connection pooling configured

---

## Deployment Steps

### Staging Deployment

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

### Production Deployment

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

---

## Environment Variables

### Required for Production

#### RevealUI Core
```env
REVEALUI_SECRET=<32+ char random string>
REVEALUI_PUBLIC_SERVER_URL=https://your-cms-domain.com
```

#### Database (NeonDB Postgres)
```env
POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require
```

#### Storage (Vercel Blob)
```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx
```

#### Stripe
```env
STRIPE_SECRET_KEY=sk_live_<your-key>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_<your-key>
STRIPE_WEBHOOK_SECRET=whsec_<your-webhook-secret>
```

#### Next.js
```env
NEXT_PUBLIC_SERVER_URL=https://your-cms-domain.com
```

#### Supabase Client (Optional)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

#### Monitoring (Optional)
```env
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn
```

---

## Rollback Procedure

### If Critical Issues Detected

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

---

## Monitoring & Alerts

### Health Checks

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

### Metrics to Monitor

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

### Alert Thresholds

- **Critical**: 5xx error rate > 1%
- **High**: Response time p95 > 2000ms
- **Medium**: 4xx error rate spike > 50% increase
- **Low**: Webhook failures > 5% of total

---

## Database Maintenance

### Backup Strategy (NeonDB)

- **Frequency**: Point-in-time recovery available
- **Retention**: 7 days (free tier) / 30 days (Pro)
- **Test Restore**: Monthly verification

### Migration Process

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

---

## Troubleshooting Common Issues

### Build Failures

**Issue**: Dependency conflicts
- **Solution**: Run `pnpm install --frozen-lockfile`

**Issue**: Type errors
- **Solution**: Run `pnpm typecheck:all` and fix errors

### Runtime Errors

**Issue**: Database connection fails
- **Solution**: Verify `POSTGRES_URL` is correct
- **Check**: Connection string format, SSL mode, credentials

**Issue**: JWT verification fails
- **Solution**: Ensure `REVEALUI_SECRET` matches across all instances

**Issue**: Media upload fails
- **Solution**: Verify `BLOB_READ_WRITE_TOKEN` is correct and has Read/Write permissions

### Performance Issues

**Issue**: Slow API responses
- **Solution**: Check database query performance
- **Enable**: Query logging and analyze slow queries

**Issue**: High memory usage
- **Solution**: Check for memory leaks
- **Monitor**: Node.js heap usage

---

## Post-Deployment Tasks

### Immediate (First Hour)
- [ ] Monitor error logs
- [ ] Check health endpoint
- [ ] Verify critical user flows
- [ ] Monitor Sentry for errors

### First Day
- [ ] Review performance metrics
- [ ] Check all integrations (Stripe)
- [ ] Verify webhooks processing
- [ ] Monitor user feedback

### First Week
- [ ] Review security logs
- [ ] Analyze performance trends
- [ ] Check for any regression issues
- [ ] Gather user feedback

---

## Useful Commands

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

## Related Documentation

- [CI/CD Guide](../../development/CI-CD-GUIDE.md) - CI/CD with NeonDB and Vercel
- [Environment Variables Guide](../../development/ENVIRONMENT-VARIABLES-GUIDE.md) - Configuration reference
- [Environment Variables Reference](../../development/ENV-VARIABLES-REFERENCE.md) - Quick reference
- [Rollback Procedure](../../development/ROLLBACK-PROCEDURE.md) - Emergency rollback steps
- [Fresh Database Setup](../../reference/database/FRESH-DATABASE-SETUP.md) - Database setup
- [Monitoring Setup](../../development/MONITORING_SETUP.md) - Monitoring configuration
- [Master Index](../../INDEX.md) - Complete documentation index
- [Task-Based Guide](../../INDEX.md) - Find docs by task

---

**Document Owner**: DevOps Team  
**Review Frequency**: After each major release
