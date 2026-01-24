# TypeScript Configurations

This directory contains shared TypeScript configuration files for different project types in the RevealUI monorepo.

## Available Configs

### `base.json`
Base TypeScript configuration with common compiler options. All other configs extend this.

**Features**:
- Strict mode enabled
- ES Module interop
- Bundler module resolution
- Source maps enabled

**Usage**: Extend this in other configs, don't use directly.

### `library.json`
Configuration for simple library packages (no React, no DOM).

**Extends**: `base.json`

**Features**:
- ES2022 target and lib
- ESNext modules
- Declaration files enabled
- Source maps enabled
- Strict unused variable/parameter checking

**Usage**: For simple TypeScript libraries like `packages/db`, `packages/config`, `packages/schema`.

### `react-library.json`
Configuration for React library packages.

**Extends**: `base.json`

**Features**:
- React JSX support (`react-jsx`)
- ES2022 target
- ESNext modules

**Usage**: For React component libraries or shared UI packages.

### `revealui.json`
Configuration for RevealUI framework packages.

**Extends**: `base.json`

**Features**:
- React JSX support
- Path mappings for `revealui/*` imports
- Vite client types
- DOM and DOM.Iterable libs

**Usage**: For packages in the `packages/core` directory.

### `vite.json`
Configuration for Vite-based applications.

**Extends**: `react-library.json`

**Features**:
- Vite-specific settings
- JSX preserve mode (for Vite to handle)
- DOM libraries
- Bundler module resolution

**Usage**: For apps using Vite (e.g., `apps/web`).

### `nextjs.json`
Configuration for Next.js applications.

**Extends**: `react-library.json`

**Features**:
- Next.js plugin support
- JSX preserve mode (for Next.js to handle)
- No declaration files (Next.js handles this)
- Incremental compilation

**Usage**: For Next.js apps (e.g., `apps/cms`).

## Usage Examples

### In a Next.js App (`apps/cms/tsconfig.json`)
```json
{
  "extends": "../../packages/dev/src/ts/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "next-env.d.ts"]
}
```

### In a Vite App (`apps/web/tsconfig.json`)
```json
{
  "extends": "../../packages/dev/src/ts/vite.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

### In a React Library (`packages/ui/tsconfig.json`)
```json
{
  "extends": "../dev/src/ts/react-library.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

## Path Resolution

All configs use `moduleResolution: "bundler"` which is the modern approach for:
- Vite
- Next.js 16+
- Modern bundlers

This allows for:
- ESM and CommonJS interop
- Package.json `exports` field support
- Better tree-shaking

## Type Checking

All configs have `strict: true` enabled. This includes:
- `noImplicitAny`
- `strictNullChecks`
- `strictFunctionTypes`
- `strictBindCallApply`
- `strictPropertyInitialization`
- `noImplicitThis`
- `alwaysStrict`

## Notes

- Config files use relative paths, so they work from any package/app directory
- Each package/app should extend the appropriate config and add its own `include`/`exclude`
- Path mappings should be defined in the extending config, not in base configs
