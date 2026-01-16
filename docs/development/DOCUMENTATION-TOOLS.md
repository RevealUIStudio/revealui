# Documentation Tools

This project includes a comprehensive set of tools for managing, validating, and cleaning up documentation.

## Quick Reference

### Lifecycle Management
```bash
pnpm docs:check          # Check for stale documentation
pnpm docs:archive        # Archive stale files
pnpm docs:watch          # Watch mode (continuous monitoring)
pnpm docs:clean          # Check + archive in one command
```

### Verification Tools
```bash
pnpm docs:verify:links        # Verify all markdown links
pnpm docs:verify:versions     # Verify version consistency
pnpm docs:verify:commands     # Verify command examples
pnpm docs:verify:paths        # Verify file path references
pnpm docs:verify:code-examples # Verify code examples
pnpm docs:verify:consolidation # Verify doc consolidation
pnpm docs:verify:all          # Run all verifications
pnpm docs:validate:all        # Run unified validation pipeline
pnpm docs:validate:jsdoc      # Validate JSDoc comments
pnpm docs:coverage            # Generate coverage report
```

### Generation Tools
```bash
pnpm docs:generate:api        # Generate API documentation
pnpm docs:generate:readme     # Generate package READMEs
pnpm docs:generate:site       # Build documentation website
pnpm docs:generate:all        # Generate all documentation
```

### Organization Tools
```bash
pnpm docs:organize            # Reorganize documentation files
pnpm docs:consolidate         # Consolidate root-level docs
pnpm docs:maintenance         # Run maintenance checks
```

## Main Tools

### 1. Documentation Lifecycle Manager (`scripts/docs-lifecycle.ts`)

The primary tool for managing documentation lifecycle. It can:

#### Features
- **Stale Detection**: Identifies outdated documentation based on:
  - Package name references (outdated packages)
  - File references (broken links)
  - Code snippets (outdated imports/paths)
  - Dates (file age and "Last Updated" dates)
  - Status markers (completion claims on old files)
  - TODO references (stale TODO comments)

- **Archive Management**: Automatically archives stale files with:
  - Date-stamped filenames
  - Archive index tracking
  - Duplicate handling
  - Configurable archive directory

- **Watch Mode**: Real-time monitoring that:
  - Watches for file changes
  - Validates on save
  - Auto-archives stale files
  - Debounced processing

#### Configuration

Edit `docs-lifecycle.config.json` to customize. **Note**: The outdated values you configure (like `outdatedPackageNames` and `outdatedPaths`) are what the tool will check for and flag. These are the values that should be replaced with their corresponding replacements.

```json
{
  "patterns": {
    "track": ["**/*.md", "**/*REPORT*.json", "**/*SUMMARY*.json"],
    "ignore": ["node_modules/**", ".next/**", "dist/**", "docs/archive/**"],
    "rootOnly": false
  },
  "validation": {
    "checkPackageNames": true,
    "checkFileReferences": true,
    "checkCodeSnippets": true,
    "checkDates": true,
    "checkStatus": true,
    "checkTodos": true,
    "maxAgeDays": null,
    "statusThresholdDays": 90,
    "outdatedPackageNames": ["example-outdated-package"],
    "replacementPackageName": "@revealui/core",
    "outdatedPaths": ["example/outdated/path/"]
  },
  "actions": {
    "onStale": "archive",
    "archiveDir": "docs/archive",
    "dryRun": false
  }
}
```

#### Usage Examples

```bash
# Check what would be archived (dry run)
pnpm docs:check

# Actually archive stale files
pnpm docs:archive

# Run in watch mode (press Ctrl+C to stop)
pnpm docs:watch

# Check and archive in one command
pnpm docs:clean
```

### 2. Link Verification (`scripts/docs/verify-links.ts`)

Validates all markdown links in documentation:

- **Internal file links**: Checks if linked files exist
- **Anchor links**: Validates heading anchors
- **External links**: Optionally checks external URLs
- **Orphaned files**: Finds files not linked from anywhere

#### Usage
```bash
pnpm docs:verify:links
```

### 3. Version Verification (`scripts/docs/verify-versions.ts`)

Ensures version numbers in docs match actual package.json files:

- Checks React, Next.js, TypeScript, Node.js versions
- Validates package.json references
- Reports mismatches

#### Usage
```bash
pnpm docs:verify:versions
```

### 4. Command Verification (`scripts/docs/verify-commands.ts`)

Validates command examples in documentation:

- Checks if commands are valid
- Verifies file paths in commands
- Ensures package references are correct

#### Usage
```bash
pnpm docs:verify:commands
```

### 5. Path Verification (`scripts/docs/verify-paths.ts`)

Verifies file path references:

- Checks if referenced files exist
- Validates import paths
- Reports broken references

#### Usage
```bash
pnpm docs:verify:paths
```

