# Logging Migration Guide

**Last Updated:** 2026-02-04
**Task:** Replace console.* statements with proper logging

## Overview

RevealUI has a production-ready logging infrastructure at `@revealui/core`. This guide helps you migrate from `console.*` to structured logging.

## ✅ What's Already Done

1. **Logging Framework Exists:**
   - `@revealui/core/utils/logger` (client-side)
   - `@revealui/core/utils/logger/server` (server-side)
   - `@revealui/core/observability/logger` (full-featured)

2. **Already in Use:**
   - 20+ files already using the logger
   - Server-side monitoring and alerts use logger
   - Client HTTP utilities use logger

3. **Exports Configured:**
   - Package.json exports properly configured
   - TypeScript types available
   - Both ESM and CJS supported

## 🎯 Migration Strategy

### Phase 1: Core & Packages (Priority Files)

**Target:** Production code in `packages/*/src` and `apps/*/src`

1. **High Priority:**
   ```
   packages/core/src/
   packages/db/src/
   packages/auth/src/
   packages/services/src/
   apps/cms/src/lib/
   apps/api/src/
   ```

2. **Medium Priority:**
   ```
   packages/ai/src/
   packages/router/src/
   apps/web/src/
   apps/dashboard/src/
   ```

3. **Keep Console (Allowed):**
   - Test files (`*.test.ts`, `*.spec.ts`, `__tests__/*`)
   - Scripts (`scripts/*`)
   - Dev-only code (with `NODE_ENV` check)
   - CLI output tools

### Phase 2: Enforcement

1. Add ESLint rule (see below)
2. Add pre-commit hook
3. Update CI/CD to fail on violations

## 📝 Migration Examples

### Simple Logging

```typescript
// ❌ Before
console.log('User logged in')

// ✅ After
import { logger } from '@revealui/core/utils/logger'
logger.info('User logged in')
```

### With Context

```typescript
// ❌ Before
console.log('User:', userId, 'logged in at', timestamp)

// ✅ After
import { logger } from '@revealui/core/utils/logger'
logger.info('User logged in', {
  userId,
  timestamp,
  sessionId: req.sessionId
})
```

### Error Logging

```typescript
// ❌ Before
console.error('Failed to save:', error)
console.error(error.stack)

// ✅ After
import { logger } from '@revealui/core/utils/logger'
logger.error('Failed to save', error, {
  operation: 'user.save',
  userId
})
```

### Debug Logging

```typescript
// ❌ Before
console.debug('Cache hit:', key)

// ✅ After
import { logger } from '@revealui/core/utils/logger'
logger.debug('Cache hit', { key, ttl: 3600 })
```

### Warnings

```typescript
// ❌ Before
console.warn('Deprecated API used')

// ✅ After
import { logger } from '@revealui/core/utils/logger'
logger.warn('Deprecated API used', {
  api: 'v1/users',
  deprecatedSince: '2025-01-01',
  replacement: 'v2/users'
})
```

## 🔧 Advanced Patterns

### Database Operations

```typescript
// ❌ Before
console.log('Query:', query)
console.log('Took:', duration, 'ms')

// ✅ After
import { logQuery } from '@revealui/core/observability/logger'
logQuery(query, duration, {
  table: 'users',
  operation: 'SELECT'
})
// Automatically warns if slow (> 1000ms)
```

### API Calls

```typescript
// ❌ Before
console.log(`${method} ${url} - ${status} (${duration}ms)`)

// ✅ After
import { logAPICall } from '@revealui/core/observability/logger'
logAPICall(method, url, status, duration, {
  userId,
  requestId
})
// Automatically categorizes by status code
```

### Performance Tracking

```typescript
// ❌ Before
const start = Date.now()
await operation()
console.log('Operation took:', Date.now() - start, 'ms')

// ✅ After
import { logPerformance } from '@revealui/core/observability/logger'
const start = Date.now()
await operation()
logPerformance('user.create', Date.now() - start, { userId })
// Automatically warns if slow
```

### Audit Logging

