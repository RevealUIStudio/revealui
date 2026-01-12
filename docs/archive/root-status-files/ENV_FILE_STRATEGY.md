# Environment File Strategy for Monorepo

**Date**: 2025-01-26  
**Status**: Recommendation

---

## Current Situation

You have environment files in multiple locations:
- ✅ Project root `.env` (working with config package)
- ⚠️ `apps/cms/.env.local` (25 lines)
- ⚠️ `apps/web/.env` and `apps/web/.env.example`

---

## Recommended Strategy: Project Root `.env` (Single Source of Truth)

### ✅ **Use Project Root `.env` for Shared Configuration**

**Why This Works**:
1. ✅ **Config package** loads from project root (already working ✅)
2. ✅ **Next.js** can load from parent directories (already working - saw `injecting env (15) from ../../.env` ✅)
3. ✅ **Single source of truth** - one file to manage
4. ✅ **Shared packages** can access same values
5. ✅ **Standard monorepo pattern** - common best practice

---

## How It Works

### Next.js Environment Variable Loading

Next.js loads environment variables in this order (highest priority first):

1. `process.env` (runtime environment)
2. `.env.local` (in app directory - **highest file priority**)
3. `.env.development` / `.env.production` (in app directory)
4. `.env` (in app directory)

**However**, Next.js also loads from **parent directories**:
- If `.env.local` exists in `apps/cms/`, it takes priority
- But if it doesn't exist, Next.js falls back to parent directories
- We've seen it work: `injecting env (15) from ../../.env` ✅

### Config Package Loading

The config package (`packages/config`) loads from **project root only**:
1. `.env.development.local` (if exists)
2. `.env.local` (if exists)
3. `.env` (fallback)

---

## Recommendation

### ✅ **Option 1: Project Root Only (Recommended)**

**Use project root `.env` for everything**:

1. ✅ Keep `.env` at project root (already working ✅)
2. ❌ Remove `apps/cms/.env.local` (if it has duplicate/conflicting values)
3. ✅ All apps and packages use the same values
4. ✅ Single source of truth

**When to use this**:
- All apps share the same configuration
- You want simple, centralized management
- Config package needs to access values (which it does)

### ⚠️ **Option 2: App-Specific Overrides (Only if Needed)**

**Use app-specific `.env.local` for app-specific overrides only**:

1. ✅ Keep `.env` at project root (base values)
2. ✅ Use `apps/cms/.env.local` for **CMS-specific overrides only**
3. ⚠️ Values in `.env.local` override project root `.env`

**When to use this**:
- Apps need different values (rare in monorepos)
- CMS needs different ports/URLs than web app
- App-specific secrets

---

## Best Practice Recommendation

### ✅ **Use Project Root `.env` Only**

**Reasons**:
1. ✅ **Config package requirement** - Config package loads from project root
2. ✅ **Already working** - Terminal shows Next.js is loading from `../../.env`
3. ✅ **Simpler** - One file to manage
4. ✅ **Shared packages** - All packages can access same values
5. ✅ **Standard pattern** - Common in monorepos

**Action**:
```bash
# 1. Check if apps/cms/.env.local has any unique values
# 2. If it has duplicates, remove it (project root .env is the source)
# 3. If it has unique CMS-specific values, merge them into project root .env
# 4. Then remove apps/cms/.env.local
```

---

## Priority Order (If Both Exist)

If both project root `.env` and `apps/cms/.env.local` exist:

### Next.js Priority (when Next.js loads):
1. `apps/cms/.env.local` (highest - app directory)
2. Project root `.env` (fallback)

### Config Package Priority (when config package loads):
1. Project root `.env.development.local`
2. Project root `.env.local`
3. Project root `.env`

**⚠️ Important**: Next.js uses app directory files first, config package uses project root only. This can cause **inconsistency** if values differ!

---

## Recommendation for Your Setup

### ✅ **Use Project Root `.env` Only**

**Steps**:
1. **Check `apps/cms/.env.local`** for any unique values
2. **Merge unique values** into project root `.env` (if any)
3. **Remove `apps/cms/.env.local`** (eliminate duplication)
4. **Keep project root `.env`** as single source of truth

**Why**:
- ✅ Config package already uses project root (working ✅)
- ✅ Next.js can load from project root (working ✅)
- ✅ Single source of truth
- ✅ No inconsistency between Next.js and config package

---

## Files to Manage

### ✅ Keep
- `/.env` - Project root (single source of truth)
- `/.env.template` - Template for documentation

### ❌ Remove (if using project root only)
- `apps/cms/.env.local` - If it has duplicates
- `apps/web/.env` - If it has duplicates

### ⚠️ Keep (if app-specific values needed)
- `apps/cms/.env.local` - Only if CMS needs different values
- `apps/web/.env` - Only if web app needs different values

---

## Summary

**Recommended**: **Use project root `.env` only**

**Why**:
1. ✅ Config package requires project root
2. ✅ Already working (both config package and Next.js load it)
3. ✅ Single source of truth
4. ✅ Standard monorepo pattern

**Action**: Remove `apps/cms/.env.local` if it doesn't have unique values, or merge unique values into project root `.env` first.

---

**Status**: ✅ **Recommendation: Project Root `.env` Only**
