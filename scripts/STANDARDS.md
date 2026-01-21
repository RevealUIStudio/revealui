# Script Quality Standards

## Overview

All scripts in the RevealUI project must adhere to these quality standards to ensure consistency, maintainability, and reliability.

## 1. Code Quality Standards

### Required Structure
All scripts must follow this standard structure:

```typescript
#!/usr/bin/env tsx

/**
 * Script description and purpose
 *
 * Usage:
 *   pnpm script:command [args]
 *
 * @example
 *   pnpm script:command --help
 */

import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

async function main() {
  try {
    logger.header('Script Purpose')

    // Implementation with proper error handling
    // Input validation
    // Logging at appropriate levels

    logger.success('Completed successfully')
  } catch (error) {
    logger.error(`Script failed: ${error}`)
    process.exit(1)
  }
}

main()
```

### Error Handling Requirements
- ✅ All functions wrapped in try/catch blocks
- ✅ Proper error messages with context
- ✅ Process exit codes: 0 for success, 1 for failure
- ✅ No unhandled promise rejections

### Logging Standards
- ✅ Use `createLogger()` from shared utils
- ✅ `logger.header()` for main operations
- ✅ `logger.info()` for progress updates
- ✅ `logger.warning()` for non-critical issues
- ✅ `logger.error()` for failures
- ✅ `logger.success()` for completion

### Input Validation
- ✅ Validate required arguments
- ✅ Provide helpful error messages
- ✅ Support `--help` flag where appropriate
- ✅ Use descriptive parameter names

## 2. Documentation Standards

### JSDoc Requirements
- ✅ All exported functions must have JSDoc comments
- ✅ Include `@param` descriptions for all parameters
- ✅ Include `@returns` description for return values
- ✅ Include usage examples where helpful

### README Requirements
- ✅ Every script must have a header comment explaining purpose
- ✅ Usage examples in header comment
- ✅ Error handling documented

## 3. Testing Standards

### Test Coverage Requirements
- ✅ Unit tests for all utility functions
- ✅ Integration tests for script workflows
- ✅ 80%+ code coverage target
- ✅ Tests in `__tests__/` subdirectories

### Test Structure
```typescript
// scripts/my-script/__tests__/my-script.test.ts
import { describe, it, expect } from 'vitest'

describe('my-script', () => {
  it('should handle valid input', () => {
    // Test implementation
  })

  it('should handle invalid input', () => {
    // Test error cases
  })
})
```

## 4. Performance Standards

### Efficiency Requirements
- ✅ No unnecessary file system operations
- ✅ Reasonable timeout limits (30s default)
- ✅ Memory-efficient processing
- ✅ No infinite loops without progress indicators

### Resource Management
- ✅ Proper cleanup of file handles
- ✅ No resource leaks
- ✅ Reasonable memory usage

## 5. Security Standards

### Input Sanitization
- ✅ Validate all user inputs
- ✅ Sanitize file paths
- ✅ Prevent command injection
- ✅ Safe shell execution

### File System Safety
- ✅ Check file existence before operations
- ✅ Proper permission handling
- ✅ No dangerous operations (rm -rf, etc.) without confirmation

## 6. Cross-Platform Compatibility

### Platform Independence
- ✅ Use Node.js built-ins over shell commands
- ✅ Handle path separators correctly
- ✅ Support Windows, macOS, and Linux
- ✅ Use `execCommand` with `shell: process.platform === 'win32'`

### Dependency Management
- ✅ Import only necessary modules
- ✅ Use dynamic imports for optional dependencies
- ✅ No hardcoded paths

## 7. Maintenance Standards

### Code Organization
- ✅ Single responsibility per script
- ✅ Logical function decomposition
- ✅ Consistent naming conventions
- ✅ No duplicate code

### Version Control
- ✅ Clear commit messages
- ✅ Atomic changes
- ✅ Proper branching strategy

## Implementation Checklist

### Pre-Commit Checks
- [ ] JSDoc coverage meets requirements
- [ ] All tests pass
- [ ] Linting passes
- [ ] No console statements in production code

### Code Review Checklist
- [ ] Follows standard script structure
- [ ] Proper error handling implemented
- [ ] Input validation present
- [ ] Tests written and passing
- [ ] Documentation complete
- [ ] Performance considerations addressed
- [ ] Security requirements met

## Enforcement

### Automated Enforcement
- Pre-commit hooks will enforce standards
- CI/CD will validate compliance
- Scripts failing standards will be quarantined

### Manual Review
- Code reviews will check standards compliance
- Regular audits will identify violations
- Standards will be updated as needed

## Exceptions

### When Standards Can Be Bypassed
- **Experimental scripts**: May not follow all standards during development
- **Legacy scripts**: Existing scripts may be updated incrementally
- **Performance-critical scripts**: May have relaxed requirements with justification

### Documentation Requirements
All exceptions must be:
- Documented with justification
- Time-bound (when standards will be met)
- Approved by code review