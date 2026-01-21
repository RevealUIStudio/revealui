# Script Development Guide

## Overview

This guide explains how to create new scripts for the RevealUI project following established standards and best practices.

## 1. Planning Your Script

### Define the Problem
- **What problem does this script solve?**
- **Who will use this script?** (developers, CI/CD, operations)
- **How often will it run?** (one-time, daily, CI/CD)
- **What are the failure scenarios?**

### Assess Complexity
- **Is this a simple utility or complex workflow?**
- **Does it need user interaction?**
- **Are there external dependencies?**
- **What's the performance impact?**

### Choose the Right Category
```
scripts/
├── database/     # Database operations, migrations, seeding
├── validation/   # Code quality, security, compliance checks
├── setup/        # Environment setup, configuration, installation
├── docs/         # Documentation management and generation
├── analysis/     # Code analysis, metrics, reporting
├── mcp/          # Model Context Protocol integrations
├── dev/          # Development workflow helpers
├── deployment/   # Deployment and release scripts
├── monitoring/   # System monitoring and health checks
├── test/         # Testing utilities and helpers
└── types/        # Type generation and validation
```

## 2. Creating Your Script

### Use the Template
Start with the standard template:

```bash
cp scripts/templates/script-template.ts scripts/[category]/my-script.ts
```

### Customize the Template
1. **Update the header comment** with your script's purpose and usage
2. **Modify the options interface** for your script's parameters
3. **Implement input validation** in `validateOptions()`
4. **Add your main logic** in the main execution block
5. **Update help text** in `showHelp()`

### Example: Simple File Processor

```typescript
#!/usr/bin/env tsx

/**
 * File Processor - Process files in a directory
 *
 * Processes all files in a directory with configurable operations.
 *
 * Usage:
 *   pnpm tsx scripts/utils/file-processor.ts --input ./src --output ./dist
 *
 * Options:
 *   --input, -i    Input directory (required)
 *   --output, -o   Output directory (required)
 *   --pattern, -p  File pattern to match (default: *.ts)
 *   --dry-run      Show what would be done
 */

import { readdir, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

interface ScriptOptions {
  input: string
  output: string
  pattern: string
  dryRun?: boolean
  help?: boolean
}

function parseArgs(): ScriptOptions {
  // Implementation here
}

function showHelp(): void {
  // Implementation here
}

function validateOptions(options: ScriptOptions): void {
  if (!options.input) {
    throw new Error('Input directory is required (--input)')
  }
  if (!options.output) {
    throw new Error('Output directory is required (--output)')
  }
}

async function processFiles(options: ScriptOptions): Promise<void> {
  const files = await findFiles(options.input, options.pattern)

  for (const file of files) {
    if (options.dryRun) {
      logger.info(`Would process: ${file}`)
    } else {
      await processFile(file, options)
    }
  }
}

async function findFiles(dir: string, pattern: string): Promise<string[]> {
  // Implementation here
}

async function processFile(filePath: string, options: ScriptOptions): Promise<void> {
  // Implementation here
}

async function main() {
  const options = parseArgs()

  if (options.help) {
    showHelp()
    return
  }

  try {
    validateOptions(options)

    logger.header('File Processor')
    logger.info(`Input: ${options.input}`)
    logger.info(`Output: ${options.output}`)
    logger.info(`Pattern: ${options.pattern}`)

    await processFiles(options)

    logger.success('File processing completed')

  } catch (error) {
    logger.error(`File processing failed: ${error}`)
    process.exit(1)
  }
}

main()
```

## 3. Adding Tests

### Create Test File
```bash
mkdir -p scripts/[category]/__tests__/
touch scripts/[category]/__tests__/my-script.test.ts
```

### Write Comprehensive Tests
```typescript
import { describe, it, expect, vi } from 'vitest'
import { execCommand } from '../../shared/utils.js'

describe('my-script', () => {
  it('should process files successfully', async () => {
    // Test successful execution
  })

  it('should handle missing input directory', async () => {
    // Test error handling
  })

  it('should respect dry-run mode', async () => {
    // Test dry-run functionality
  })

  it('should show help with --help flag', async () => {
    // Test help functionality
  })
})
```

