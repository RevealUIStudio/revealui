# Plugin System Migration Guide

This guide helps you migrate from the old plugin system to the new RevealUI plugin API.

## Overview

The new plugin system provides:
- Standardized plugin interface
- Lifecycle hooks
- Dependency resolution
- Better type safety
- Plugin registry

## Migration Steps

### Step 1: Update Plugin Structure

**Old Way:**
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    react(),
    revealui(),
  ],
})
```

**New Way:**
```typescript
// reveal.config.ts
import { defineConfig } from 'reveal/config'
import react from 'reveal/plugins/react'
import revealui from 'reveal/plugins/revealui'

export default defineConfig({
  plugins: [
    react(),
    revealui(),
  ],
})
```

### Step 2: Create Custom Plugins

**Old Way:**
```typescript
// vite.config.ts
function myPlugin() {
  return {
    name: 'my-plugin',
    configResolved(config) {
      // Plugin logic
    },
  }
}
```

**New Way:**
```typescript
// my-plugin.ts
import { definePlugin } from 'reveal/plugin'

export default definePlugin({
  name: 'my-plugin',
  revealConfigResolved(context) {
    // Access RevealUI config
    const { revealConfig, viteConfig } = context
    // Plugin logic
  },
})
```

### Step 3: Use Plugin Lifecycle Hooks

The new system provides RevealUI-specific hooks:

```typescript
import { definePlugin } from 'reveal/plugin'

export default definePlugin({
  name: 'my-plugin',
  
  // Called when RevealUI config is resolved
  revealConfigResolved(context) {
    // Access resolved config
  },
  
  // Called when plugin is initialized
  revealPluginInit(context) {
    // Setup plugin
  },
  
  // Called when RevealUI is ready
  revealReady(context) {
    // Final setup
  },
  
  // Standard Vite hooks still work
  configResolved(config) {
    // Vite config resolved
  },
})
```

### Step 4: Handle Dependencies

Declare plugin dependencies:

```typescript
export default definePlugin({
  name: 'my-plugin',
  dependencies: ['@revealui/plugin-react'],
  revealConfigResolved(context) {
    // React plugin is guaranteed to be loaded first
  },
})
```

## Plugin Examples

### React Plugin
```typescript
import { definePlugin } from 'reveal/plugin'
import react from '@vitejs/plugin-react-swc'

export default definePlugin({
  name: '@revealui/plugin-react',
  vitePlugins: () => react(),
  revealConfigResolved(context) {
    // Ensure React 19 is being used
  },
})
```

### Custom Config Plugin
```typescript
import { definePlugin } from 'reveal/plugin'

export default definePlugin({
  name: 'my-config-plugin',
  revealConfig(config) {
    // Modify config before resolution
    return {
      ...config,
      customSetting: true,
    }
  },
})
```

## Plugin Registry

Plugins are automatically registered when added to the config:

```typescript
// reveal.config.ts
export default defineConfig({
  plugins: [
    react(), // Automatically registered
    payload(), // Automatically registered
  ],
})
```

## Type Safety

Plugins are fully typed:

```typescript
import type { RevealPlugin } from 'reveal/plugin'

const myPlugin: RevealPlugin = {
  name: 'my-plugin',
  revealConfigResolved(context) {
    // context is fully typed
    context.revealConfig // Type: ResolvedRevealConfig
    context.viteConfig // Type: ResolvedConfig
  },
}
```

## Troubleshooting

### Plugin not loading?
- Check plugin is in `plugins` array
- Verify plugin exports default
- Check for dependency conflicts

### Type errors?
- Ensure plugin implements `RevealPlugin` interface
- Check plugin name is unique
- Verify dependencies are installed

### Lifecycle hooks not firing?
- Check hook names (use `revealConfigResolved`, not `configResolved`)
- Verify plugin is registered
- Check for errors in plugin code

## Next Steps

After migration:
1. Test plugins: `pnpm dev`
2. Verify plugin order (dependencies)
3. Check for deprecation warnings
4. Update plugin documentation

## Support

For plugin development:
- See [Plugin API Reference](./api-reference/plugins.md)
- Check [Plugin Examples](./guides/plugins.md)
- Review [Known Limitations](./KNOWN-LIMITATIONS.md)

