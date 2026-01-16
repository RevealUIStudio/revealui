# Critical Fixes - Verification Guide

**Date:** 2025-01-12  
**Status:** ✅ **FIXES COMPLETE** - Ready for verification

## Summary

All three critical fixes have been implemented. This guide helps verify they work correctly.

## 1. Integration Tests ✅

### What Was Fixed
- Created script to run integration tests with proper environment setup
- Script loads DATABASE_URL from .env files
- Added npm script: `pnpm test:integration:auth`

### How to Verify

1. **Ensure DATABASE_URL is set:**
   ```bash
   # Check if set
   echo $DATABASE_URL
   # or
   echo $POSTGRES_URL
   ```

2. **Run integration tests:**
   ```bash
   pnpm test:integration:auth
   ```

3. **Expected Result:**
   - Should run 19 previously skipped tests
   - All tests should pass (or show actual failures, not skips)

### Verification Checklist
- [ ] DATABASE_URL or POSTGRES_URL is set
- [ ] Script runs without errors
- [ ] Integration tests execute (not skipped)
- [ ] Tests pass or show real failures

## 2. E2E Tests ✅

### What Was Fixed
- Fixed API response mismatches (removed `data.success` expectations)
- Fixed session token extraction (now uses cookies)
- Updated all test expectations to match actual API responses

### How to Verify

1. **Start dev server:**
   ```bash
   pnpm dev
   # Server should start on http://localhost:4000
   ```

2. **Run E2E tests:**
   ```bash
   cd packages/test
   pnpm test:e2e
   # or
   pnpm test:auth-e2e
   ```

3. **Expected Result:**
   - All tests should pass
   - No "data.success is undefined" errors
   - Session token extraction works from cookies

### Verification Checklist
- [ ] Dev server starts successfully
- [ ] E2E tests run without errors
- [ ] No API response mismatch errors
- [ ] Session token extraction works
- [ ] All tests pass

## 3. SMTP Email ✅

### What Was Fixed
- Implemented real SMTP using nodemailer
- Added nodemailer dependency
- Proper error handling and configuration validation

### How to Verify

1. **Check nodemailer is installed:**
   ```bash
   pnpm --filter cms list nodemailer
   # Should show nodemailer@^7.0.12
   ```

2. **Test SMTP configuration:**
   ```bash
   # Set SMTP variables
   export SMTP_HOST=smtp.gmail.com
   export SMTP_PORT=587
   export SMTP_SECURE=false
   export SMTP_USER=your-email@gmail.com
   export SMTP_PASS=your-app-password
   export EMAIL_FROM=noreply@yourdomain.com
   ```

3. **Test email sending:**
   ```bash
   # Start dev server
   pnpm dev
   
   # In another terminal, test password reset
   curl -X POST http://localhost:4000/api/auth/password-reset \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}'
   ```

4. **Expected Result:**
   - Should return success message
   - Email should actually be sent (check inbox)
   - No "SMTP provider not fully implemented" errors

### Verification Checklist
- [ ] nodemailer is installed
- [ ] SMTP configuration is set
- [ ] Email sending works (check inbox)
- [ ] No placeholder/fake errors

## Quick Verification Commands

### Integration Tests
```bash
# Check if DATABASE_URL is set
test -n "$DATABASE_URL" || test -n "$POSTGRES_URL" && echo "✅ Database URL found" || echo "❌ Not set"

# Run tests
pnpm test:integration:auth
```

### E2E Tests
```bash
# Start server (in background or separate terminal)
pnpm dev &

# Run tests
cd packages/test && pnpm test:auth-e2e
```

### SMTP Email
```bash
# Check installation
pnpm --filter cms list nodemailer

# Test email (requires server running)
curl -X POST http://localhost:4000/api/auth/password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

## Known Issues

### Integration Tests
- ⚠️ Requires DATABASE_URL or POSTGRES_URL to be set
- ⚠️ Database must be accessible and schema must be up to date

### E2E Tests
- ⚠️ Requires dev server to be running
- ⚠️ Tests may fail if server is not accessible

### SMTP Email
- ⚠️ Requires nodemailer to be installed (✅ Done)
- ⚠️ Requires SMTP credentials to be configured
- ⚠️ Gmail requires app password (not regular password)

## Troubleshooting

### Integration Tests Not Running
- Check DATABASE_URL is set: `echo $DATABASE_URL`
- Check .env files exist and have DATABASE_URL
- Verify database is accessible

### E2E Tests Failing
- Ensure dev server is running on port 4000
- Check API endpoints are accessible
- Verify test expectations match API responses

### SMTP Not Working
- Verify nodemailer is installed: `pnpm --filter cms list nodemailer`
- Check SMTP credentials are correct
- For Gmail: Use app password, not regular password
- Check SMTP port (587 for TLS, 465 for SSL)

## Success Criteria

### ✅ Integration Tests
- [ ] Script runs without errors
- [ ] 19 tests execute (not skipped)
- [ ] Tests pass or show real failures

### ✅ E2E Tests
- [ ] All tests pass
- [ ] No API response errors
- [ ] Session management works

### ✅ SMTP Email
- [ ] nodemailer installed
- [ ] Emails actually send
- [ ] No placeholder errors

---

**Last Updated:** 2025-01-12