```typescript
// ❌ Before
console.log('AUDIT: User', userId, 'performed', action)

// ✅ After
import { logAudit } from '@revealui/core/observability/logger'
logAudit('user.action', {
  userId,
  action,
  ip: request.ip,
  timestamp: new Date()
})
```

## 🚫 ESLint Configuration

Add to your ESLint config to prevent new console usage:

```javascript
// eslint.config.js or packages/dev/src/eslint/eslint.config.js
{
  rules: {
    'no-console': ['warn', {
      allow: [] // Disallow all console methods
    }]
  },
  overrides: [
    {
      // Allow console in test files
      files: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**'],
      rules: {
        'no-console': 'off'
      }
    },
    {
      // Allow console in scripts
      files: ['scripts/**/*.ts'],
      rules: {
        'no-console': 'off'
      }
    }
  ]
}
```

## 🔍 Finding Console Statements

### Manual Search

```bash
# Find all console.* in production code
grep -r "console\." packages/*/src apps/*/src --include="*.ts" --include="*.tsx"

# Exclude test files
grep -r "console\." packages/*/src apps/*/src --include="*.ts" --include="*.tsx" | grep -v ".test.ts" | grep -v ".spec.ts" | grep -v "__tests__"
```

### Automated Tool

The project may have an audit tool:

```bash
pnpm analyze:console
```

## ✅ Verification

After migration, verify no console statements remain:

```bash
# Should return nothing
grep -r "console\." packages/*/src apps/*/src --include="*.ts" --include="*.tsx" | grep -v ".test.ts" | grep -v ".spec.ts" | grep -v "__tests__"

# Run ESLint
pnpm lint

# Check specific file
eslint packages/core/src/utils/cache.ts
```

## 📊 Progress Tracking

Track your progress:

1. **Count Total:**
   ```bash
   grep -r "console\." packages/*/src apps/*/src --include="*.ts" --include="*.tsx" | wc -l
   ```

2. **Count by Package:**
   ```bash
   for pkg in packages/*/src; do
     count=$(grep -r "console\." "$pkg" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
     echo "$pkg: $count"
   done
   ```

3. **Track in Task List:**
   - Use GitHub Issues
   - Create checklist in CHANGELOG.md
   - Update PROJECT_STATUS.md

## 🎓 Training

Share this guide with the team:

1. **Documentation:** Link to [LOGGING.md](./LOGGING.md)
2. **Examples:** Review migrated files as examples
3. **Pair Programming:** Have experienced devs review PRs
4. **Linting:** ESLint catches violations automatically

## 🐛 Troubleshooting

### Logger Not Found

```typescript
// Error: Cannot find module '@revealui/core/utils/logger'
```

**Solution:** Make sure package is built:
```bash
cd packages/core
pnpm build
```

### Type Errors

```typescript
// Error: 'logger' is not exported from '@revealui/core'
```

**Solution:** Use correct import path:
```typescript
// ✅ Correct
import { logger } from '@revealui/core/utils/logger'

// ❌ Wrong
import { logger } from '@revealui/core'
```

### Client vs Server

If you get `crypto is not defined` or similar browser errors:

```typescript
// In client code (React components)
import { logger } from '@revealui/core/utils/logger'

// In server code (API routes, server components)
import { logger } from '@revealui/core/server'
```

## 📚 Additional Resources

- [Logging Guide](./LOGGING.md) - Comprehensive logging documentation
- [Logger Implementation](../packages/core/src/observability/logger.ts) - Source code
- [ESLint no-console](https://eslint.org/docs/latest/rules/no-console) - Rule documentation

## ✨ Quick Wins

Start with these files for quick wins:

1. **Error Handlers:**
   - Replace `console.error` with `logger.error`
   - Easy to find and fix

2. **Debug Statements:**
   - Replace `console.log` with `logger.debug`
   - Can be disabled in production

3. **Warning Messages:**
   - Replace `console.warn` with `logger.warn`
   - Often few in number

4. **API Routes:**
   - High value, user-facing
   - Benefits most from structured logging

---

**Questions?** Check [LOGGING.md](./LOGGING.md) or ask in team chat.
