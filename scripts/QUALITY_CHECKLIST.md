# Script Quality Checklist

## Pre-Development Checklist

### Planning Phase
- [ ] **Purpose clearly defined** - Script has a single, clear responsibility
- [ ] **Requirements documented** - Input/output specifications defined
- [ ] **Dependencies identified** - All required packages/modules listed
- [ ] **Error scenarios considered** - Failure modes and recovery strategies planned
- [ ] **Performance requirements** - Speed and resource usage expectations set
- [ ] **Security implications** - Potential security issues identified and mitigated

### Design Phase
- [ ] **Architecture appropriate** - Solution matches complexity of problem
- [ ] **Reusability considered** - Can functionality be reused elsewhere?
- [ ] **Maintainability prioritized** - Code will be easy to understand and modify
- [ ] **Testing strategy defined** - How will the script be tested?
- [ ] **Documentation plan** - What docs will be created/updated?

## Development Checklist

### Code Structure
- [ ] **Standard template used** - Follows `scripts/templates/script-template.ts`
- [ ] **Proper imports** - Only imports what's needed from shared utils
- [ ] **Function decomposition** - Complex logic broken into smaller functions
- [ ] **Variable naming** - Clear, descriptive names following conventions
- [ ] **No magic numbers** - Constants defined with descriptive names
- [ ] **No duplicate code** - DRY principle followed

### Error Handling
- [ ] **Try/catch blocks** - All operations wrapped in error handling
- [ ] **Specific error messages** - Clear, actionable error descriptions
- [ ] **Proper exit codes** - 0 for success, 1 for failure
- [ ] **Resource cleanup** - Files/handles closed in error paths
- [ ] **No silent failures** - All errors logged appropriately

### Input Validation
- [ ] **Required parameters checked** - Missing inputs cause clear errors
- [ ] **Parameter types validated** - Type coercion handled safely
- [ ] **File paths sanitized** - Path traversal attacks prevented
- [ ] **Size limits enforced** - Prevent excessive resource usage
- [ ] **Help option provided** - `--help` flag shows usage information

### Logging
- [ ] **Appropriate log levels** - Info for progress, warning for issues, error for failures
- [ ] **Context provided** - Logs include relevant details for debugging
- [ ] **Performance impact considered** - Logging doesn't slow down operations
- [ ] **Sensitive data protected** - No passwords/tokens in logs
- [ ] **Consistent formatting** - All logs follow same pattern

### Security
- [ ] **Command injection prevented** - User input doesn't reach shell commands
- [ ] **Path traversal blocked** - File operations stay within allowed directories
- [ ] **Permission checks** - Operations validate access rights
- [ ] **Input sanitization** - All user inputs cleaned and validated
- [ ] **No hardcoded secrets** - Credentials come from environment variables

### Performance
- [ ] **Efficient algorithms** - O(n) complexity where possible
- [ ] **Memory usage reasonable** - No excessive memory consumption
- [ ] **File I/O optimized** - Minimal disk access, buffered operations
- [ ] **Network calls limited** - HTTP requests only when necessary
- [ ] **Progress indication** - Long operations show progress

### Cross-Platform Compatibility
- [ ] **Path handling correct** - Uses `path.join()` and `path.resolve()`
- [ ] **Line endings handled** - Text files work on Windows/macOS/Linux
- [ ] **Shell commands avoided** - Node.js alternatives used where possible
- [ ] **File permissions portable** - Access checks work across platforms
- [ ] **Dependencies available** - No platform-specific requirements

## Testing Checklist

### Unit Tests
- [ ] **Test file created** - `__tests__/script-name.test.ts` exists
- [ ] **Happy path covered** - Normal operation tested
- [ ] **Error cases tested** - All error conditions covered
- [ ] **Edge cases handled** - Boundary conditions tested
- [ ] **Mock dependencies** - External dependencies properly mocked
- [ ] **80% coverage achieved** - All critical paths tested

### Integration Tests
- [ ] **Workflow tested** - Full script execution tested
- [ ] **File operations verified** - Disk I/O works correctly
- [ ] **External APIs mocked** - Network calls don't hit real services
- [ ] **Cleanup performed** - Test artifacts removed after execution
- [ ] **Cross-platform tested** - Works on different operating systems

### Manual Testing
- [ ] **Help option works** - `--help` shows proper usage information
- [ ] **Error messages clear** - Failures provide actionable feedback
- [ ] **Dry-run mode works** - `--dry-run` shows intended operations
- [ ] **Verbose mode useful** - `--verbose` provides debugging information
- [ ] **Performance acceptable** - Script completes in reasonable time

## Documentation Checklist

### Code Documentation
- [ ] **Header comment complete** - Purpose, usage, examples documented
- [ ] **Function JSDoc** - All exported functions have JSDoc comments
- [ ] **Parameter documentation** - All `@param` tags present and descriptive
- [ ] **Return value documented** - `@returns` tags for non-void functions
- [ ] **Examples provided** - Usage examples in header comment
- [ ] **Error conditions listed** - When and why the script might fail

### External Documentation
- [ ] **README updated** - New script documented in main README
- [ ] **Package.json accurate** - Script description and command match
- [ ] **CHANGELOG entry** - New functionality documented
- [ ] **Migration notes** - Breaking changes or required actions noted

## Deployment Checklist

### Pre-Commit Validation
- [ ] **All tests pass** - `pnpm test` completes successfully
- [ ] **Linting passes** - `pnpm lint` reports no issues
- [ ] **Type checking** - `pnpm typecheck` passes without errors
- [ ] **Console statements removed** - `pnpm validate:console` passes
- [ ] **Script standards met** - Quality checklist completed

### CI/CD Integration
- [ ] **Workflows updated** - Any required CI/CD changes made
- [ ] **Permissions correct** - Script has necessary access rights
- [ ] **Environment variables** - All required env vars documented
- [ ] **Timeout settings** - Script won't cause CI timeouts
- [ ] **Resource limits** - Memory/CPU usage within CI limits

## Maintenance Checklist

### Code Review
- [ ] **Standards compliance** - All quality standards met
- [ ] **Security review** - No security vulnerabilities introduced
- [ ] **Performance review** - No performance regressions
- [ ] **Maintainability** - Code is easy to understand and modify
- [ ] **Testing adequate** - Test coverage and quality sufficient

### Long-term Maintenance
- [ ] **Dependencies monitored** - Outdated packages tracked
- [ ] **Usage monitored** - Script usage patterns tracked
- [ ] **Error rates tracked** - Failure rates monitored
- [ ] **Performance baselines** - Speed and resource usage tracked
- [ ] **Documentation updated** - Docs stay current with code changes

## Emergency Procedures

### Rollback Plan
- [ ] **Revert capability** - Can changes be easily undone?
- [ ] **Backup strategy** - Critical data backed up before execution
- [ ] **Downtime impact** - What breaks if script fails?
- [ ] **Recovery time** - How long to restore service?

### Incident Response
- [ ] **Monitoring alerts** - Are failures properly monitored?
- [ ] **Error reporting** - Clear error messages for debugging
- [ ] **Support contacts** - Who to contact for issues
- [ ] **Escalation procedures** - When to involve senior team members

---

## Checklist Completion

**Completed by:** ________________________
**Date:** ________________________
**Review Status:** ☐ Pending ☐ Approved ☐ Rejected
**Rejection Reason:** ________________________

**Reviewer:** ________________________
**Review Date:** ________________________