### Run Tests
```bash
# Run specific script tests
cd scripts && pnpm exec vitest run [category]/__tests__/my-script.test.ts

# Run all script tests
cd scripts && pnpm exec vitest run
```

## 4. Documentation

### Update Script Header
Ensure the script has comprehensive documentation:

```typescript
/**
 * My Script - Brief description
 *
 * Detailed description of what the script does,
 * when to use it, and important considerations.
 *
 * Usage:
 *   pnpm script:my-command [options]
 *
 * Options:
 *   --input, -i    Description of input parameter
 *   --output, -o   Description of output parameter
 *   --dry-run      Show what would be done without changes
 *
 * Examples:
 *   pnpm script:my-command --input ./data --output ./results
 *   pnpm script:my-command --dry-run --verbose
 *
 * @author Your Name
 * @version 1.0.0
 */
```

### Update Package.json
Add your script to the root `package.json`:

```json
{
  "scripts": {
    "script:my-command": "tsx scripts/[category]/my-script.ts"
  }
}
```

### Update README
Add your script to `scripts/README.md` under the appropriate category.

## 5. Quality Assurance

### Run Quality Checks
```bash
# Check console statements
pnpm validate:console

# Run linting
pnpm lint

# Run type checking
pnpm typecheck

# Run tests
pnpm test
```

### Use Quality Checklist
Go through `scripts/QUALITY_CHECKLIST.md` and ensure all items are addressed.

### Code Review
- Ensure the script follows all standards in `scripts/STANDARDS.md`
- Get approval from at least one other developer
- Address any feedback before merging

## 6. Deployment

### Pre-commit Validation
Your script will automatically be validated by pre-commit hooks:
- Console statement validation
- Linting and type checking
- Test execution

### CI/CD Integration
If your script needs to run in CI/CD:
1. Update the appropriate workflow files in `.github/workflows/`
2. Ensure the script has appropriate timeouts and error handling
3. Test the script in the CI environment

## 7. Maintenance

### Monitoring
- Monitor script execution in production
- Track error rates and performance
- Update dependencies regularly

### Updates
- Keep documentation current
- Update tests when functionality changes
- Review and update error handling as needed

## Common Patterns

### File Processing Scripts
```typescript
async function findFiles(dir: string, pattern: string): Promise<string[]> {
  // Implementation for finding files matching patterns
}

async function processFile(filePath: string): Promise<void> {
  // Implementation for processing individual files
}
```

### API Scripts
```typescript
async function makeAPIRequest(endpoint: string, options: RequestOptions): Promise<any> {
  // Implementation for API calls with proper error handling
}
```

### Configuration Scripts
```typescript
async function loadConfig(): Promise<Config> {
  // Implementation for loading and validating configuration
}

async function saveConfig(config: Config): Promise<void> {
  // Implementation for saving configuration safely
}
```

## Troubleshooting

### Common Issues
- **Import errors**: Ensure you're using the correct paths from `scripts/shared/utils.js`
- **Permission errors**: Scripts need execute permissions (`chmod +x script.ts`)
- **Path issues**: Use `path.join()` and `path.resolve()` for cross-platform compatibility
- **Memory issues**: Process large files in chunks or streams

### Getting Help
- Check existing scripts for similar functionality
- Review the standards document for requirements
- Ask for code review early in development
- Test thoroughly on multiple platforms

## Advanced Topics

### Creating Reusable Libraries
If your script contains logic that could be reused:

1. Extract the core logic into a separate module
2. Place it in `scripts/shared/` if generally useful
3. Import and use it in your script

### Handling Large Datasets
For scripts that process large amounts of data:

1. Use streaming APIs for file processing
2. Implement progress indicators for long operations
3. Add memory usage monitoring
4. Support resumable operations

### Cross-Platform Considerations
- Use `path.join()` instead of string concatenation for paths
- Test on Windows, macOS, and Linux
- Avoid platform-specific shell commands
- Handle different line endings appropriately