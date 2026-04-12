# dev

Shared development tooling and configuration for the RevealUI Framework monorepo.

**Package Name**: `dev` (unscoped workspace package)
**Import Format**: `dev/...` (e.g., `dev/tailwind/create-config`)

## Overview

This package provides centralized configuration files for:
- **Biome** - Fast formatting and linting (sole linter)
- **Tailwind CSS** - Shared styling configuration
- **Vite** - Build tool configuration
- **TypeScript** - Compiler configurations for different project types

## Exports

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

## Usage Examples

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
- `pnpm lint` - Run Biome across the repo
- `pnpm format` - Format code with Biome

### Adding New Configs

1. Create config file in appropriate directory (`src/biome/`, `src/tailwind/`, etc.)
2. Add export to `package.json` `exports` field
3. Document in relevant README
4. Update this README if it's a new category

## Package Naming

This package is named `dev` (unscoped) in the monorepo workspace. Use `dev/...` import paths:

- ✅ `import x from 'dev/tailwind/create-config'`
- ✅ `import x from 'dev/postcss'`
- ✅ `import x from 'dev/vite'`
- ❌ `import x from '@revealui/dev/...'` (incorrect)

## When to Use This

- You're adding a new app or package to the monorepo and need shared Biome, TypeScript, or Tailwind config
- You want consistent formatting and linting rules across all workspaces
- You need a base Vite config with common aliases and build settings
- **Not** for runtime configuration  -  use `@revealui/config` for environment variables
- **Not** for editor-specific settings  -  use `@revealui/editors` for VS Code, Zed, and Cursor configs

## JOSHUA Alignment

- **Unified**: One package defines formatting, linting, and TypeScript rules for every workspace in the monorepo
- **Orthogonal**: Biome, Tailwind, Vite, and TypeScript configs are independent subpath exports  -  change one without affecting the others
- **Justifiable**: Each config exists because the monorepo needs consistent defaults  -  no opinion without a reason

## Notes

- All configs use ESM (ES Modules) - no CommonJS
- Configs are designed to be extended, not used directly
- TypeScript configs use relative paths because JSON `extends` doesn't support package imports
- Import paths use the package name directly: `dev/...` (workspace protocol)
