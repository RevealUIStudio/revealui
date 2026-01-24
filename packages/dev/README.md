# dev

Shared development tooling and configuration for the RevealUI Framework monorepo.

**Package Name**: `dev` (unscoped workspace package)  
**Import Format**: `dev/...` (e.g., `dev/tailwind/create-config`)

## Overview

This package provides centralized configuration files for:
- **ESLint** - Type-aware TypeScript linting
- **Biome** - Fast formatting and linting
- **Tailwind CSS** - Shared styling configuration
- **Vite** - Build tool configuration
- **TypeScript** - Compiler configurations for different project types

## Exports

### ESLint Config
```ts
import eslintConfig from 'dev/eslint'
```

Type-aware ESLint configuration that complements Biome. Focuses on TypeScript type safety checks.

**See**: [ESLint README](./src/eslint/README.md)

### Biome Config
```ts
import { biomeConfig } from 'dev/biome'
```

Comprehensive Biome configuration for formatting and linting.

**See**: [Biome README](./src/biome/README.md)

### Tailwind Config
```ts
import tailwindConfig from 'dev/tailwind'
```

Shared Tailwind CSS configuration with plugins and theme extensions.

### Vite Config
```ts
import viteConfig from 'dev/vite'
```

Shared Vite configuration with common aliases and build settings.

### TypeScript Configs
```json
{
  "extends": "../../packages/dev/src/ts/nextjs.json"
}
```

Available configs (use relative paths):
- `../../packages/dev/src/ts/base.json` - Base configuration
- `../../packages/dev/src/ts/react-library.json` - React libraries
- `../../packages/dev/src/ts/revealui.json` - RevealUI framework packages
- `../../packages/dev/src/ts/vite.json` - Vite applications
- `../../packages/dev/src/ts/nextjs.json` - Next.js applications

**Note**: TypeScript configs use relative paths because JSON `extends` doesn't support package imports.

**See**: [TypeScript README](./src/ts/README.md)

## Strategy: ESLint + Biome

This package uses a dual-linter strategy:

- **Biome**: Handles formatting, style rules, and most correctness checks (fast)
- **ESLint**: Handles type-aware TypeScript rules (requires type information)

This gives you:
- ⚡ Fast formatting and linting from Biome
- 🔒 Deep type safety checks from ESLint

## Usage Examples

### ESLint Configuration
```js
// eslint.config.js
import sharedConfig from 'dev/eslint'

export default [
  {
    ignores: ['dist/**', '.next/**'],
  },
  ...sharedConfig,
]
```

### Biome Configuration
Most packages should use the root `biome.json`, but you can extend the shared config:

```ts
import { biomeConfig } from 'dev/biome'

export default {
  ...biomeConfig,
  // Your overrides
}
```

### Tailwind Configuration
```ts
// tailwind.config.ts
import { createTailwindConfig } from 'dev/tailwind/create-config'

export default createTailwindConfig({
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Your app-specific theme extensions
    },
  },
})
```

### Vite Configuration
```ts
// vite.config.ts
import { defineConfig } from 'vite'
import sharedViteConfig from 'dev/vite'

export default defineConfig({
  ...sharedViteConfig,
  // Your app-specific config
})
```

### TypeScript Configuration
```json
{
  "extends": "../../packages/dev/src/ts/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

## Development

### Scripts
- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Biome

### Adding New Configs

1. Create config file in appropriate directory (`src/eslint/`, `src/biome/`, etc.)
2. Add export to `package.json` `exports` field
3. Document in relevant README
4. Update this README if it's a new category

## Package Naming

This package is named `dev` (unscoped) in the monorepo workspace. Use `dev/...` import paths:

- ✅ `import x from 'dev/tailwind/create-config'`
- ✅ `import x from 'dev/postcss'`
- ✅ `import x from 'dev/vite'`
- ❌ `import x from '@revealui/dev/...'` (incorrect)

## Notes

- All configs use ESM (ES Modules) - no CommonJS
- Configs are designed to be extended, not used directly
- TypeScript configs use relative paths because JSON `extends` doesn't support package imports
- Import paths use the package name directly: `dev/...` (workspace protocol)
