# Documentation Scripts Reference

**Last Updated**: January 2025

Complete list of all documentation-related scripts and their purposes.

## Script Files

### Core Organization Scripts

| Script File | Package.json Command | Purpose |
|------------|---------------------|---------|
| `scripts/docs/organize-docs.ts` | `pnpm docs:organize` | Organizes documentation files into standardized directory structure. Handles both docs root cleanup (keeps only README.md) and general file organization. |
| `scripts/docs/consolidate-root-docs.ts` | `pnpm docs:consolidate` | Moves root-level markdown files to appropriate archive locations. Enforces root docs policy. |
| `scripts/docs/detect-duplicates.ts` | (No direct command) | Identifies duplicate content across documentation files. |
| `scripts/docs/merge-docs.ts` | (No direct command) | Utility script to merge content from multiple documentation files. |

### Documentation Lifecycle Management

| Script File | Package.json Command | Purpose |
|------------|---------------------|---------|
| `scripts/docs/docs-lifecycle.ts` | `pnpm docs:check` | Checks documentation for stale content, broken links, and issues. |
| `scripts/docs/docs-lifecycle.ts` | `pnpm docs:archive` | Archives outdated documentation files. |
| `scripts/docs/docs-lifecycle.ts` | `pnpm docs:watch` | Watches documentation files for changes and validates them. |
| `scripts/docs/docs-lifecycle.ts` | `pnpm docs:clean` | Cleans up temporary documentation files and artifacts. |
| `scripts/docs/maintenance-check.ts` | `pnpm docs:maintenance` | Automated documentation maintenance checks and suggestions. |

### API Documentation Generation

| Script File | Package.json Command | Purpose |
|------------|---------------------|---------|
| `scripts/docs/api-doc-extractor.ts` | (Utility) | Core utility for parsing TypeScript source files and extracting API entities using TypeScript compiler API. |
| `scripts/docs/api-doc-template.ts` | (Utility) | Generates markdown content from extracted API entities. |
| `scripts/docs/generate-api-docs.ts` | `pnpm docs:generate:api` | Main script to orchestrate API documentation generation for specified packages. |
| `scripts/docs/generate-package-readme.ts` | `pnpm docs:generate:readme` | Auto-generates README files for individual packages. |
| `scripts/docs/build-docs-site.ts` | `pnpm docs:generate:site` | Builds the TanStack Start documentation website. |
| `scripts/docs/generate-api-docs.ts` | `pnpm docs:generate:all` | Runs all generation scripts: API docs, READMEs, and site build. |

### JSDoc Validation & Coverage

| Script File | Package.json Command | Purpose |
|------------|---------------------|---------|
| `scripts/docs/validate-jsdoc.ts` | `pnpm docs:validate:jsdoc` | Validates JSDoc comments against defined standards. |
| `scripts/docs/jsdoc-coverage.ts` | `pnpm docs:coverage` | Generates JSDoc coverage reports showing documentation completeness. |

### Verification Scripts

| Script File | Package.json Command | Purpose |
|------------|---------------------|---------|
| `scripts/docs/verify-links.ts` | `pnpm docs:verify:links` | Verifies all internal and external links in documentation. |
| `scripts/docs/verify-versions.ts` | `pnpm docs:verify:versions` | Verifies version numbers are consistent across documentation. |
| `scripts/docs/verify-commands.ts` | `pnpm docs:verify:commands` | Verifies code examples and commands are valid. |
| `scripts/docs/verify-paths.ts` | `pnpm docs:verify:paths` | Verifies file paths referenced in documentation exist. |
| `scripts/docs/verify-code-examples.ts` | `pnpm docs:verify:code-examples` | Validates code examples in documentation. |
| `scripts/docs/verify-consolidation.ts` | `pnpm docs:verify:consolidation` | Verifies consolidation rules are followed. |
| `scripts/docs/validate-all.ts` | `pnpm docs:validate:all` | Runs all validation checks in a unified pipeline. |
| `scripts/docs/validate-all.ts` | `pnpm docs:verify:all` | Runs all verification scripts (links, versions, commands, paths). |

