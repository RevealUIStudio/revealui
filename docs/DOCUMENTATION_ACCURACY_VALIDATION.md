# Documentation Accuracy Validation Guide

**Last Updated**: 2026-01-27  
**Status**: ✅ **Active**  
**Purpose**: Ensure documentation accuracy and keep docs in sync with codebase

---

## Overview

Documentation accuracy validation ensures that documentation stays in sync with the actual codebase. This prevents outdated examples, broken links, and incorrect references that confuse developers and AI agents.

### Goals

1. **Code Example Validation** - Verify code snippets are syntactically valid
2. **Link Validation** - Ensure all internal/external links work
3. **Package Validation** - Verify package references are correct
4. **Command Validation** - Check commands match package.json scripts
5. **Path Validation** - Verify file paths referenced exist
6. **Version Validation** - Check version numbers are current
7. **Config Validation** - Validate configuration examples

---

## Validation Methods

### 1. Automated Scripts ✅

#### `scripts/docs/validate-documentation-accuracy.ts`

**Purpose**: Comprehensive accuracy validation across all markdown files

**Usage**:
```bash
pnpm docs:validate:accuracy
```

**Checks**:
- ✅ Code block syntax (ESM vs CommonJS, deprecated patterns)
- ✅ Import paths (package references)
- ✅ File paths (existence validation)
- ✅ Commands (tool validation: pnpm vs npm/yarn)
- ✅ Internal links (file existence)
- ✅ Package references (valid package names)
- ✅ Deprecated patterns (require vs import, old package names)

**Output**: `docs/reports/accuracy-report.md`

**Exit Code**: 1 if errors found, 0 if warnings only

---

#### `scripts/docs/verify-docs.ts` (Existing)

**Purpose**: Unified verification across multiple dimensions

**Usage**:
```bash
pnpm docs:verify --all
pnpm docs:verify --links
pnpm docs:verify --versions
pnpm docs:verify --commands
pnpm docs:verify --paths
pnpm docs:verify --code-examples
```

**Features**:
- Link verification (internal, external, anchors)
- Version verification (package versions)
- Command verification (package.json scripts)
- Path verification (file paths)
- Code example validation
- Consolidation verification

---

### 2. Static Analysis ✅

#### Pattern Detection

**Code Patterns**:
```typescript
// Detects deprecated patterns
- require() instead of import
- module.exports instead of export
- @revealui/cms instead of @revealui/core
- npx instead of pnpm dlx
- npm/yarn instead of pnpm
```

**File Patterns**:
```markdown
// Validates file references
- ./path/to/file.ts
- ../relative/path.ts
- Absolute paths
```

**Link Patterns**:
```markdown
// Validates link targets
- [Text](./path/to/doc.md)
- [Text](../relative/doc.md)
- External links (http/https)
```

---

### 3. Runtime Validation ⏭️

#### Command Execution Testing

**Planned**: Test commands in documentation actually work

```typescript
// Future: Execute and verify commands
await execCommand('pnpm build')
await verifyOutput(expected)
```

**Use Cases**:
- Verify package.json scripts exist
- Test commands produce expected output
- Validate environment setup steps

---

### 4. Integration Validation ✅

#### Package Dependency Validation

**Check**: Package references in docs match actual packages

```typescript
// Validates packages exist
const validPackages = await getPackageList()
for (const ref in docReferences) {
  if (!validPackages.includes(ref)) {
    reportError('Package not found: ' + ref)
  }
}
```

---

## Validation Categories

### 1. Code Accuracy ✅

#### Syntax Validation

**Checks**:
- TypeScript/JavaScript syntax in code blocks
- ESM vs CommonJS consistency
- No mixed syntax patterns

**Examples**:
```typescript
// ❌ Bad: Mixed syntax
export const foo = 'bar'
module.exports = { foo }  // Error!

// ✅ Good: Consistent ESM
export const foo = 'bar'
export default foo
```

#### Pattern Validation

