# Packages/Dev Improvements

## Issues Found & Recommendations

### 1. **File Extension Inconsistencies** ⚠️ HIGH PRIORITY

**Issue**: Package.json exports reference `.js` files but some are `.ts` files, and imports don't match.

**Files Affected**:
- `package.json` exports reference `tailwind.config.js` but file is `tailwind.config.ts`
- `tailwind/index.ts` imports from `tailwind.config.js` but should import from `.ts`

**Fix**: 
- Update `package.json` exports to use correct extensions
- Fix import in `tailwind/index.ts` to use `.ts` extension (or no extension for ESM)

### 2. **Missing Main Entry Point** ⚠️ MEDIUM PRIORITY

**Issue**: `package.json` has `"main": "./src/index.ts"` but this file doesn't exist.

**Options**:
- Create `src/index.ts` that re-exports all configs
- Remove `main` field if not needed
- Update to point to a specific config if that's the primary export

### 3. **TypeScript Config Organization** 📝 MEDIUM PRIORITY

**Issues**:
- Missing documentation/comments in TypeScript config files
- `base.json` has hardcoded references that might not work in all contexts
- No clear indication of which config to use for what purpose

**Recommendations**:
- Add JSDoc comments explaining each config
- Create a README in `ts/` directory
- Consider adding a `ts/index.ts` that exports config paths

### 4. **Vite Config Type Safety** 🔧 LOW PRIORITY

**Issue**: `vite.shared.ts` uses plain object instead of `defineConfig()` for better type safety.

**Recommendation**: Use `defineConfig()` from Vite for better IntelliSense and type checking.

### 5. **Biome Config Enhancements** ✨ LOW PRIORITY

**Suggestions**:
- Add React-specific rules (already has a11y, but could add more)
- Consider adding more complexity rules
- Add rules for Next.js patterns if applicable

### 6. **ESLint Config React Rules** 🔧 LOW PRIORITY

**Issue**: Missing some React-specific rules that could complement Biome.

**Suggestions**:
- Add React hooks rules
- Add React performance rules
- Consider adding rules for React 19 patterns

### 7. **PostCSS Config** 🔧 LOW PRIORITY

**Issue**: Uses `postcss-load-config` type but might not be necessary.

**Recommendation**: Use standard PostCSS config format or verify if the type is needed.

### 8. **Documentation** 📚 MEDIUM PRIORITY

**Missing**:
- Main README for `packages/dev` explaining all configs
- Usage examples for each config
- Migration guide if configs change

### 9. **Export Consistency** ⚠️ HIGH PRIORITY

**Issue**: Some configs export as `.js` in package.json but are `.ts` files. In ESM, this can work but is confusing.

**Recommendation**: 
- Use consistent extension strategy
- Document the ESM `.js` extension convention (TypeScript compiles to JS)
- Or use `.ts` extensions consistently

### 10. **Tailwind Config Duplication** 🔧 LOW PRIORITY

**Issue**: `tailwind/index.ts` just re-exports the config without adding value.

**Options**:
- Remove `tailwind/index.ts` and export directly from `tailwind.config.ts`
- Or add utility functions/helpers if needed
- Update package.json to export directly from config file

## Priority Order

1. **Fix file extension inconsistencies** (High - breaks imports)
2. **Fix missing main entry or remove it** (Medium - confusing)
3. **Add comprehensive documentation** (Medium - helps developers)
4. **Improve TypeScript config organization** (Medium - maintainability)
5. **Enhance type safety** (Low - nice to have)
6. **Add React-specific rules** (Low - incremental improvement)
