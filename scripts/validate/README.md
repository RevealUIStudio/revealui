# Documentation Validation System

Automated validation to prevent documentation drift and ensure accuracy.

## Overview

The documentation validation system automatically checks all documentation files against actual source code, package.json, node_modules, and the file system to catch:

- Broken internal links
- References to non-existent scripts
- References to non-existent directories
- Deprecated package names
- Outdated version numbers
- Incorrect file paths
- False technical claims

## Usage

### Local Development

```bash
# Run full validation (human-readable output)
pnpm validate:docs

# Get JSON output for parsing
pnpm validate:docs:json

# Run without failing build (useful for testing)
pnpm validate:docs --exit-zero
```

### CI/CD Integration

The validation runs automatically on:
- Pull requests that modify documentation
- Pushes to main/master branch
- Manual workflow triggers

**Critical issues will fail the build.**

## What Gets Validated

### 1. Package.json Script References

Detects references to non-existent pnpm scripts in documentation:

```markdown
# ❌ Will fail validation
Run `pnpm start:cms` to start the app

# ✅ Correct
Run `pnpm dev` to start the app
```

**Severity:** Critical

### 2. Internal Links

Validates all markdown links to local files:

```markdown
# ❌ Will fail validation
See [Setup Guide](./guides/QUICK_START.md)

# ✅ Correct (if file exists)
See [Setup Guide](./onboarding/QUICK_START.md)
```

**Severity:** High

### 3. Directory References

Detects references to non-existent directories:

```markdown
# ❌ Will fail validation
Files are in `docs/development/`

# ✅ Correct
Files are in `docs/infrastructure/`
```

**Severity:** High

### 4. Deprecated Package Names

Catches outdated package references:

```markdown
# ❌ Will fail validation
import { schema } from '@revealui/schema'

# ✅ Correct
import { schema } from '@revealui/contracts'
```

**Severity:** High

### 5. Version Mismatches

Validates package versions against node_modules:

```markdown
# ❌ Will fail validation (if actual version is 0.2.5)
Using @stripe/mcp@0.1.4

# ✅ Correct
Using @stripe/mcp@0.2.5
```

**Severity:** Medium

### 6. False Technical Claims

Detects known false claims:

```markdown
# ❌ Will fail validation
ElectricSQL uses SQLite via IndexedDB

# ✅ Correct
ElectricSQL uses browser cache via HTTP sync
```

**Severity:** Medium

### 7. File Naming Consistency

Checks for inconsistent file naming (hyphens vs underscores):

```markdown
# ⚠️  Warning
QUICK-START.md (uses hyphens)

# ✅ Standard
QUICK_START.md (uses underscores)
```

**Severity:** Low

## Validation Results

### Severity Levels

