# Biome Configuration

This Biome configuration provides comprehensive formatting and linting rules for the RevealUI Framework.

## Strategy: ESLint + Biome

### Biome Handles:
- ✅ Code formatting (indentation, quotes, semicolons, trailing commas, etc.)
- ✅ Style rules (useForOf, useConst, useTemplate, naming conventions, etc.)
- ✅ Most correctness checks (no unused variables, no unreachable code, etc.)
- ✅ Performance rules (no accumulating spread, no delete, etc.)
- ✅ Security rules (no global eval, no dangerouslySetInnerHtml, etc.)
- ✅ Import organization
- ✅ Accessibility rules

### ESLint Handles:
- ✅ Type-aware TypeScript rules (requires TypeScript compiler)
- ✅ Type safety checks (`no-unsafe-*` rules)
- ✅ Type-only import enforcement

## Configuration

The shared Biome config is exported from `dev/biome`:

```typescript
import { biomeConfig } from 'dev/biome'
```

However, most packages should use the root `biome.json` which extends this configuration.

## Formatting Rules

Aligned with project conventions:
- **Quotes**: Single quotes for strings (`'string'`), double quotes for JSX attributes (`"value"`)
- **Semicolons**: Omitted when not required (`asNeeded`)
- **Trailing Commas**: ES6 trailing commas in objects/arrays
- **Indentation**: 2 spaces, max line width 100 characters
- **Arrow Functions**: Always include parentheses around parameters: `(param) => {}`
- **Import Organization**: Automatically organized

## Linting Rules

### Style
- `useForOf`: Prefer `for...of` over traditional loops
- `useConst`: Use `const` for variables that are never reassigned
- `useTemplate`: Use template literals instead of string concatenation
- `useNamingConvention`: Enforce naming conventions (camelCase, PascalCase, etc.)

### Suspicious Code
- `noExplicitAny`: Ban explicit `any` type
- `noDoubleEquals`: Use `===` instead of `==`
- `noUnusedVariables`: Error on unused variables
- `noDebugger`: Error on `debugger` statements
- And many more...

### Correctness
- `noUndeclaredVariables`: Error on undeclared variables
- `noUnreachable`: Error on unreachable code
- `useIsNan`: Use `Number.isNaN()` instead of `isNaN()`
- And many more...

### Performance
- `noAccumulatingSpread`: Warn on accumulating spread in loops
- `noDelete`: Error on `delete` operator

### Security
- `noGlobalEval`: Error on `eval()` and similar
- `noDangerouslySetInnerHtml`: Warn on React's `dangerouslySetInnerHtml`

## Overrides

The config includes overrides for:
- **Config files**: More lenient `noExplicitAny` (warn instead of error)
- **Test files**: More lenient rules for test code

## Usage

### Format code
```bash
pnpm format
# or
biome format --write .
```

### Lint code
```bash
pnpm lint:fix
# or
biome check --write .
```

### Check only (no fixes)
```bash
biome check .
```

## Integration with ESLint

Biome and ESLint work together:
1. **Biome** runs first for fast formatting and most linting
2. **ESLint** runs second for type-aware TypeScript checks

This gives you the best of both worlds:
- Fast formatting and linting from Biome
- Deep type safety checks from ESLint
