# Plugins API Reference

The RevealUI plugin system allows you to extend the framework with custom functionality.

## RevealPlugin Interface

```typescript
import type { Plugin } from "vite";
import type { RevealPluginContext } from "reveal/plugin";

interface RevealPlugin extends Plugin {
  /** Unique plugin name (required) */
  name: string;
  
  /** Plugin version (optional, for dependency resolution) */
  version?: string;
  
  /** Plugin dependencies (other plugins this plugin requires) */
  dependencies?: string[];
  
  /** Plugin conflicts (plugins this plugin conflicts with) */
  conflicts?: string[];
  
  /** Called when plugin is initialized */
  revealPluginInit?: (context: RevealPluginContext) => void | Promise<void>;
  
  /** Called when RevealUI config is resolved */
  revealConfigResolved?: (context: RevealPluginContext) => void | Promise<void>;
  
  /** Called when RevealUI is ready */
  revealReady?: (context: RevealPluginContext) => void | Promise<void>;
}
```

## createRevealPlugin

Helper function to create plugins with type safety:

```typescript
import { createRevealPlugin } from "reveal/plugin";

interface MyPluginOptions {
  apiKey?: string;
  enabled?: boolean;
}

export default createRevealPlugin<MyPluginOptions>("my-plugin", (options) => ({
  revealConfigResolved(context) {
    if (options?.enabled && options?.apiKey) {
      // Initialize plugin with API key
      console.log("Plugin initialized with API key");
    }
  },
  
  // Standard Vite hooks also work
  configResolved(config) {
    // Modify Vite config if needed
  },
}));
```

## Plugin Context

Plugins receive a context object with access to configuration and runtime information:

```typescript
interface RevealPluginContext {
  /** Resolved Vite configuration */
  viteConfig: ResolvedConfig;
  
  /** Resolved RevealUI configuration */
  revealConfig: ConfigRevealUserProvided;
  
  /** Vite dev server (only available in dev mode) */
  devServer?: ViteDevServer;
  
  /** Plugin options passed to the plugin */
  options: Record<string, unknown>;
}
```

### Example: Accessing Context

```typescript
export default createRevealPlugin("my-plugin", (options) => ({
  revealConfigResolved(context) {
    // Access Vite config
    const { root, build } = context.viteConfig;
    
    // Access RevealUI config
    const { plugins, prerender } = context.revealConfig;
    
    // Access dev server (dev mode only)
    if (context.devServer) {
      context.devServer.ws.on("connection", (socket) => {
        // Handle WebSocket connections
      });
    }
    
    // Access plugin options
    const myOption = context.options.myOption;
  },
}));
```

## Lifecycle Hooks

### revealPluginInit

Called when the plugin is first initialized, before any configuration is resolved.

```typescript
revealPluginInit(context) {
  // Setup plugin infrastructure
  // Note: viteConfig and revealConfig may not be fully resolved yet
}
```

### revealConfigResolved

Called after both Vite and RevealUI configurations are resolved. This is the most common hook for plugin logic.

```typescript
revealConfigResolved(context) {
  // Access fully resolved configurations
  const { viteConfig, revealConfig } = context;
  
  // Modify configurations if needed
  // Register middleware, add routes, etc.
}
```

### revealReady

Called when the framework is fully ready and all plugins are loaded.

```typescript
revealReady(context) {
  // Final setup after all plugins are ready
  // Start background services, etc.
}
```

## Plugin Dependencies

Declare dependencies to ensure plugins load in the correct order:

```typescript
export default createRevealPlugin("my-plugin", () => ({
  dependencies: ["@revealui/plugin-react"],
  revealConfigResolved(context) {
    // React plugin is guaranteed to be loaded first
  },
}));
```

## Plugin Conflicts

Declare conflicts to prevent incompatible plugins from being used together:

```typescript
export default createRevealPlugin("my-plugin", () => ({
  conflicts: ["@revealui/plugin-vue"],
  // If Vue plugin is also loaded, an error will be thrown
}));
```

## Complete Example

```typescript
import { createRevealPlugin } from "reveal/plugin";
import type { RevealPluginContext } from "reveal/plugin";

interface AnalyticsOptions {
  trackingId: string;
  enabled: boolean;
}

export default createRevealPlugin<AnalyticsOptions>("analytics", (options) => {
  if (!options?.enabled || !options?.trackingId) {
    return {
      name: "analytics",
      // Plugin disabled, return minimal plugin
    };
  }

  return {
    name: "analytics",
    revealConfigResolved(context) {
      // Inject analytics script
      const script = `
        window.analytics = {
          trackingId: "${options.trackingId}",
          track: function(event) {
            // Track event
          }
        };
      `;
      
      // Add to HTML head
      // (Implementation depends on your needs)
    },
    revealReady(context) {
      console.log("Analytics plugin ready");
    },
  };
});
```

## Learn More

- [Plugins Guide](../guides/plugins.md)
- [Plugin Development Guide](../guides/plugin-development.md)
- [Configuration API](./config.md)

