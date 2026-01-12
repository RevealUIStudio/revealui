# Environment Variables Distribution Strategy

**Date**: 2025-01-26  
**Status**: Analysis and Recommendation

---

## Current Situation

You have environment variables in:
- ✅ Root `.env` file (with actual values)
- ⚠️ Root `.env.development.local` (with placeholder values)

**Problem**: The config validation is failing because `.env.development.local` has placeholders that override `.env` values.

---

## How Environment Variables Are Loaded

### 1. Config Package (`packages/config`)
- **Location**: Loads from **project root** (monorepo root)
- **Priority Order**:
  1. `.env.development.local` (highest priority)
  2. `.env.local`
  3. `.env` (lowest priority)
- **Code**: `packages/config/src/loader.ts:77-95`

### 2. Next.js (`apps/cms`)
- **Location**: Loads from **app directory** (`apps/cms/`)
- **Priority Order**:
  1. `.env.development.local`
  2. `.env.local`
  3. `.env.development`
  4. `.env`

**⚠️ Important**: Next.js does NOT automatically load from project root!

---

## Best Course of Action

### ✅ **Option 1: Use Root `.env` File (Recommended for Monorepo)**

**Strategy**: Keep values in root `.env`, remove placeholders from `.env.development.local`

**Why This Works**:
- ✅ Config package loads from root (uses `.env`)
- ✅ Next.js can load from root if configured (see below)
- ✅ Single source of truth for monorepo
- ✅ Easy to manage

**Steps**:

1. **Remove or rename `.env.development.local`**:
   ```bash
   # Option A: Remove it (config package will use .env)
   mv .env.development.local .env.development.local.backup
   
   # Option B: Keep it but clear placeholder values (let .env values win)
   # Just delete the placeholder lines
   ```

2. **Ensure root `.env` has all required values** (you already have this ✅)

3. **For Next.js to use root `.env`**, you have two options:

   **Option A**: Next.js automatically loads from root (in some setups)
   - Next.js 13+ may load from parent directories in development
   - Test this first!

   **Option B**: Create symlink from app to root (if needed):
   ```bash
   cd apps/cms
   ln -s ../../.env .env
   ```

---

### ✅ **Option 2: Copy Values to `.env.development.local` (Simplest)**

**Strategy**: Replace placeholder values in `.env.development.local` with actual values from `.env`

**Why This Works**:
- ✅ Both config package and Next.js will see the values
- ✅ `.env.development.local` has highest priority
- ✅ No configuration changes needed
- ✅ Works immediately

**Steps**:

1. **Copy actual values from `.env` to `.env.development.local`**:
   ```bash
   # Extract required variables from .env
   grep -E "^(REVEALUI_SECRET|REVEALUI_PUBLIC_SERVER_URL|NEXT_PUBLIC_SERVER_URL|BLOB_READ_WRITE_TOKEN|STRIPE_WEBHOOK_SECRET|NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY|STRIPE_SECRET_KEY|POSTGRES_URL)=" .env > /tmp/required-vars.txt
   
   # Update .env.development.local with actual values
   # (Manually replace placeholder values with values from .env)
   ```

2. **Or use a script to sync** (see script below)

---

### ✅ **Option 3: Single Source of Truth Script (Recommended for Teams)**

**Strategy**: Keep values in root `.env`, use a script to sync to `.env.development.local`

**Why This Works**:
- ✅ Single source of truth (root `.env`)
- ✅ Automatic sync ensures consistency
- ✅ Works for all environments

**Implementation**:

Create a script to sync env vars:
```bash
# scripts/sync-env.sh
#!/bin/bash
# Sync required env vars from root .env to .env.development.local

ROOT_ENV=".env"
DEV_LOCAL_ENV=".env.development.local"

# Variables to sync
REQUIRED_VARS=(
  "REVEALUI_SECRET"
  "REVEALUI_PUBLIC_SERVER_URL"
  "NEXT_PUBLIC_SERVER_URL"
  "BLOB_READ_WRITE_TOKEN"
  "STRIPE_WEBHOOK_SECRET"
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
  "STRIPE_SECRET_KEY"
  "POSTGRES_URL"
)

# Read values from root .env
for var in "${REQUIRED_VARS[@]}"; do
  value=$(grep "^${var}=" "$ROOT_ENV" | cut -d'=' -f2-)
  if [ -n "$value" ]; then
    # Update or add in .env.development.local
    if grep -q "^${var}=" "$DEV_LOCAL_ENV"; then
      sed -i "s|^${var}=.*|${var}=${value}|" "$DEV_LOCAL_ENV"
    else
      echo "${var}=${value}" >> "$DEV_LOCAL_ENV"
    fi
  fi
done

echo "✅ Synced env vars to .env.development.local"
```

---

## Recommended Approach for Your Situation

Since you already have values in root `.env`, I recommend:

### **Option 2 (Simplest) - Update `.env.development.local`**

1. **Quick Fix**: Copy actual values from `.env` to `.env.development.local`
2. **Why**: Works immediately, no script needed
3. **Long-term**: Consider Option 3 (sync script) for better maintainability

---

## Implementation Steps (Option 2)

1. **Extract values from `.env`**:
   ```bash
   cd /home/joshua-v-dev/projects/RevealUI
   grep -E "^(REVEALUI_SECRET|REVEALUI_PUBLIC_SERVER_URL|NEXT_PUBLIC_SERVER_URL|BLOB_READ_WRITE_TOKEN|STRIPE_WEBHOOK_SECRET|NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY|STRIPE_SECRET_KEY|POSTGRES_URL)=" .env
   ```

2. **Update `.env.development.local`**:
   - Replace placeholder values with actual values from `.env`
   - Keep the same variable names
   - Ensure no placeholders remain

3. **Restart server**:
   ```bash
   pnpm --filter cms dev
   ```

4. **Verify**:
   - Should NOT see `ConfigValidationError`
   - Server should start successfully

---

## Long-term Recommendation

For a monorepo, consider:

1. **Single source of truth**: Root `.env` file
2. **Sync script**: Automatically sync to app-specific env files if needed
3. **Documentation**: Document which env files are used where
4. **Git ignore**: Ensure all `.env*` files are ignored (already done ✅)

---

## Files to Update

- `.env.development.local` - Replace placeholder values with actual values
- (Optional) `scripts/sync-env.sh` - Create sync script for long-term

---

**Status**: Ready to implement - Choose Option 2 for immediate fix, Option 3 for long-term solution