### Documentation Website

| Script File | Package.json Command | Purpose |
|------------|---------------------|---------|
| (TanStack Start app) | `pnpm docs:dev` | Starts development server for documentation website. |
| (TanStack Start app) | `pnpm docs:build` | Builds production version of documentation website. |
| (TanStack Start app) | `pnpm docs:serve` | Serves built documentation website. |

### Testing

| Script File | Package.json Command | Purpose |
|------------|---------------------|---------|
| (Vitest) | `pnpm docs:test` | Runs documentation-related tests. |
| (Vitest) | `pnpm docs:test:watch` | Runs tests in watch mode. |

### Other

| Script File | Package.json Command | Purpose |
|------------|---------------------|---------|
| `scripts/deployment/archive-assessments.ts` | `pnpm docs:archive-assessments` | Archives assessment files to appropriate locations. |

## Command Categories

### Organization & Structure
- `docs:organize` - Organize files into standardized structure
- `docs:consolidate` - Consolidate root-level docs

### Generation
- `docs:generate:api` - Generate API documentation
- `docs:generate:readme` - Generate package READMEs
- `docs:generate:site` - Build documentation website
- `docs:generate:all` - Run all generation scripts

### Validation & Verification
- `docs:validate:jsdoc` - Validate JSDoc comments
- `docs:validate:all` - Run all validation checks
- `docs:verify:links` - Verify links
- `docs:verify:versions` - Verify versions
- `docs:verify:commands` - Verify commands
- `docs:verify:paths` - Verify paths
- `docs:verify:code-examples` - Verify code examples
- `docs:verify:consolidation` - Verify consolidation
- `docs:verify:all` - Run all verification scripts

### Coverage & Analysis
- `docs:coverage` - Generate JSDoc coverage report

### Lifecycle Management
- `docs:check` - Check documentation health
- `docs:archive` - Archive outdated docs
- `docs:watch` - Watch for changes
- `docs:clean` - Clean temporary files
- `docs:maintenance` - Run maintenance checks

### Website Development
- `docs:dev` - Start dev server
- `docs:build` - Build production site
- `docs:serve` - Serve built site

### Testing
- `docs:test` - Run tests
- `docs:test:watch` - Run tests in watch mode

## Usage Examples

### Organize Documentation
```bash
# Dry run to see what would be moved
pnpm docs:organize --dry-run

# Actually organize files
pnpm docs:organize
```

### Generate All Documentation
```bash
# Generate API docs, READMEs, and build site
pnpm docs:generate:all
```

### Validate Everything
```bash
# Run all validation checks
pnpm docs:validate:all

# Run all verification checks
pnpm docs:verify:all
```

### Check Documentation Health
```bash
# Check for issues
pnpm docs:check

# Run maintenance checks
pnpm docs:maintenance
```

### Development Workflow
```bash
# Start docs website dev server
pnpm docs:dev

# Build docs website
pnpm docs:build

# Serve built website
pnpm docs:serve
```

## Script Dependencies

### Core Utilities
- `api-doc-extractor.ts` - Used by `generate-api-docs.ts`
- `api-doc-template.ts` - Used by `generate-api-docs.ts`

### Shared Utilities
All scripts use shared utilities from `scripts/shared/utils.js`:
- `createLogger()` - Logging utilities
- `getProjectRoot()` - Project root detection
- `confirm()` - User confirmation prompts

## File Locations

- **Scripts**: `scripts/docs/*.ts`
- **Documentation**: `docs/`
- **Documentation Website**: `apps/docs/`
- **Generated API Docs**: `docs/api/`
- **Package READMEs**: `packages/*/README.md` (auto-generated)

## Related Documentation

- [Documentation Tools](./DOCUMENTATION-TOOLS.md) - Detailed tool documentation
- [Documentation Structure](./STRUCTURE.md) - Directory structure guide
- [API Documentation Guide](./API-DOCS-GUIDE.md) - How to write API docs
- [Contributing to Documentation](./CONTRIBUTING-DOCS.md) - Contribution guidelines