**Checks**:
- No deprecated patterns (require, module.exports)
- Correct package names (@revealui/core, not @revealui/cms)
- Tool consistency (pnpm, not npm/yarn)

---

### 2. Link Accuracy ✅

#### Internal Links

**Validation**:
- File exists at target path
- Anchors exist in target file
- Relative paths resolve correctly

**Examples**:
```markdown
<!-- ❌ Bad: Broken link -->
[Guide](./non-existent-guide.md)

<!-- ✅ Good: Valid link -->
[Guide](./guides/QUICK_START.md)
```

#### External Links

**Validation**:
- URL format is valid
- Domain is reachable (optional, can be slow)

---

### 3. Package Accuracy ✅

#### Package References

**Checks**:
- Package name exists in packages/
- Import path is valid
- Workspace protocol usage is correct

**Examples**:
```typescript
// ❌ Bad: Package doesn't exist
import { foo } from '@revealui/nonexistent'

// ✅ Good: Valid package
import { foo } from '@revealui/core'
import { bar } from 'dev/eslint'
```

---

### 4. Command Accuracy ✅

#### Tool Validation

**Checks**:
- Uses pnpm (not npm/yarn)
- Uses pnpm dlx (not npx, except for only-allow)
- Commands match package.json scripts

**Examples**:
```bash
# ❌ Bad: Wrong tool
npm install
yarn build

# ✅ Good: Correct tool
pnpm install
pnpm build
```

#### Script Validation

**Checks**:
- Referenced scripts exist in package.json
- Command syntax is correct

---

### 5. Path Accuracy ✅

#### File Path Validation

**Checks**:
- File exists at referenced path
- Path is relative to correct base
- Extension is correct (.ts, .tsx, .md)

**Examples**:
```markdown
<!-- ❌ Bad: File doesn't exist -->
See [config](./packages/dev/nonexistent.config.ts)

<!-- ✅ Good: File exists -->
See [config](./packages/dev/eslint/eslint.config.js)
```

---

### 6. Version Accuracy ⏭️

#### Version Number Validation

**Planned**: Check version numbers match current versions

```markdown
<!-- ❌ Bad: Outdated version -->
Node.js 18.20.2+

<!-- ✅ Good: Current version -->
Node.js 24.12.0+
```

---

### 7. Configuration Accuracy ⏭️

#### Config Example Validation

**Planned**: Validate configuration examples match actual configs

```json
// Check examples match actual config structure
{
  "validation": {
    "checkPackageNames": true
  }
}
```

---

## Usage

### Run All Checks

```bash
# Comprehensive accuracy validation
pnpm docs:validate:accuracy

# Existing verification (multiple dimensions)
pnpm docs:verify --all
```

### Run Specific Checks

```bash
# Check links only
pnpm docs:verify --links

# Check versions
pnpm docs:verify --versions

# Check commands
pnpm docs:verify --commands

# Check paths
pnpm docs:verify --paths

# Check code examples
pnpm docs:verify --code-examples
```

### Integration with Lifecycle

```bash
# Weekly checks (includes accuracy)
pnpm docs:lifecycle:weekly

# Manual accuracy check
pnpm docs:validate:accuracy
```

---

## Reports

### Accuracy Report

**Location**: `docs/reports/accuracy-report.md`

**Contents**:
- Summary (errors, warnings, info)
- Issues grouped by severity
- Issues grouped by category
- File-by-file breakdown
- Suggestions for fixes

**Format**:
```markdown
# Documentation Accuracy Report

## Summary
- 🔴 Errors: 5
- 🟡 Warnings: 12
- 🔵 Info: 3

## 🔴 Errors
### docs/guides/QUICK_START.md
- **PACKAGE** Package not found: @revealui/cms
  - Suggestion: Replace with @revealui/core

## 🟡 Warnings
...
```

---

## CI/CD Integration

### Pre-commit Hook (Recommended)

**File**: `.husky/pre-commit-docs-accuracy`

**Action**: Run accuracy checks before commit

**Script**:
```bash
#!/usr/bin/env bash
pnpm docs:validate:accuracy
```

