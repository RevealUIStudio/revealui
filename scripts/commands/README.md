# Commands Directory

Implementation layer for CLI commands. Each subdirectory contains the logic that CLIs delegate to.

## Structure

```
commands/
├── database/          # Database command implementations (existing)
│   ├── backup.ts
│   ├── restore.ts
│   └── status.ts
├── analyze/           # Analysis command implementations (future)
├── validate/          # Validation command implementations (future)
├── generate/          # Generation command implementations (future)
└── maintain/          # Maintenance command implementations (future)
```

## Purpose

This directory provides organized storage for command implementations that are called by the CLI layer (`scripts/cli/`).

### Current Organization

- **CLIs** (`scripts/cli/`) - User-facing interface, argument parsing, help
- **Commands** (`scripts/commands/`) - Implementation logic
- **Legacy** (`scripts/analyze/`, `scripts/validate/`, etc.) - Original scripts (still working)

### Migration Strategy

Scripts are gradually being organized into `commands/` subdirectories:

1. **Phase 1**: CLIs delegate to existing scripts in analyze/, validate/, etc.
2. **Phase 2**: Slowly move implementations to commands/ as needed
3. **Phase 3**: Eventually deprecate top-level script directories

### Currently Active

- `database/` - Database operations (backup, restore, status)

### Planned

- `analyze/` - Code analysis implementations
- `validate/` - Validation logic
- `generate/` - Code generation logic
- `maintain/` - Maintenance and fix logic

## Contributing

When adding new commands:

1. Create implementation in appropriate `commands/<category>/` subdirectory
2. CLI in `scripts/cli/` delegates to command implementation
3. Add tests in `scripts/__tests__/`
4. Update CLI README and help text

## Example

```typescript
// scripts/commands/analyze/quality.ts
export async function analyzeQuality(options) {
  // Implementation
}

// scripts/cli/analyze.ts
import { analyzeQuality } from '../commands/analyze/quality.js'

class AnalyzeCLI extends BaseCLI {
  async runQuality(args) {
    return analyzeQuality(args)
  }
}
```
