# Environment File Migration Guide

## Quick Migration (5 minutes)

If you have an existing `.env` file with secrets, follow these steps:

### Step 1: Copy Template (if you don't have .env.development.local)

```bash
cp .env.template .env.development.local
```

### Step 2: Copy Your Secrets

Copy all your actual secret values from `.env` to `.env.development.local`:

```bash
# Option A: Manual copy-paste
# Open .env, copy the actual values
# Open .env.development.local, paste the values

# Option B: Use sed to copy non-comment lines (be careful!)
grep -v "^#" .env | grep -v "^$" >> .env.development.local
# Then edit .env.development.local to remove duplicates
```

### Step 3: Verify

```bash
# Check that required variables are set
pnpm validate:env

# Or manually check:
grep -E "^(REVEALUI_SECRET|POSTGRES_URL|STRIPE_SECRET_KEY|BLOB_READ_WRITE_TOKEN)=" .env.development.local
```

### Step 4: Test

```bash
# Start dev server - should work with .env.development.local
pnpm dev
```

### Step 5: Clean Up (Optional)

Once `.env.development.local` is working:

```bash
# Backup your old .env (just in case)
cp .env .env.backups/.env.old-$(date +%Y%m%d)

# Option A: Delete .env (recommended)
rm .env

# Option B: Keep .env but empty it (if you want to keep the file)
# > .env  # Empty the file
```

---

## Detailed Migration

### What Changed?

**Before:**
- `.env` file with secrets (gitignored)
- No template file
- Unclear file naming

**After:**
- `.env.template` - template with placeholders (committed)
- `.env.development.local` - your secrets (gitignored)
- `.envrc` - direnv config (optional, committed)
- Clear file hierarchy

### File Loading Order

The config loader now loads in this order:
1. `.env.development.local` (your secrets) ← **Use this**
2. `.env.local` (fallback)
3. `.env` (last resort, should be empty)

### Required Variables

Make sure these are in `.env.development.local`:

```bash
REVEALUI_SECRET=your-actual-secret-here
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
POSTGRES_URL=postgresql://user:password@host:port/database?sslmode=require
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## Troubleshooting

### "Missing required environment variables"

**Problem**: Config loader can't find your variables.

**Solution**:
1. Check that `.env.development.local` exists
2. Check that variables are set (no `#` comments on the line)
3. Run `pnpm validate:env` for detailed errors

### "direnv: error .envrc:1: dotenv: command not found"

**Problem**: Old `.envrc` with wrong function name.

**Solution**: Update `.envrc` - it should use `dotenv_if_exists`, not `dotenv`.

### Variables not loading

**Problem**: Config loader not finding your file.

**Solution**:
1. Verify file is named exactly `.env.development.local` (not `.env.development`)
2. Verify file is in project root (not in `apps/cms/` or subdirectory)
3. Check that config loader can find project root (looks for `.env.template`)

### Still using `.env` instead of `.env.development.local`

**Problem**: Config loader falling back to `.env`.

**Solution**:
1. Create `.env.development.local` (even if empty, it will be loaded first)
2. Or delete `.env` to force using `.env.development.local`

---

## Verification

After migration, verify everything works:

```bash
# 1. Validate environment variables
pnpm validate:env

# 2. Check that dev server starts
pnpm dev

# 3. Verify no secrets in committed files
git status
git diff .env.template  # Should only show placeholders

# 4. Verify .env.development.local is ignored
git check-ignore .env.development.local  # Should output the file path
```

---

## Need Help?

- See `docs/development/ENV_FILE_STRATEGY.md` for complete strategy
- See `docs/development/ENV_SETUP_BRUTAL_ASSESSMENT.md` for known issues
- Check `packages/config/src/schema.ts` for required variables
