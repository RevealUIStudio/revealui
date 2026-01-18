# Centralization Plan for Packages/Dev

## Executive Summary

After thorough assessment, here are the items that should be moved/centralized into the `packages/dev` package:

### High Priority (Do First)
1. **PostCSS Config** - 3 duplicate configs should use shared one
2. **TypeScript Configs** - 8+ packages not using shared configs

### Medium Priority (Do Next)
3. **Tailwind Config Helper** - Create composable helper for app-specific configs

### Low Priority (Future)
4. **Vitest Config Patterns** - Only if multiple packages use Vitest

---

## Detailed Analysis

### 1. PostCSS Configs ⚠️ HIGH PRIORITY

**Current State:**
- `packages/dev/src/tailwind/postcss.config.ts` - Complete config (postcss-import, @tailwindcss/postcss, autoprefixer)
- `apps/web/postcss.config.ts` - Minimal (only @tailwindcss/postcss)
- `apps/cms/postcss.config.ts` - Minimal (only @tailwindcss/postcss)
- `packages/services/postcss.config.ts` - Minimal (only @tailwindcss/postcss)

**Action:**
- Export PostCSS config from dev package
- Update all apps/packages to use shared config
- Remove duplicate files

**Impact:** Reduces duplication, ensures consistency

---

### 2. TypeScript Configs ⚠️ HIGH PRIORITY

**Packages NOT using shared configs:**

| Package | Current Config | Should Use | Notes |
|---------|---------------|------------|-------|
| `packages/sync` | Extends root tsconfig | `dev/src/ts/react-library.json` | Has React JSX, should use react-library |
| `packages/db` | Standalone | `dev/src/ts/base.json` | Library package, should use base |
| `packages/auth` | Extends root tsconfig | `dev/src/ts/react-library.json` | Has React, should use react-library |
| `packages/config` | Unknown | `dev/src/ts/base.json` | Library package |
| `packages/ai` | Unknown | `dev/src/ts/base.json` | Library package |
| `packages/schema` | Unknown | `dev/src/ts/base.json` | Library package |
| `packages/presentation` | Unknown | `dev/src/ts/react-library.json` | Likely has React |
| `packages/test` | Standalone | `dev/src/ts/base.json` + test types | Test package, needs Playwright types |
| `apps/docs` | Standalone | `dev/src/ts/vite.json` | Vite app |

**Action:**
- Create `dev/src/ts/library.json` for simple library packages (db, config, ai, schema)
- Migrate packages to use appropriate shared configs
- Update root `tsconfig.json` to extend base if needed

**Impact:** Consistency, easier maintenance, better type checking

---

### 3. Tailwind Configs ⚠️ MEDIUM PRIORITY

**Current State:**
- `packages/dev/src/tailwind/tailwind.config.ts` - Base shared config
- `apps/web/tailwind.config.ts` - Duplicates theme, adds app-specific content/safelist
- `apps/cms/tailwind.config.ts` - Duplicates theme, adds app-specific content/safelist

**Problem:** Apps duplicate ~80% of shared config just to add `content` paths and safelist

**Solution:** Create composable helper function

```typescript
// packages/dev/src/tailwind/create-config.ts
export function createTailwindConfig(overrides: {
  content: string[]
  theme?: Config['theme']
  safelist?: string[]
}) {
  return {
    ...sharedBaseConfig,
    content: overrides.content,
    theme: merge(sharedBaseConfig.theme, overrides.theme),
    safelist: overrides.safelist,
  }
}
```

**Action:**
- Create `createTailwindConfig()` helper
- Export from dev package
- Update apps to use helper
- Remove duplicated theme configs

**Impact:** Reduces duplication, easier to maintain shared theme

---

### 4. Vitest Configs ⚠️ LOW PRIORITY

**Current State:**
- Only `packages/test` uses Vitest
- Has `vitest.config.ts` and `vitest.integration.config.ts`

**Action:** 
- No action needed unless other packages start using Vitest
- If multiple packages use Vitest, create shared base config

**Impact:** Low - only one package uses it

---

## Implementation Checklist

### Phase 1: PostCSS (High Priority)
- [ ] Export PostCSS config from `packages/dev/src/tailwind/postcss.config.ts`
- [ ] Add `./postcss` export to `packages/dev/package.json`
- [ ] Update `apps/web/postcss.config.ts` to use shared
- [ ] Update `apps/cms/postcss.config.ts` to use shared
- [ ] Update `packages/services/postcss.config.ts` to use shared
- [ ] Test all apps/packages still work

### Phase 2: TypeScript Configs (High Priority)
- [ ] Create `dev/src/ts/library.json` for simple libraries
- [ ] Migrate `packages/db/tsconfig.json`
- [ ] Migrate `packages/config/tsconfig.json`
- [ ] Migrate `packages/ai/tsconfig.json`
- [ ] Migrate `packages/schema/tsconfig.json`
- [ ] Migrate `packages/sync/tsconfig.json` to react-library
- [ ] Migrate `packages/auth/tsconfig.json` to react-library
- [ ] Migrate `packages/presentation/tsconfig.json` to react-library
- [ ] Migrate `packages/test/tsconfig.json` (add test types)
- [ ] Migrate `apps/docs/tsconfig.json` to vite
- [ ] Verify all packages typecheck correctly

### Phase 3: Tailwind Helper (Medium Priority)
- [ ] Create `packages/dev/src/tailwind/create-config.ts`
- [ ] Export from `packages/dev/src/tailwind/index.ts`
- [ ] Update `apps/web/tailwind.config.ts` to use helper
- [ ] Update `apps/cms/tailwind.config.ts` to use helper
- [ ] Remove duplicated theme configs
- [ ] Test apps still build correctly

---

## Files to Create

1. `packages/dev/src/tailwind/create-config.ts` - Tailwind config helper
2. `packages/dev/src/ts/library.json` - Simple library TypeScript config
3. `packages/dev/src/postcss/index.ts` - PostCSS config export

## Files to Modify

1. `packages/dev/package.json` - Add PostCSS export
2. `apps/web/postcss.config.ts` - Use shared
3. `apps/cms/postcss.config.ts` - Use shared
4. `packages/services/postcss.config.ts` - Use shared
5. `apps/web/tailwind.config.ts` - Use helper
6. `apps/cms/tailwind.config.ts` - Use helper
7. All TypeScript configs listed above

## Benefits

1. **Reduced Duplication** - Less code to maintain
2. **Consistency** - All packages use same base configs
3. **Easier Updates** - Update once, affects all packages
4. **Better Type Safety** - Consistent TypeScript settings
5. **Easier Onboarding** - Clear patterns for new packages

## Risks

1. **Breaking Changes** - Need to test all packages after migration
2. **App-Specific Needs** - Some packages may need custom configs
3. **Migration Effort** - Requires updating multiple files

## Recommendation

**Start with Phase 1 (PostCSS)** - Low risk, high reward, quick win
**Then Phase 2 (TypeScript)** - Higher impact, more testing needed
**Finally Phase 3 (Tailwind)** - Nice to have, reduces duplication
