# Setting Up Services for Testing

This guide helps you set up the required services to run all ElectricSQL sync tests.

## Issue: REVEALUI_SECRET Too Short

The CMS server requires `REVEALUI_SECRET` to be at least 32 characters.

**Current**: `dev-secret-change-in-production` (30 characters) ❌
**Required**: At least 32 characters ✅

## Quick Fix

### Option 1: Update .env File

Edit `.env` file and update `REVEALUI_SECRET`:

```bash
# Generate a 32+ character secret for development
REVEALUI_SECRET=dev-secret-for-testing-purposes-only-32chars
```

Or use a longer one:
```bash
REVEALUI_SECRET=dev-secret-change-in-production-to-32-characters-minimum
```

### Option 2: Use Environment Variable

```bash
export REVEALUI_SECRET=dev-secret-for-testing-purposes-only-32chars
pnpm --filter cms dev
```

## Complete Setup Steps

### 1. Fix REVEALUI_SECRET

```bash
# Check current length
grep REVEALUI_SECRET .env

# Update to 32+ characters
# Edit .env file or use:
export REVEALUI_SECRET=dev-secret-for-testing-purposes-only-32chars
```

### 2. Start CMS Server

```bash
# Terminal 1
pnpm --filter cms dev
```

Wait for: `✓ Ready in X.Xs` and `Local: http://localhost:4000`

### 3. Start ElectricSQL Service

```bash
# Terminal 2
pnpm electric:service:start
```

Wait for service to be ready, then verify:
```bash
curl http://localhost:5133/health
```

### 4. Run Tests

```bash
# Terminal 3
./packages/sync/scripts/run-all-tests.sh
```

Or manually:
```bash
export REVEALUI_TEST_SERVER_URL=http://localhost:4000
export ELECTRIC_SERVICE_URL=http://localhost:5133
pnpm --filter @revealui/sync test
```

## Verification

### Check CMS Server
```bash
curl http://localhost:4000/api/conversations
# Should return JSON (may be empty array or error, but endpoint should exist)
```

### Check ElectricSQL Service
```bash
curl http://localhost:5133/health
# Should return 200 OK
```

## Troubleshooting

### REVEALUI_SECRET Error
- **Error**: `Secret must be at least 32 characters`
- **Fix**: Update `.env` with 32+ character secret
- **Quick fix**: `export REVEALUI_SECRET=dev-secret-for-testing-purposes-only-32chars`

### Port Already in Use
- **Error**: `Port 4000 is already in use`
- **Fix**: Kill process using port or change port in next.config.mjs

### ElectricSQL Service Not Starting
- **Error**: Docker container fails to start
- **Fix**: Check Docker is running, check PostgreSQL connection, check ports

### ElectricSQL WAL Level Error ⚠️ COMMON ISSUE
- **Error**: `Electric requires wal_level >= logical`
- **Fix**: Configure PostgreSQL with `wal_level = logical`
- **See**: [ELECTRICSQL_SETUP_ISSUES.md](./ELECTRICSQL_SETUP_ISSUES.md) for detailed fix
- **Quick check**: `psql $POSTGRES_URL -c "SHOW wal_level;"` (should return "logical")

### Database Connection Issues
- **Error**: Cannot connect to PostgreSQL
- **Fix**: Verify `POSTGRES_URL` or `DATABASE_URL` in `.env` is correct
- **Fix**: Ensure PostgreSQL has logical replication enabled (wal_level = logical)

## Environment Variables Checklist

Required for CMS:
- ✅ `REVEALUI_SECRET` (32+ characters)
- ✅ `POSTGRES_URL` or `DATABASE_URL`
- Optional: `NEXT_PUBLIC_SERVER_URL`, `REVEALUI_PUBLIC_SERVER_URL`

Required for ElectricSQL:
- ✅ `POSTGRES_URL` or `DATABASE_URL` (same as CMS)
- Optional: `ELECTRIC_SERVICE_PORT` (default: 5133)

Required for Tests:
- `REVEALUI_TEST_SERVER_URL` (defaults to http://localhost:4000)
- `ELECTRIC_SERVICE_URL` (defaults to http://localhost:5133)
