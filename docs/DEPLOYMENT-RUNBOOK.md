---
alwaysApply: true
---

# Deployment Runbook for RevealUI Framework

## Pre-Deployment Checklist

### 1. Code Quality
- [ ] All tests passing (`pnpm test`)
- [ ] No linter errors (`pnpm lint`)
- [ ] No TypeScript errors (`pnpm typecheck:all`)
- [ ] Security audit clean (`pnpm audit --audit-level=high`)
- [ ] Code review completed and approved

### 2. Environment Configuration
- [ ] All environment variables configured in Vercel
- [ ] `PAYLOAD_SECRET` is cryptographically strong (32+ chars)
- [ ] `PAYLOAD_WHITELISTORIGINS` includes production domains
- [ ] Database connection string verified
- [ ] Stripe webhook secret configured
- [ ] SMTP credentials configured (if using email)

### 3. Security Verification
- [ ] Security headers configured
- [ ] CORS origins properly set
- [ ] Rate limiting enabled on auth endpoints
- [ ] No test/debug endpoints exposed
- [ ] Environment variables not hardcoded

### 4. Database
- [ ] Database migrations up to date
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
   - [ ] Multi-tenant isolation verified

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

#### PayloadCMS
```env
PAYLOAD_SECRET=<32+ char random string>
PAYLOAD_PUBLIC_SERVER_URL=https://your-cms-domain.com
PAYLOAD_WHITELISTORIGINS=https://your-domain.com,https://your-cms-domain.com
PAYLOAD_REVALIDATION_KEY=<random string>
PAYLOAD_PUBLIC_DRAFT_SECRET=<random string>
```

#### Database (Supabase)
```env
SUPABASE_DATABASE_URI=postgresql://user:pass@host:port/db
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

#### Stripe
```env
STRIPE_SECRET_KEY=sk_live_<your-key>
STRIPE_PUBLISHABLE_KEY=pk_live_<your-key>
STRIPE_WEBHOOK_SECRET=whsec_<your-webhook-secret>
PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY=false
```

#### Next.js
```env
NEXT_PUBLIC_SERVER_URL=https://your-cms-domain.com
NEXT_PUBLIC_IS_LIVE=true
```

#### Monitoring (Optional)
```env
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn
SENTRY_AUTH_TOKEN=<your-auth-token>
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

3. **Database Rollback** (if needed)
   ```bash
   # Restore from backup (have procedure documented)
   # Run migration rollback if using custom migrations
   ```

4. **Verify Rollback**
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
      "database": "connected",
      "payload": "operational"
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

### Backup Strategy

- **Frequency**: Daily automatic backups (Supabase)
- **Retention**: 30 days
- **Test Restore**: Monthly verification

### Migration Process

PayloadCMS handles migrations automatically, but:

1. **Before deployment**:
   - Review migration plans
   - Test migrations in staging
   - Create manual backup

2. **During deployment**:
   - Migrations run automatically on build
   - Monitor for migration errors

3. **After deployment**:
   - Verify schema changes applied
   - Check data integrity

---

## Performance Optimization

### CDN Configuration

- **Assets**: Cached for 1 year (`vercel.json`)
- **Images**: Optimized via Next.js Image component
- **Static pages**: Consider ISR (Incremental Static Regeneration)

### Database Optimization

- Indexes on frequently queried fields (slug, tenant relationships)
- Connection pooling via Supabase
- Query optimization for n+1 problems

---

## Security Checklist

### Pre-Production
- [ ] All dependencies updated to latest secure versions
- [ ] No known critical/high vulnerabilities
- [ ] Authentication properly configured
- [ ] CORS restricted to known domains
- [ ] Security headers present
- [ ] Secrets not exposed in code
- [ ] Rate limiting enabled

### Post-Deployment
- [ ] Monitor for unusual authentication patterns
- [ ] Watch for rate limit violations
- [ ] Check for unauthorized access attempts
- [ ] Verify webhook signature validations working

---

## Troubleshooting Common Issues

### Build Failures

**Issue**: Dependency conflicts
- **Solution**: Run `pnpm install --frozen-lockfile`

**Issue**: Type errors
- **Solution**: Regenerate PayloadCMS types: `pnpm generate:payload-types`

### Runtime Errors

**Issue**: Database connection fails
- **Solution**: Verify `SUPABASE_DATABASE_URI` is correct
- **Check**: Connection string format, credentials

**Issue**: JWT verification fails
- **Solution**: Ensure `PAYLOAD_SECRET` matches across all instances

**Issue**: CORS errors
- **Solution**: Verify `PAYLOAD_WHITELISTORIGINS` includes request origin

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
- [ ] Check all integrations (Stripe, Supabase)
- [ ] Verify webhooks processing
- [ ] Monitor user feedback

### First Week
- [ ] Review security logs
- [ ] Analyze performance trends
- [ ] Check for any regression issues
- [ ] Gather user feedback

---

## Contacts & Escalation

### On-Call Rotation
- **Primary**: [Team Lead Name]
- **Secondary**: [Senior Developer Name]
- **Escalation**: [CTO/Technical Director]

### Critical Issue Response

1. **Severity 1** (Production Down): < 15 minutes
2. **Severity 2** (Major Feature Broken): < 1 hour
3. **Severity 3** (Minor Issue): < 4 hours
4. **Severity 4** (Enhancement): Next sprint

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

---

**Last Updated**: January 16, 2025  
**Document Owner**: DevOps Team  
**Review Frequency**: After each major release

