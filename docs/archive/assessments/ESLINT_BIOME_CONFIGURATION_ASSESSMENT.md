# Brutal Assessment: ESLint & Biome Configuration

**Assessment Date**: 2026-01-XX  
**Scope**: Complete codebase scan of ESLint and Biome configurations

> **Note**: This is a **historical assessment** documenting issues that have since been addressed. See [Linting Guide](../LINTING.md) for current setup.

---

## Executive Summary

**Overall Grade: C- (61/100)**

Your linting setup has a **fundamental identity crisis**. You're trying to use both ESLint and Biome in a complementary way, but you've created an inconsistent, confusing, and potentially conflicting configuration that will frustrate developers and lead to inconsistent code quality.

---

## Critical Issues (Must Fix Immediately)

### 1. **Inconsistent Linting Tool Usage Across Packages** ⚠️ CRITICAL

**Problem**: Your monorepo uses **two different linting tools** inconsistently:

**Packages using Biome for linting:**
- `packages/auth` → `biome lint .`
- `packages/ai` → `biome lint .`
- `packages/db` → `biome lint .`
- `packages/sync` → `biome lint .`
- `packages/config` → `biome lint .`

**Packages using ESLint for linting:**
- `apps/cms` → `eslint --cache --concurrency=4`
- `apps/web` → `eslint --cache --concurrency=2 --fix`
- `packages/dev` → `eslint src/ --cache`
- `packages/services` → `eslint . --cache --fix`

**Why This Is Bad:**
- Developers have to remember which tool each package uses
- CI/CD runs `pnpm lint` which calls different tools in different packages
- No consistent linting experience across the codebase
- New developers will be confused when they get different errors in different packages
- Some packages will catch issues Biome doesn't, others won't catch issues ESLint does

**Recommendation**: Pick ONE tool for linting across the entire monorepo. Either:
- Option A: Use Biome for everything (simpler, faster, single config)
- Option B: Use ESLint everywhere (better TypeScript type-aware rules, but more complex)

---

### 2. **Auto-Fix Conflicts Between ESLint and Biome** ⚠️ CRITICAL

**Problem**: ESLint commands with `--fix` flag can conflict with Biome's formatter:

```json
// apps/web/package.json
"lint": "eslint . --ignore-pattern dist --cache --concurrency=2 --fix"

// packages/services/package.json
"lint": "eslint . --cache --fix"
```

**Why This Is Bad:**
- ESLint's `--fix` will auto-format code according to ESLint's rules
- Biome formatter has different formatting rules (single quotes, no semicolons, etc.)
- Running ESLint with `--fix` then Biome format will create a ping-pong effect
- Different formatting rules in different parts of codebase

**Evidence of Conflict:**
- Your root `package.json` has: `"format": "biome format --write ."` and `"lint:fix": "biome check --write ."`
- But some packages run `eslint --fix` which will format differently
- Biome config says single quotes, but ESLint might format to double quotes if configured

**Recommendation**: 
- **Remove `--fix` from ALL ESLint commands**
- Use Biome for ALL formatting (`biome format --write .`)
- Use ESLint ONLY for type-aware checks that Biome can't do

---

### 3. **CI/CD Only Runs ESLint, Ignores Biome Linting** ⚠️ CRITICAL

**Problem**: Your GitHub Actions workflow only runs ESLint:

```yaml
# .github/workflows/ci.yml
- name: Run ESLint
  run: pnpm lint
```

But 5 packages use `biome lint .`, which means:
- Those packages' linting is **NOT RUN IN CI**
- Biome linting errors can be committed without CI catching them
- Only ESLint packages are protected by CI linting

**Recommendation**:
- Add `biome check` to CI workflow for ALL packages
- Or standardize on one tool and update CI accordingly

---

### 4. **Duplicate Rule Checking: `no-explicit-any`** ⚠️ MAJOR

**Problem**: Both Biome and ESLint check for `any` types:

**Biome** (`biome.json`):
```json
"suspicious": {
  "noExplicitAny": "error"
}
```

