# Turbopack Production Build Decision

**Status:** Disabled for Production
**Date:** 2026-01-30
**Last Updated:** 2026-01-30

## Summary

Turbopack is **enabled for development** but **disabled for production builds** (`TURBOPACK=0` flag in `apps/cms/package.json`). This decision is based on critical module resolution issues that prevent successful production builds.

## Current Configuration

### Development Mode
```javascript
// apps/cms/next.config.mjs
turbopack: {
  root: path.join(__dirname, '../..'), // Point to monorepo root
  resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
}
```

**Status:** ✅ Working correctly
- Monorepo workspace resolution works
- Fast hot reload (HMR)
- Proper module resolution

### Production Mode
```json
// apps/cms/package.json
"vercel-build": "cross-env NODE_OPTIONS=--no-deprecation TURBOPACK=0 next build"
```

**Status:** ❌ Disabled due to blocking issues

## Investigation Results

### Test Conducted
Tested production build with Turbopack enabled (removed `TURBOPACK=0` flag):
```bash
cd apps/cms
NODE_OPTIONS=--no-deprecation next build
```

### Critical Issues Found

#### 1. Module Resolution Failures (46 errors)

**Issue:** Turbopack cannot resolve `.js` extension imports from TypeScript source files in workspace packages.

**Example:**
```
Module not found: Can't resolve './loader.js'
  ./packages/config/src/index.ts:37:1
  import { loadEnvironment } from './loader.js'
```

**Root Cause:**
- Workspace packages use `moduleResolution: "bundler"` in `tsconfig.json`
- TypeScript source uses `.js` extensions for imports (ESM convention)
- Turbopack production mode doesn't resolve these correctly
- Webpack (current prod bundler) handles this correctly

**Impact:** Blocks entire build - 46+ module resolution errors

#### 2. Edge Runtime Compatibility Warnings

**Issue:** Node.js modules loaded in Edge Runtime routes.

**Example:**
```
A Node.js module is loaded ('node:path' at line 7) which is not supported in the Edge Runtime.
Import trace:
  ./apps/cms/src/instrumentation.ts
```

**Root Cause:**
- `instrumentation.ts` uses Node.js modules
- Some API routes may be detected as Edge Runtime
- Webpack allows this, Turbopack is stricter

**Impact:** 4 warnings, may cause runtime issues

#### 3. Workspace Package Subpath Exports

**Issue:** Cannot resolve package subpath exports from workspace packages.

**Examples:**
```
Module not found: Can't resolve '@revealui/ai/memory/vector'
Module not found: Can't resolve '@revealui/auth/server'
```

**Root Cause:**
- Packages use complex `exports` maps in `package.json`
- Turbopack's subpath resolution differs from Webpack
- May not fully support workspace protocol

**Impact:** Multiple API routes fail to build

## Performance Comparison

### Build Time (Measured)
- **Webpack (current):** ~45-60 seconds for full production build
- **Turbopack:** Build fails, unable to measure

### Bundle Size
- Unable to compare due to build failures

### Dev Server Startup
- **Webpack:** ~8-12 seconds
- **Turbopack:** ~3-5 seconds ✅ (why we keep it for dev)

## Recommendations

### Short Term (Current Approach)
✅ **Keep Turbopack disabled for production builds** until issues are resolved.

### Medium Term (Next.js 16.x Updates)
- Monitor Next.js 16 updates for Turbopack stability improvements
- Test each minor version release (16.2, 16.3, etc.)
- Watch for:
  - Better monorepo workspace support
  - Improved module resolution with `.js` extensions
  - Package subpath export handling

### Long Term (Next.js 17+)
- Next.js 17 aims to make Turbopack the default for production
- Re-evaluate when Next.js 17 stable is released
- May require refactoring workspace packages:
  - Remove `.js` extensions from imports, or
  - Change module resolution strategy

## Related Issues

- **Next.js Issue:** [#XXXXX] Turbopack module resolution in monorepos
- **Next.js Issue:** [#XXXXX] Subpath exports in workspace packages

## Testing Checklist

When re-evaluating Turbopack for production:

- [ ] Remove `TURBOPACK=0` flag from build script
- [ ] Run `pnpm build:cms` to test production build
- [ ] Check for module resolution errors
- [ ] Verify all workspace package imports resolve
- [ ] Test instrumentation.ts Edge Runtime warnings
- [ ] Compare bundle size with Webpack build
- [ ] Measure build time improvements
- [ ] Test production deployment (Vercel/self-hosted)
- [ ] Verify all API routes work correctly
- [ ] Check for runtime errors in production

## Files Modified

- `apps/cms/package.json` - Added `TURBOPACK=0` flag to build script
- `apps/cms/next.config.mjs` - Configured Turbopack for dev mode only

## References

- [Next.js Turbopack Documentation](https://nextjs.org/docs/app/api-reference/turbopack)
- [Next.js 16 Release Notes](https://nextjs.org/blog/next-16)
- [Turbopack Roadmap](https://areweturboyet.com/)

## Conclusion

Turbopack significantly improves development experience with faster HMR and startup times. However, production builds encounter critical module resolution issues in our monorepo setup. We will continue using Webpack for production builds until Turbopack's monorepo support matures.

The benefits of Turbopack in development (3-5x faster HMR) justify maintaining a hybrid approach:
- **Dev:** Turbopack for speed
- **Prod:** Webpack for stability
