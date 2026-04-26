---
title: "Troubleshooting"
description: "Common issues, error messages, and solutions for RevealUI development"
category: guide
audience: developer
---

# Troubleshooting Guide

**Last Updated**: 2026-02-01

Comprehensive troubleshooting guide for common RevealUI issues.

---

## Table of Contents

1. [Database Issues](#database-issues)
2. [Environment Variables](#environment-variables)
3. [Build & Deployment](#build--deployment)
4. [Development Environment](#development-environment)
5. [Authentication & Security](#authentication--security)
6. [Performance Issues](#performance-issues)
7. [Getting Help](#getting-help)

---

## Database Issues

### Cannot Connect to Database

**Symptoms**: Connection errors, timeout errors, "relation does not exist"

**Solutions**:

1. **Verify connection string format**
   ```bash
   # Correct format (SSL required):
   postgresql://user:password@host:5432/database?sslmode=require

   # Common mistakes:
   # ❌ Missing ?sslmode=require
   # ❌ Wrong port (should be 5432 for PostgreSQL)
   # ❌ Incorrect credentials
   ```

2. **Check SSL settings**
   - NeonDB/Supabase require `?sslmode=require`
   - Verify SSL certificates are valid
   - Check firewall rules allow SSL connections

3. **Verify database is accessible**
   ```bash
   # Test connection with psql
   psql "postgresql://user:password@host/db?sslmode=require"
   ```

4. **Check IP allowlist** (Supabase only)
   - Go to Supabase Dashboard → Settings → Database → Network
   - Add your IP address or use connection pooling (port 6543)

**See Also**: [Database Guide](./DATABASE.md#troubleshooting)

---

### Tables Not Created Automatically

**Symptoms**: RevealUI doesn't create tables, "table does not exist" errors

**Solutions**:

1. **Verify database permissions**
   - User must have CREATE TABLE permission
   - Check with: `SELECT has_database_privilege('username', 'database', 'CREATE');`

2. **Run database initialization manually**
   ```bash
   pnpm db:init
   pnpm db:migrate
   ```

3. **Check RevealUI config**
   - Verify `db` adapter is correctly configured in `revealui.config.ts`
   - Ensure environment variable is loaded

4. **Check application logs**
   - Look for errors during startup
   - Check for connection timeouts

**See Also**: [Database Guide](./DATABASE.md)

---

### Migration Failures

**Symptoms**: "Failed to run migrations", "migration already exists"

**Solutions**:

1. **Check migration status**
   ```bash
   pnpm db:status
   ```

2. **Reset migrations** (development only)
   ```bash
   pnpm db:reset --confirm
   pnpm db:migrate
   ```

3. **Manually apply migrations**
   - Check `packages/db/migrations/` for SQL files
   - Apply manually via database console if needed

**See Also**: [Database Guide](./DATABASE.md)

---

## Environment Variables

### Missing Required Variables

**Symptoms**: "REVEALUI_SECRET is not set", "Invalid configuration"

**Solutions**:

1. **Verify .env file exists**
   ```bash
   # Check file exists
   ls -la .env.development.local

   # If missing, copy template
   cp .env.template .env.development.local
   ```

2. **Generate required secrets**
   ```bash
   # Generate REVEALUI_SECRET (32+ characters)
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Check variable names**
   - `POSTGRES_URL` or `DATABASE_URL` (either works)
   - `REVEALUI_SECRET` (not REVEAL_SECRET)
   - `BLOB_READ_WRITE_TOKEN` (not BLOB_TOKEN)

4. **Restart development server**
   - Changes to .env files require server restart
   - Stop (Ctrl+C) and run `pnpm dev` again

**See Also**: [Environment Variables Guide](./ENVIRONMENT-VARIABLES-GUIDE.md#validation-checklist)

---

### Invalid Secret Key

**Symptoms**: "Invalid REVEALUI_SECRET", JWT errors

**Solutions**:

1. **Ensure secret is 32+ characters**
   ```bash
   # Generate new secret
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Check for special characters**
   - Use alphanumeric characters only
   - Avoid quotes, spaces, or control characters in .env file

3. **Verify secret matches across environments**
   - Development and production must use different secrets
   - Staging should have its own secret

**See Also**: [Environment Variables - REVEALUI_SECRET](./ENVIRONMENT-VARIABLES-GUIDE.md#1-revealui_secret)

---

## Build & Deployment

### Build Fails: "Module not found"

**Symptoms**: Build errors, missing dependencies

**Solutions**:

1. **Clean install dependencies**
   ```bash
   pnpm clean:install
   # OR
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

2. **Check pnpm version**
   ```bash
   pnpm --version  # Should be 10+
   ```

3. **Verify workspace configuration**
   - Check `pnpm-workspace.yaml` is correct
   - Ensure all packages are listed

**See Also**: [CI/CD Guide - Troubleshooting](./CI_CD_GUIDE.md#troubleshooting)

---

### Build Fails: TypeScript Errors

**Symptoms**: Type check failures, compilation errors

**Solutions**:

1. **Run type check**
   ```bash
   pnpm typecheck:all
   ```

2. **Check for missing types**
   - Install type definitions: `pnpm add -D @types/node`
   - Verify tsconfig.json paths are correct

3. **Clear TypeScript cache**
   ```bash
   rm -rf apps/*/tsconfig.tsbuildinfo
   pnpm build
   ```

**See Also**: [Standards - TypeScript](./STANDARDS.md#typescript)

---

### Vercel Deployment Fails

**Symptoms**: Build fails on Vercel, works locally

**Solutions**:

1. **Check environment variables**
   - Verify all required vars are set in Vercel Dashboard
   - Environment variables must be set for Production/Preview/Development

2. **Check build command**
   - Verify `vercel-build` script exists in package.json
   - Check build logs for specific errors

3. **Verify Node.js version**
   - Ensure Vercel uses Node.js 24.13.0
   - Set in `package.json` or Vercel settings

**See Also**: [CI/CD Guide - Vercel Deployment](./CI_CD_GUIDE.md#vercel-deployment)

---

## Development Environment

### Port Already in Use

**Symptoms**: "Port 4000 already in use", "EADDRINUSE"

**Solutions**:

1. **Find and kill process**
   ```bash
   # Find process using port 4000
   lsof -ti:4000

   # Kill the process
   kill -9 $(lsof -ti:4000)
   ```

2. **Use different port**
   ```bash
   PORT=4001 pnpm dev
   ```

3. **Check for zombie processes**
   ```bash
   ps aux | grep node
   killall node  # If needed
   ```

---

### pnpm Install Fails

**Symptoms**: Installation errors, network timeouts

**Solutions**:

1. **Clear pnpm cache**
   ```bash
   pnpm store prune
   pnpm install
   ```

2. **Check network connectivity**
   - Verify internet connection
   - Check if behind proxy/firewall
   - Try different registry: `pnpm config set registry https://registry.npmjs.org/`

3. **Remove node_modules and reinstall**
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

---

### Nix Environment Issues

**Symptoms**: "command not found", environment not loading

**Solutions**:

1. **Allow direnv**
   ```bash
   direnv allow
   ```

2. **Reload Nix environment**
   ```bash
   direnv reload
   # OR
   nix-shell
   ```

3. **Check flake.nix is valid**
   ```bash
   nix flake check
   ```

**See Also**: [Quick Start - Nix Setup](./QUICK_START.md)

---

## Authentication & Security

### Unable to Login

**Symptoms**: Login fails, authentication errors

**Solutions**:

1. **Verify credentials**
   - Check email and password are correct
   - Password must be 8+ characters

2. **Check REVEALUI_SECRET**
   - Must be set and consistent
   - Restart server after changing secret

3. **Clear browser cookies**
   - Logout completely
   - Clear site data
   - Try incognito/private window

---

### Session Errors

> Per [ADR-004](./architecture/ADR-004-session-only-auth.md), user-facing auth is session-only — there are no JWTs in the session cookie. JWT is used for license validation (`REVEALUI_LICENSE_PRIVATE_KEY` / RS256), which is a separate surface.

**Symptoms**: "Invalid session", "Session expired"

**Solutions**:

1. **Check session expiration**
   - Sessions expire on a sliding window (see `packages/auth/src/server/session.ts`)
   - Re-login to get a new session

2. **Verify REVEALUI_SECRET**
   - Must be 32+ characters
   - Must not change between deployments — rotating it invalidates all active sessions
   - Used for session signing, CSRF, and HMAC operations (NOT JWT signing)

3. **Check server time**
   - Server clock must be accurate (within a few seconds of UTC)
   - Use NTP if on a VPS

4. **License JWT errors (separate)**
   - If you see "Invalid license" / "License signature failed", check `REVEALUI_LICENSE_PUBLIC_KEY` matches the private key that signed the token
   - License JWTs use RS256; public/private keys must be a matched pair

**See Also**: [Auth Guide](./AUTH.md), [ADR-004](./architecture/ADR-004-session-only-auth.md)

---

## Performance Issues

### Slow Response Times

**Symptoms**: Pages load slowly, API timeouts

**Solutions**:

1. **Check database performance**
   - Review slow queries
   - Add indexes where needed
   - Use connection pooling

2. **Enable caching**
   - Configure database-backed caching
   - Use Next.js caching strategies

3. **Optimize queries**
   - Use `select()` to limit fields
   - Add database indexes
   - Use query batching

**See Also**: [Performance Guide](./PERFORMANCE.md)

---

### High Memory Usage

**Symptoms**: Out of memory errors, crashes

**Solutions**:

1. **Increase Node.js memory**
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" pnpm dev
   ```

2. **Check for memory leaks**
   - Monitor memory usage over time
   - Use Node.js profiler
   - Review event listener cleanup

3. **Optimize bundle size**
   - Use dynamic imports
   - Tree-shake unused dependencies
   - Check bundle analyzer

---

## Getting Help

### Before Asking for Help

**Checklist**:
- [ ] Checked this troubleshooting guide
- [ ] Searched GitHub Issues
- [ ] Reviewed relevant documentation
- [ ] Tried basic solutions (restart, clean install)
- [ ] Collected error messages and logs

### Where to Get Help

1. **GitHub Discussions** - https://github.com/RevealUIStudio/revealui/discussions
   - Ask questions
   - Share solutions
   - Community support

2. **GitHub Issues** - https://github.com/RevealUIStudio/revealui/issues
   - Report bugs
   - Request features
   - Track progress

3. **Discourse Community** - [Join here](https://revnation.discourse.group)
   - Discussion forums
   - Quick questions
   - Community help

4. **Email Support** - support@revealui.com
   - Technical issues
   - Account problems
   - Business inquiries

### What to Include in Bug Reports

**Template**:
```markdown
**Environment**:
- OS: [e.g., macOS 13.0, Ubuntu 22.04, Windows 11]
- Node.js version: [run `node --version`]
- pnpm version: [run `pnpm --version`]
- RevealUI version: [from package.json]

**Description**:
[Clear description of the issue]

**Steps to Reproduce**:
1. [First step]
2. [Second step]
3. [etc.]

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happens]

**Error Messages**:
```
[Paste error messages here]
```

**Screenshots** (if applicable):
[Attach screenshots]
```

---

## Related Documentation

- [Quick Start Guide](./QUICK_START.md) - Initial setup
- [Environment Variables Guide](./ENVIRONMENT-VARIABLES-GUIDE.md) - Configuration
- [Database Guide](./DATABASE.md) - Database setup and management
- [CI/CD Guide](./CI_CD_GUIDE.md) - Deployment troubleshooting
- [Standards Guide](./STANDARDS.md) - Code standards and best practices

---

**Last Updated**: 2026-02-01
**Status**: Comprehensive troubleshooting reference (consolidated from multiple guides)