**ESLint** (`packages/dev/src/eslint/eslint.config.js`):
```javascript
'@typescript-eslint/no-explicit-any': 'error',
```

**Why This Is Bad:**
- Redundant checking (same rule, two tools)
- Wastes CPU cycles
- Confusing error messages (same error from two tools)
- Comment in ESLint config acknowledges this: "Note: no-explicit-any is also in Biome, but we keep it here for consistency"

**Recommendation**: 
- Remove `noExplicitAny` from Biome (let ESLint handle it, since it's type-aware)
- OR remove it from ESLint (let Biome handle it, simpler)

---

## Major Issues (Should Fix Soon)

### 5. **Inconsistent Ignore Patterns**

**Biome ignores** (`biome.json`):
- `**/scripts` (entire scripts directory)
- `**/*.min.js`, `**/*.bundle.js`

**ESLint ignores** (vary by package):
- `apps/cms`: `test-import.ts`, `test-revealui-framework.ts`, `+config.ts`, `next.config.mjs`
- `apps/web`: `**/public/**`, `next-env.d.ts`
- Shared: `node_modules/`, `dist/`, `.next/`, etc.

**Why This Is Bad:**
- Same files might be linted by one tool but not the other
- No clear mental model of what gets linted
- `scripts/` directory is excluded from Biome but might be linted by ESLint in some packages

**Recommendation**: Align ignore patterns between tools OR document why they differ

---

### 6. **Biome Config Excludes Scripts, But ESLint Might Check Them**

**Problem**: `biome.json` excludes `!**/scripts`, but ESLint configs don't explicitly exclude scripts directory in all packages.

**Impact**: Scripts might be formatted by Biome but not linted, while ESLint might try to lint them.

**Recommendation**: Add `**/scripts/**` to ESLint ignore patterns in shared config

---

### 7. **Type-Aware ESLint Rules Have Performance Impact**

**Problem**: Your ESLint config uses `project: true` for type-aware rules:

```javascript
parserOptions: {
  project: true, // Auto-detect tsconfig.json
  tsconfigRootDir: process.cwd(),
}
```

**Why This Can Be Bad:**
- Type-aware rules require TypeScript compilation
- Can be **very slow** on large codebases
- ESLint config comments acknowledge this but don't provide alternatives
- No caching strategy mentioned for type checking

**Evidence**: Your `apps/cms` uses `--concurrency=4` and `apps/web` uses `--concurrency=2`, suggesting you're already experiencing performance issues.

**Recommendation**: 
- Consider using `project: ['./tsconfig.json']` explicitly instead of `true`
- Document performance implications
- Consider disabling type-aware rules in CI if too slow

---

### 8. **Inconsistent ESLint Command Flags**

**Problem**: Different ESLint commands use different flags:

- `apps/cms`: `eslint --cache --concurrency=4` (no fix, no ignore pattern)
- `apps/web`: `eslint . --ignore-pattern dist --cache --concurrency=2 --fix` (has fix, has ignore)
- `packages/dev`: `eslint src/ --cache` (explicit src/ path)
- `packages/services`: `eslint . --cache --fix` (has fix)

**Why This Is Bad:**
- No standard way to run ESLint across packages
- Some have `--fix`, some don't (inconsistent)
- Different concurrency settings (why does web need less concurrency than cms?)
- Different ignore patterns handled differently

**Recommendation**: Standardize ESLint command format across all packages

---

### 9. **Biome Override Rules Are Under-Utilized**

**Problem**: Biome has override rules for config files and tests:

```json
{
  "includes": ["**/*.config.*", "**/eslint.config.*", "**/vite.config.*"],
  "linter": {
    "rules": {
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  }
}
```

But these might not be enough. Consider:
- Config files often need `any` types for Next.js/Vite configs
- Should test files have stricter or looser rules?
- Are all config file patterns covered?

**Recommendation**: Review override rules and ensure they match actual needs

---

## Minor Issues (Nice to Fix)

### 10. **Missing Biome Config for Some Style Rules**

Your Biome config has basic style rules but could be more comprehensive:
- Missing some performance rules
- Missing some security rules
- `useNamingConvention` is only a "warn" with `strictCase: false` (very lenient)

**Consider adding**:
```json
"performance": {
  "recommended": true
},
"security": {
  "recommended": true
}
```

---

### 11. **ESLint Config Has Unused Settings**

**Problem**: ESLint config has settings that might not be used:

```javascript
settings: {
  'import/resolver': {
    node: {
      paths: ['src'],
    },
  },
  tailwindcss: {
    config: '../tailwind/tailwind.config.js',
  },
}
```

But you might not have `eslint-plugin-import` or `eslint-plugin-tailwindcss` installed/configured.

**Recommendation**: Verify these plugins are installed and used, or remove unused settings

---

### 12. **No Pre-Commit Hooks for Formatting**

**Problem**: Developers can commit unformatted code.

**Recommendation**: Add husky pre-commit hook to run `biome format --write .` or `biome check --write .`

---

### 13. **Turbo.json Lint Task Has No Dependencies**

```json
"lint": {
  "cache": false,
  "persistent": true
}
```

**Recommendation**: Consider if lint should depend on `^build` or if cache should be enabled

---

## What's Actually Good (Don't Break This)

### ✅ Clear Separation of Concerns (Intention)

The ESLint config documentation clearly states:
- **Biome**: Formatting, style rules, correctness checks
- **ESLint**: Type-aware TypeScript rules

This is a **good strategy** - the problem is execution, not the idea.

### ✅ Type-Aware ESLint Rules

Using TypeScript ESLint with type-aware rules is excellent for catching real type safety issues that Biome can't catch.

### ✅ Shared ESLint Config

Having a shared ESLint config in `packages/dev/src/eslint/eslint.config.js` is good practice.

### ✅ Biome Formatter Configuration

Biome formatter config matches your project conventions (single quotes, no semicolons, 100 char line width).

---

## Recommendations Summary

### Immediate Actions (Do This Week)

1. **Standardize linting tool**: Pick ONE tool (Biome OR ESLint) for linting across ALL packages
2. **Remove `--fix` from ESLint commands**: Use Biome for ALL formatting
3. **Add Biome linting to CI**: Run `biome check` in CI for all packages
4. **Remove duplicate `no-explicit-any` rule**: Keep it in ONE tool only

### Short-Term Actions (This Month)

5. **Align ignore patterns**: Ensure Biome and ESLint ignore the same files
6. **Standardize ESLint commands**: Same flags across all packages
7. **Add pre-commit hooks**: Auto-format on commit
8. **Document the strategy**: Clear README explaining Biome vs ESLint usage

### Long-Term Considerations

9. **Performance optimization**: If type-aware ESLint is slow, consider caching or limiting scope
10. **Rule consolidation**: Review all rules and remove redundancies
11. **Developer experience**: Consider adding VS Code settings to auto-format on save

---

## Configuration Health Check

| Aspect | Status | Grade |
|--------|--------|-------|
| Consistency | ❌ Inconsistent tools across packages | F |
| No Conflicts | ⚠️ Auto-fix conflicts between tools | D |
| CI Coverage | ❌ Missing Biome linting in CI | F |
| Documentation | ✅ Good ESLint config comments | B+ |
| Performance | ⚠️ Type-aware rules may be slow | C |
| Developer Experience | ⚠️ Confusing which tool to use | D |

**Overall Grade: C- (61/100)**

---

## Conclusion

You have a **solid architectural intention** (Biome for formatting/style, ESLint for type-aware checks) but **poor execution**. The inconsistent tool usage, auto-fix conflicts, and incomplete CI coverage undermine the entire setup.

**The fix is straightforward but requires discipline:**
1. Standardize on one linting tool (or clearly separate concerns)
2. Remove auto-fix from ESLint
3. Complete CI coverage
4. Document the strategy

Once fixed, this could be an **A-grade configuration**. Right now, it's causing more problems than it solves.

---

**Next Steps**: Create a migration plan to standardize linting across the monorepo.
