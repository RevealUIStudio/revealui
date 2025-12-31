# Rollback Procedure for RevealUI Framework

**Purpose**: Step-by-step guide to rollback production deployment if critical issues are detected  
**Last Updated**: January 2025

---

## When to Rollback

Rollback should be considered when:
- Critical security vulnerability discovered
- System-wide outage or unavailability
- Data corruption or loss detected
- Payment processing failures
- Authentication system failures
- Performance degradation > 50%
- Error rate > 5%

---

## Pre-Rollback Checklist

Before initiating rollback:

- [ ] Confirm issue severity (Critical/High/Medium)
- [ ] Document the issue and impact
- [ ] Notify stakeholders
- [ ] Verify rollback target version is stable
- [ ] Ensure database backup is available
- [ ] Confirm rollback procedure with team

---

## Rollback Methods

### Method 1: Vercel Dashboard (Fastest - Recommended)

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

---

### Method 2: Git Revert (Code-Based)

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

---

### Method 3: Database Rollback (If Needed)

**⚠️ Only if database schema changes were made**

**Time**: 15-30 minutes

1. **Stop Application**
   - Prevent new writes during rollback

2. **Restore Database Backup**
   ```bash
   # For Vercel Postgres
   # Use Vercel dashboard or CLI to restore from backup
   
   # For Supabase
   # Use Supabase dashboard: Settings → Database → Backups
   ```

3. **Run Migration Rollback** (if applicable)
   ```bash
   # If using custom migrations
   # Run rollback migration scripts
   ```

4. **Verify Database State**
   - Check critical tables
   - Verify data integrity
   - Test database queries

5. **Restart Application**
   - Deploy previous version
   - Verify application works

---

## Post-Rollback Actions

### Immediate (First Hour)

- [ ] Verify system is operational
- [ ] Check all critical endpoints
- [ ] Monitor error rates
- [ ] Test payment processing
- [ ] Verify authentication
- [ ] Check database connectivity
- [ ] Monitor performance metrics

### First 24 Hours

- [ ] Document root cause of issue
- [ ] Create incident report
- [ ] Review what went wrong
- [ ] Plan fix for rolled-back version
- [ ] Update monitoring alerts
- [ ] Communicate status to stakeholders

### Follow-Up

- [ ] Fix the issue in development
- [ ] Add tests to prevent recurrence
- [ ] Update deployment procedures
- [ ] Review and improve rollback process
- [ ] Conduct post-mortem meeting

---

## Rollback Verification Checklist

After rollback, verify:

### System Health
- [ ] Health endpoint returns 200: `/api/health`
- [ ] Database connectivity working
- [ ] External services (Stripe, Blob) accessible
- [ ] No critical errors in logs

### Critical User Flows
- [ ] User registration works
- [ ] User login works
- [ ] Admin panel accessible
- [ ] Payment processing works
- [ ] Form submissions work
- [ ] Multi-tenant isolation working

### Performance
- [ ] Response times normal (< 2s p95)
- [ ] Error rate < 0.1%
- [ ] No memory leaks
- [ ] Database queries performant

### Security
- [ ] Authentication working
- [ ] Authorization checks working
- [ ] Rate limiting active
- [ ] Security headers present
- [ ] No security vulnerabilities introduced

---

## Communication Template

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

---

## Prevention Measures

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

---

## Emergency Contacts

- **Primary On-Call**: [Name] - [Phone/Email]
- **Secondary On-Call**: [Name] - [Phone/Email]
- **Technical Lead**: [Name] - [Phone/Email]
- **DevOps**: [Name] - [Phone/Email]

---

## Notes

- Keep this procedure updated
- Test rollback procedure quarterly
- Document any changes to process
- Review after each incident

---

**Last Reviewed**: January 2025  
**Next Review**: After next production deployment

