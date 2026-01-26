# Cohesion Engine

Automated cohesion analysis and cleanup system for RevealUI Framework.

## Overview

The Cohesion Engine provides:
1. **Analysis** - Detects cohesion issues (patterns, metrics, type safety)
2. **Assessment** - Generates brutally honest assessment documents
3. **Fixes** - Automatically fixes issues (Phase 3 - minimal structure)

## Status

- ✅ **Phase 1: Analysis Engine** - Complete
- ✅ **Phase 2: Assessment Generation** - Complete
- ⚠️ **Phase 3: Automated Cleanup** - Minimal structure (pending full implementation)
- ⏳ **Phase 4: Ralph Integration** - Pending

## Usage

### Analyze Codebase

```bash
pnpm cohesion:analyze
```

Scans the codebase for cohesion issues and generates analysis results in `.cursor/cohesion-analysis.json`.

### Generate Assessment

```bash
pnpm cohesion:assess
```

Generates a brutally honest assessment document from analysis results. Output: `DEVELOPER_EXPERIENCE_COHESION_ANALYSIS.md`

### Apply Fixes (Phase 3 - Limited)

```bash
# Dry run (show what would be fixed)
pnpm cohesion:fix --dry-run

# Apply fixes for specific issue type
pnpm cohesion:fix --fix-type=type-assertion-any

# Apply fixes (WARNING: Not fully implemented yet)
pnpm cohesion:fix
```

**Note**: Automated fixes are not yet fully implemented. The fix command currently shows what would be fixed but doesn't apply changes.

## Architecture

```
scripts/cohesion/
├── analyze.ts          # Analysis command
├── assess.ts           # Assessment generation command
├── fix.ts              # Automated fix command (Phase 3)
├── types.ts            # TypeScript types
└── utils/
    ├── patterns.ts     # Pattern detection
    ├── metrics.ts      # Metrics generation
    ├── extraction.ts   # Code extraction
    ├── templates.ts    # Assessment templates
    └── fixes.ts        # Fix strategies (Phase 3)
```

## Patterns Detected

The engine detects:

1. **Config Import Pattern** - Duplicate `import config from '@revealui/config'`
2. **getRevealUI Calls** - Duplicate `getRevealUI({ config })` patterns
3. **Type Assertions** - `as any` and `as unknown` usage
4. **Unscoped Imports** - `revealui/` instead of `@revealui/`
5. **Direct Path Imports** - Workaround imports (`../../packages/...`)

## Assessment Output

The assessment document includes:

- Executive summary with overall grade
- Quantitative evidence (file counts, percentages)
- Critical developer friction points
- Cohesion gaps by severity
- Overall assessment (Would I Use This?)
- Required fixes (prioritized)
- Success metrics

## Future Work

### Phase 3: Automated Cleanup (Full Implementation)

- Type assertion removal
- Import standardization
- Pattern extraction (create utilities)
- Configuration fixes

### Phase 4: Ralph Integration

- Iterative improvement workflow
- Progress tracking
- Incremental fixes
- Completion detection

## Development

To extend the engine:

1. **Add Pattern Detection**: Update `utils/patterns.ts` with new pattern matchers
2. **Add Fix Strategy**: Implement fix strategy in `utils/fixes.ts`
3. **Update Templates**: Modify assessment template in `utils/templates.ts`

## Status & Implementation

See `STATUS.md` for detailed implementation status, test results, and known issues.

## Documentation

- `STATUS.md` - Implementation status and test results
- `BRUTAL_HONESTY_INTEGRATION.md` - Brutal honesty system documentation
- `RALPH_INTEGRATION.md` - Ralph integration documentation

## See Also

- `../../RALPH_COHESION_ENGINE_RESEARCH.md` - Research and design document
- `../../DEVELOPER_EXPERIENCE_COHESION_ANALYSIS.md` - Generated assessment