- **🔴 Critical:** Must fix before release (fails CI build)
- **🟠 High:** Should fix soon (doesn't fail build)
- **🟡 Medium:** Consider fixing (improvement)
- **⚪ Low:** Nice to fix (cosmetic)
- **ℹ️ Info:** For awareness only

### Accuracy Score

Calculated based on weighted issues:
- Critical issues: 10 points each
- High issues: 5 points each
- Medium issues: 2 points each
- Low issues: 1 point each

**Score = 100 - (total weight / max penalty) × 100**

### Categories

- `broken-link` - Internal markdown links to non-existent files
- `nonexistent-script` - References to pnpm scripts that don't exist
- `nonexistent-directory` - References to directories that don't exist
- `outdated-package` - References to renamed/removed packages
- `incorrect-path` - Wrong file system paths
- `deprecated-reference` - Deprecated API/package references
- `version-mismatch` - Package versions don't match node_modules
- `naming-inconsistency` - File naming doesn't follow standards
- `false-claim` - Technically incorrect statements

## Output Examples

### Human-Readable Output

```
📊 Validation Summary

Files validated: 105
Issues found: 487
Accuracy score: 12.5%

Issues by severity:
  🔴 Critical: 85
  🟠 High: 396
  🟡 Medium: 6
  ⚪ Low: 0

Issues by category:
  broken-link: 376
  nonexistent-script: 85
  version-mismatch: 6
  ...

🔍 Top 20 Issues:

🔴 docs/onboarding/QUICK_START.md:94
   Script 'start:cms' does not exist in package.json
   Current: pnpm start:cms
   Suggested: Check package.json for correct script name

🟠 docs/INDEX.md:35
   Broken link: ./AGENT_QUICK_START.md

...
```

### JSON Output

```json
{
  "success": true,
  "data": {
    "total_files": 105,
    "total_issues": 487,
    "by_severity": {
      "critical": 85,
      "high": 396,
      "medium": 6,
      "low": 0,
      "info": 0
    },
    "by_category": {
      "broken-link": 376,
      "nonexistent-script": 85,
      "version-mismatch": 6
    },
    "issues": [
      {
        "file": "docs/onboarding/QUICK_START.md",
        "line": 94,
        "severity": "critical",
        "category": "nonexistent-script",
        "message": "Script 'start:cms' does not exist in package.json",
        "actual": "pnpm start:cms",
        "expected": "Check package.json for correct script name"
      }
    ],
    "accuracy_score": 12.5
  }
}
```

## Configuration

### Patterns Checked

Defined in `scripts/validate/validate-docs-comprehensive.ts`:

```typescript
const DEPRECATED_PATTERNS = [
  {
    pattern: /@revealui\/schema\b/g,
    category: 'deprecated-reference',
    message: 'Package @revealui/schema was renamed to @revealui/contracts',
    suggested_fix: '@revealui/contracts',
  },
  // ... more patterns
]
```

### Known Non-Existent Directories

```typescript
const NONEXISTENT_DIRECTORIES = [
  'docs/assessments/',
  'docs/implementation/',
  'docs/development/',
  // ... more directories
]
```

## Extending Validation

### Adding New Patterns

Edit `DEPRECATED_PATTERNS` in `validate-docs-comprehensive.ts`:

```typescript
{
  pattern: /your-pattern/g,  // Must have global flag for matchAll
  category: 'category-name',
  message: 'Description of the issue',
  suggested_fix: 'Suggested replacement',
}
```

### Adding New Validation Types

Implement a new validation function following this pattern:

```typescript
async function validateYourCheck(
  content: string,
  filePath: string
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []

  // Your validation logic here

  return issues
}
```

Then call it in `validateFile()`:

```typescript
issues.push(...(await validateYourCheck(content, filePath)))
```

## GitHub Actions Integration

The workflow (`.github/workflows/validate-docs.yml`):

1. Runs on documentation changes
2. Generates validation report
3. Uploads results as artifact
4. Comments on PR with critical issues
5. Fails build if critical issues found

### Workflow Artifacts

Download full validation results from workflow artifacts:
- Artifact name: `documentation-validation-results`
- File: `validation-results.json`
- Retention: 30 days

## Best Practices

1. **Run validation before committing documentation changes:**
   ```bash
   pnpm validate:docs
   ```

2. **Fix critical issues immediately** - they will fail CI

3. **Fix high-priority issues soon** - broken links confuse users

4. **Update validation patterns** when making structural changes

5. **Review validation results in PRs** before merging

## Troubleshooting

### False Positives

If the validator incorrectly flags something:

1. Check if the file/script actually exists
2. Verify the path is correct
3. If it's a legitimate false positive, update the validation patterns

### High Issue Count

If you see hundreds of issues:

1. Focus on critical issues first (nonexistent scripts)
2. Then fix high-priority issues (broken links)
3. Medium/low issues can be addressed gradually

### Validation Fails Locally But Passes in CI

- Ensure you've pulled latest changes
- Run `pnpm install --frozen-lockfile`
- Check for uncommitted file renames

## Related Documentation

- [Contributing to Documentation](../../docs/standards/CONTRIBUTING_DOCS.md) - Documentation guidelines
- [Root Documentation Policy](../../docs/standards/ROOT_DOCS_POLICY.md) - Where to put docs

---

**Last Updated:** 2026-01-29
**Maintainer:** RevealUI Team
