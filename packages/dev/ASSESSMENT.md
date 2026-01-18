# Packages/Dev Assessment - What Should Be Moved/Centralized

> **⚠️ HISTORICAL DOCUMENT** - This assessment was written during the initial centralization work. Most recommendations have been implemented. See `FINAL_ASSESSMENT.md` for current status.

## Current State

### ✅ Already Centralized
- **ESLint config** - Shared config exported, used by apps/web, apps/cms, packages/services
- **Biome config** - Single root `biome.json` (good)
- **TypeScript configs** - Base configs available, some packages using them
- **Vite shared config** - Used by apps/web, apps/cms, packages/services

### ⚠️ Needs Centralization

#### 1. **PostCSS Configs** - HIGH PRIORITY
**Issue**: 3 identical PostCSS configs across apps/packages
- `apps/web/postcss.config.ts` - Identical to others
- `apps/cms/postcss.config.ts` - Identical to others  
- `packages/services/postcss.config.ts` - Identical to others
- `packages/dev/src/tailwind/postcss.config.ts` - More complete (has postcss-import, autoprefixer)

**Recommendation**: 
- Export PostCSS config from `packages/dev`
- Update apps/packages to use shared config
- The dev version is more complete and should be the standard

#### 2. **Tailwind Configs** - MEDIUM PRIORITY
**Issue**: Apps have their own Tailwind configs that duplicate shared config
- `apps/web/tailwind.config.ts` - Has app-specific content paths and safelist, but duplicates theme config
- `apps/cms/tailwind.config.ts` - Has app-specific content paths and safelist, but duplicates theme config
- `packages/dev/src/tailwind/tailwind.config.ts` - Shared base config

**Recommendation**:
- Create a helper function in dev package to merge shared config with app-specific overrides
- Apps should extend shared config and only override `content` and app-specific theme extensions
- Example:
  ```ts
  import { createTailwindConfig } from '@revealui/dev/tailwind'
  
  export default createTailwindConfig({
    content: ['./src/**/*.{ts,tsx}'],
    theme: {
      extend: {
        // App-specific extensions
      }
    }
  })
  ```

#### 3. **TypeScript Configs** - MEDIUM PRIORITY
**Issue**: Not all packages are using shared TypeScript configs

**Currently using shared configs**:
- ✅ `apps/web/tsconfig.json` - extends `dev/src/ts/reveal.json`
- ✅ `apps/cms/tsconfig.json` - extends `dev/src/ts/nextjs.json`
- ✅ `packages/revealui/tsconfig.json` - extends `dev/src/ts/base.json`
- ✅ `packages/services/tsconfig.json` - extends `dev/src/ts/reveal.json`

**Not using shared configs** (need to check):
- ⚠️ `packages/sync/tsconfig.json`
- ⚠️ `packages/db/tsconfig.json`
- ⚠️ `packages/auth/tsconfig.json`
- ⚠️ `packages/config/tsconfig.json`
- ⚠️ `packages/ai/tsconfig.json`
- ⚠️ `packages/schema/tsconfig.json`
- ⚠️ `packages/presentation/tsconfig.json`
- ⚠️ `packages/test/tsconfig.json`
- ⚠️ `apps/docs/tsconfig.json`
- ⚠️ Root `tsconfig.json`

**Recommendation**: Audit all TypeScript configs and migrate to shared configs where appropriate

#### 4. **Vitest Configs** - LOW PRIORITY
**Issue**: Test package has vitest configs that might benefit from shared patterns

**Current**:
- `packages/test/vitest.config.ts`
- `packages/test/vitest.integration.config.ts`

**Recommendation**: 
- Consider creating shared Vitest config patterns if multiple packages use Vitest
- Currently only test package uses it, so low priority

#### 5. **Playwright Config** - LOW PRIORITY
**Issue**: Test package has Playwright config

**Current**: `packages/test/playwright.config.ts`

**Recommendation**: 
- Only test package uses Playwright
- No need to centralize unless other packages start using it

## Recommendations Summary

### High Priority
1. **Centralize PostCSS configs** - All apps/packages should use shared PostCSS config from dev package

### Medium Priority
2. **Improve Tailwind config sharing** - Create helper to merge shared + app-specific configs
3. **Audit TypeScript configs** - Migrate remaining packages to use shared configs

### Low Priority
4. **Vitest config patterns** - Only if multiple packages start using Vitest
5. **Other tool configs** - As needed when patterns emerge

## Implementation Plan

### Phase 1: PostCSS Centralization
1. Export PostCSS config from `packages/dev/src/tailwind/postcss.config.ts`
2. Update `package.json` exports to include PostCSS
3. Update apps/web, apps/cms, packages/services to use shared config
4. Remove duplicate PostCSS configs

### Phase 2: Tailwind Config Improvement
1. Create `createTailwindConfig()` helper function
2. Update shared Tailwind config to be more composable
3. Migrate apps/web and apps/cms to use helper
4. Remove duplicated theme configs

### Phase 3: TypeScript Config Audit
1. Review all TypeScript configs
2. Identify which should extend shared configs
3. Create additional shared config variants if needed (e.g., `ts/library.json`)
4. Migrate packages one by one

## Files to Create/Modify

### New Files
- `packages/dev/src/tailwind/create-config.ts` - Helper for creating Tailwind configs
- `packages/dev/src/postcss/index.ts` - Export PostCSS config

### Files to Modify
- `packages/dev/package.json` - Add PostCSS export
- `apps/web/postcss.config.ts` - Use shared config
- `apps/cms/postcss.config.ts` - Use shared config
- `packages/services/postcss.config.ts` - Use shared config
- `apps/web/tailwind.config.ts` - Use helper function
- `apps/cms/tailwind.config.ts` - Use helper function

### Files to Review
- All `tsconfig.json` files in packages/apps
- Any other config files that might benefit from centralization
