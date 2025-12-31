# Configuration System Migration Guide

This guide helps you migrate from the old configuration system to the new unified `reveal.config.ts` system.

## Overview

The new configuration system provides:
- Single `reveal.config.ts` entry point
- Type-safe configuration with Zod validation
- Unified plugin system
- Environment-specific overrides
- Better IDE autocomplete

## Migration Steps

### Step 1: Create `reveal.config.ts`

Create a new `reveal.config.ts` file in your project root:

```typescript
// reveal.config.ts
import { defineConfig } from 'reveal/config'
import react from 'reveal/plugins/react'
import payload from 'reveal/plugins/payload'
import vercel from 'reveal/plugins/vercel'

export default defineConfig({
  plugins: [
    react(),
    payload(),
    vercel(),
  ],
  prerender: {
    partial: false,
    parallel: 4,
  },
})
```

### Step 2: Migrate from `+config.ts`

If you have existing `+config.ts` files, you can:

**Option A: Keep both (gradual migration)**
- The new system will merge with existing `+config.ts` files
- You can migrate settings incrementally

**Option B: Migrate everything**
- Move all settings from `+config.ts` to `reveal.config.ts`
- Remove `+config.ts` files

### Step 3: Update Vite Config

Your `vite.config.ts` should import the RevealUI plugin:

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import reveal from 'reveal/plugin'

export default defineConfig({
  plugins: [
    reveal({
      // Your reveal.config.ts will be automatically loaded
    }),
  ],
})
```

### Step 4: Environment-Specific Configuration

Use environment variables or separate config files:

```typescript
// reveal.config.ts
import { defineConfig } from 'reveal/config'

export default defineConfig({
  prerender: process.env.NODE_ENV === 'production',
  // ... other config
})
```

Or use separate files:

```typescript
// reveal.config.production.ts
export { default } from './reveal.config.base'
```

## Configuration Mapping

### Old System → New System

| Old (`+config.ts`) | New (`reveal.config.ts`) |
|-------------------|-------------------------|
| `prerender` | `prerender` |
| `baseServer` | `baseServer` |
| `baseAssets` | `baseAssets` |
| `redirects` | `redirects` |
| `trailingSlash` | `trailingSlash` |
| Vite plugins | `plugins` array |

## Plugin Migration

### Old Way
```typescript
// vite.config.ts
import react from '@vitejs/plugin-react'
import revealui from 'revealui/plugin'

export default defineConfig({
  plugins: [react(), revealui()],
})
```

### New Way
```typescript
// reveal.config.ts
import { defineConfig } from 'reveal/config'
import react from 'reveal/plugins/react'
import revealui from 'reveal/plugins/revealui'

export default defineConfig({
  plugins: [react(), revealui()],
})
```

## Validation

The new system validates your configuration:

```typescript
// Invalid config will throw an error
export default defineConfig({
  prerender: "invalid", // ❌ Error: must be boolean or object
})
```

## Backward Compatibility

- Existing `+config.ts` files continue to work
- Old Vite config patterns are supported
- Gradual migration is possible

## Troubleshooting

### Config not loading?
- Ensure `reveal.config.ts` is in project root
- Check that `defineConfig` is used
- Verify file exports default config

### Type errors?
- Install `reveal` package: `pnpm add reveal`
- Ensure TypeScript can resolve `reveal/config`

### Plugin not working?
- Check plugin is in `plugins` array
- Verify plugin is installed: `pnpm add @revealui/plugin-<name>`
- Check plugin compatibility with your RevealUI version

## Next Steps

After migration:
1. Test your build: `pnpm build`
2. Test dev server: `pnpm dev`
3. Verify prerendering: `pnpm reveal prerender`
4. Check for deprecation warnings

## Support

For issues during migration:
- Check [Known Limitations](./KNOWN-LIMITATIONS.md)
- Open a GitHub issue
- Review [API Documentation](./api-reference/config.md)

