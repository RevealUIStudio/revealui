# Scripts Directory

This directory contains essential development, build, and maintenance scripts for the RevealUI project.

## Status: RECOVERY MODE

**⚠️ EMERGENCY RECOVERY**: This directory was completely lost due to a failed migration attempt. Basic placeholder scripts have been restored to allow development to continue.

## Current Scripts

### Core Infrastructure
- `shared/utils.ts` - Essential utilities for all scripts
- `validation/check-console-statements.ts` - Console statement validation
- `validation/package-extraction-guardrails.sh` - Package duplication checks
- `validation/package-creation-monitor.ts` - Package creation monitoring

### Database
- `database/reset-database.ts` - Database reset functionality (placeholder)

### Setup
- `setup/setup-env.ts` - Environment setup (placeholder)

### Automation
- `automation/auto-start-dev.ts` - Development environment startup (placeholder)

### Testing
- `test/performance-regression.ts` - Performance regression testing (placeholder)

### Documentation
- `docs/docs-lifecycle.ts` - Documentation lifecycle management (placeholder)

### Performance
- `measure-performance.js` - Performance measurement (placeholder)

## Usage

Most scripts can be run via npm/pnpm scripts:

```bash
# Validation
pnpm validate:console
pnpm guardrails
pnpm monitor:packages

# Database
pnpm db:reset

# Setup
pnpm setup:env

# Development
pnpm dev
```

## Recovery Status

✅ **RESTORED**: Basic script infrastructure
✅ **WORKING**: Pre-commit hooks
✅ **FUNCTIONAL**: CI/CD pipelines
⚠️ **PLACEHOLDER**: Most scripts are basic placeholders
❌ **MISSING**: Full script functionality (146+ scripts lost)

## Next Steps

1. **Audit Requirements**: Identify which scripts are actually needed
2. **Prioritize Restoration**: Restore critical scripts first
3. **Rebuild Incrementally**: Add scripts as needed rather than all at once
4. **Improve Safety**: Add backup mechanisms and testing

## Lessons Learned

- Always backup before major migrations
- Test functionality before committing changes
- Use git carefully with large file operations
- Have recovery plans for critical infrastructure

---

*This directory contains emergency recovery scripts. Full functionality restoration is in progress.*