### 6. Code Example Verification (`scripts/docs/verify-code-examples.ts`)

Validates TypeScript code examples:

- Extracts code blocks from markdown
- Validates syntax (basic)
- Checks for outdated patterns

#### Usage
```bash
pnpm docs:verify:code-examples
```

### 7. Consolidation Verification (`scripts/docs/verify-consolidation.ts`)

Verifies that consolidated guides preserve all content:

- Checks consolidation mappings
- Ensures source content is preserved
- Reports missing content

#### Usage
```bash
pnpm docs:verify:consolidation
```

### 8. API Documentation Generator (`scripts/docs/generate-api-docs.ts`)

Automatically generates API documentation from TypeScript source files:

- Extracts JSDoc comments
- Parses type definitions
- Generates markdown documentation
- Creates package-specific API docs

#### Usage
```bash
pnpm docs:generate:api
```

### 9. JSDoc Validation (`scripts/docs/validate-jsdoc.ts`)

Validates JSDoc comments in source code:

- Checks for required JSDoc on public APIs
- Validates parameter documentation
- Checks return type documentation
- Reports missing documentation

#### Usage
```bash
pnpm docs:validate:jsdoc
```

### 10. Coverage Report (`scripts/docs/jsdoc-coverage.ts`)

Generates documentation coverage metrics:

- Calculates coverage percentage
- Reports by package and entity type
- Generates markdown report

#### Usage
```bash
pnpm docs:coverage
```

### 11. Unified Validation (`scripts/docs/validate-all.ts`)

Runs all validation checks in one command:

- Links validation
- Version consistency
- Command verification
- Path verification
- Code examples
- JSDoc validation

#### Usage
```bash
pnpm docs:validate:all
```

### 12. Documentation Organization (`scripts/docs/organize-docs.ts`)

Reorganizes documentation files into standardized structure:

- Moves files to appropriate directories
- Categorizes by content type
- Preserves existing organization

#### Usage
```bash
pnpm docs:organize
```

### 13. Root Documentation Consolidation (`scripts/docs/consolidate-root-docs.ts`)

Moves root-level documentation files to appropriate locations:

- Archives assessment files
- Moves status files
- Keeps only essential root files

#### Usage
```bash
pnpm docs:consolidate
```

### 14. Maintenance Check (`scripts/docs/maintenance-check.ts`)

Runs automated maintenance checks:

- Checks for stale documentation
- Validates coverage
- Checks for broken links
- Provides improvement suggestions

#### Usage
```bash
pnpm docs:maintenance
```

## Recommended Workflow

### Initial Cleanup

1. **Check for issues**:
   ```bash
   pnpm docs:check
   pnpm docs:verify:all
   ```

2. **Review the output** - decide what to fix vs archive

3. **Archive stale files**:
   ```bash
   pnpm docs:archive
   ```

### Ongoing Maintenance

1. **Run verification periodically**:
   ```bash
   pnpm docs:verify:all
   ```

2. **Use watch mode during development**:
   ```bash
   pnpm docs:watch
   ```

3. **Before commits, run quick check**:
   ```bash
   pnpm docs:check
   ```

### Cleanup Specific Issues

```bash
# Find broken links
pnpm docs:verify:links

# Check version consistency
pnpm docs:verify:versions

# Validate code examples
pnpm docs:verify:code-examples
```

## Integration with Other Tools

### Biome Formatter

The project uses Biome for code formatting. While Biome primarily handles code files, you can format markdown manually or use:

```bash
# Format all files (Biome handles TS/JS/JSON)
pnpm format

# Note: Markdown formatting may require additional tools
```

### Additional Markdown Tools (Optional)

If you need more markdown-specific tools, consider:

- **Prettier**: `pnpm add -D prettier` - Full markdown formatting
- **Markdownlint**: `pnpm add -D markdownlint-cli` - Markdown linting
- **Remark**: `pnpm add -D remark-cli` - Markdown processing

## Tips

1. **Start with dry run**: Always run `pnpm docs:check` first to see what would be affected
2. **Use watch mode**: Keep `pnpm docs:watch` running during documentation work
3. **Review archive index**: Check `docs/archive/.index.json` to see what was archived
4. **Customize config**: Adjust `docs-lifecycle.config.json` for your needs
5. **Run verifications**: Use `pnpm docs:verify:all` before major releases

## Troubleshooting

### Tool not working?
- Check that `tsx` is installed: `pnpm add -D tsx`
- Verify Node.js version: `node >= 24.12.0`
- Check config file: `docs-lifecycle.config.json` exists

### Too many false positives?
- Adjust validation settings in `docs-lifecycle.config.json`
- Disable specific checks (set to `false`)
- Increase `statusThresholdDays` for completion checks

### Archive issues?
- Check `docs/archive` directory exists
- Verify write permissions
- Review `docs/archive/.index.json` for archive history

---

**Last Updated**: January 2025