**Behavior**: 
- Warn on warnings
- Fail on errors
- Allow bypass with `--no-verify`

---

### CI Workflow (Recommended)

**File**: `.github/workflows/docs-accuracy.yml`

**Schedule**: Weekly or on PR

**Steps**:
1. Checkout code
2. Install dependencies
3. Run accuracy validation
4. Upload report as artifact
5. Fail if errors found

**Example**:
```yaml
name: Documentation Accuracy
on:
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday
  pull_request:
    paths:
      - 'docs/**'
      - '*.md'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm docs:validate:accuracy
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: accuracy-report
          path: docs/reports/accuracy-report.md
```

---

## Best Practices

### When Writing Documentation

1. **Use Real Examples**
   - Copy from actual working code
   - Test examples before documenting
   - Use current package names

2. **Reference Existing Files**
   - Use actual file paths
   - Verify paths exist
   - Use relative paths consistently

3. **Match Tool Usage**
   - Use `pnpm` (not npm/yarn)
   - Use `pnpm dlx` (not npx)
   - Reference actual package.json scripts

4. **Keep Examples Current**
   - Use current APIs
   - Reference current versions
   - Update when code changes

### When Updating Code

1. **Update Related Docs**
   - Update examples when APIs change
   - Update package references when packages change
   - Update commands when scripts change

2. **Run Validation**
   - Run accuracy checks after changes
   - Fix reported issues
   - Verify links still work

---

## Common Issues and Fixes

### Issue: "Package not found: @revealui/cms"

**Cause**: Deprecated package name in documentation

**Fix**: Replace `@revealui/cms` with `@revealui/core`

---

### Issue: "Using 'npm' instead of 'pnpm'"

**Cause**: Wrong package manager in examples

**Fix**: Replace `npm` with `pnpm` in all examples

---

### Issue: "Broken internal link"

**Cause**: File moved or deleted, link not updated

**Fix**: Update link to point to correct file

---

### Issue: "Mixed ESM and CommonJS syntax"

**Cause**: Code example uses both export styles

**Fix**: Use consistent ESM (`export`) throughout

---

### Issue: "File path may not exist"

**Cause**: Path in documentation is incorrect

**Fix**: Verify path and update if needed

---

## Metrics and Goals

### Current Targets

- **Errors**: 0 (must fix immediately)
- **Warnings**: < 10 (address within sprint)
- **Link Accuracy**: 100% (all links valid)
- **Package Accuracy**: 100% (all packages exist)
- **Command Accuracy**: 100% (all commands valid)

---

## Integration with Lifecycle Management

### Weekly Checks

**Automated**:
1. Stale documentation detection
2. Assessment file management
3. Accuracy validation (planned)

### Monthly Checks

**Automated**:
1. Duplicate detection
2. Comprehensive accuracy validation
3. Link validation

### Quarterly Checks

**Automated**:
1. Archive review
2. Full documentation audit
3. Accuracy baseline update

---

## Future Enhancements

### 1. AI-Powered Content Validation ⏭️

**Planned**: Use AI to detect:
- Outdated information
- Contradictory statements
- Missing information
- Suggestions for improvements

---

### 2. Code Execution Testing ⏭️

**Planned**: Actually execute code examples

**Features**:
- Run TypeScript code blocks
- Verify commands produce expected output
- Test configuration examples

---

### 3. Semantic Validation ⏭️

**Planned**: Validate meaning, not just syntax

**Features**:
- API usage matches actual APIs
- Configuration examples are valid
- Workflow descriptions match actual workflows

---

## Conclusion

Documentation accuracy validation ensures documentation stays accurate and useful. Automated checks catch issues early, preventing confusion and reducing maintenance burden.

**Next Steps**:
1. Run `pnpm docs:validate:accuracy` regularly
2. Fix reported issues
3. Integrate into CI/CD for automated checks
4. Use as part of PR review process

---

**Last Updated**: 2026-01-27  
**Status**: ✅ Script Created | ⏭️ CI/CD Integration Next