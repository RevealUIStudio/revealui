# Configuration API Reference

The RevealUI configuration system provides a unified way to configure your application.

## defineConfig

Main configuration function for RevealUI. This is the entry point for `reveal.config.ts` files.

```typescript
import { defineConfig } from "reveal/config";
import react from "reveal/plugins/react";
import payload from "reveal/plugins/payload";

export default defineConfig({
  plugins: [react(), payload()],
  revealui: {
    prerender: true,
  },
});
```

### Configuration Options

#### plugins

Array of RevealUI plugins to use. Plugins are loaded in order, respecting dependencies.

```typescript
plugins: [
  react(),
  payload({
    serverURL: process.env.PAYLOAD_SERVER_URL,
  }),
  vercel(),
]
```

**Type:** `RevealPlugin[]`

#### revealui

RevealUI-specific configuration. Merges with any existing `+config.ts` files.

```typescript
revealui: {
  /** Enable pre-rendering */
  prerender: true | { partial: boolean },
  
  /** Base server URL */
  baseServer: "/",
  
  /** Base assets URL */
  baseAssets: "/",
  
  /** Trailing slash handling */
  trailingSlash: boolean,
  
  /** Redirects configuration */
  redirects: Array<{ from: string; to: string; status?: number }>,
}
```

**Type:** `Partial<Config>`

#### nextjs

Next.js-specific configuration (for CMS app). Merges with `next.config.mjs`.

```typescript
nextjs: {
  /** Output mode */
  output: "standalone" | "export",
  
  /** Experimental features */
  experimental: {
    serverActions: true,
    instrumentationHook: true,
  },
  
  /** Image optimization */
  images: {
    domains: ["example.com"],
  },
}
```

**Type:** `Partial<NextConfig>`

#### payload

PayloadCMS configuration.

```typescript
payload: {
  /** PayloadCMS server URL */
  serverURL: "http://localhost:4000",
  
  /** Collections to enable */
  collections: ["posts", "pages"],
  
  /** Custom PayloadCMS config path */
  configPath?: string,
}
```

**Type:** `PayloadConfig`

#### extends

Extend existing RevealUI configurations. Allows gradual migration.

```typescript
extends: [
  // Path to existing +config.ts file
  "./src/pages/+config.ts",
]
```

**Type:** `Config | Config[]`

## Environment-Specific Configuration

Override configuration per environment using the `env` option:

```typescript
export default defineConfig({
  plugins: [react()],
  
  env: {
    development: {
      revealui: { prerender: false },
      nextjs: {
        experimental: {
          instrumentationHook: false,
        },
      },
    },
    production: {
      revealui: { prerender: true },
      nextjs: {
        output: "standalone",
      },
    },
    test: {
      revealui: { prerender: false },
    },
  },
});
```

## Configuration Validation

The configuration is validated using Zod schemas. Invalid configurations will throw errors:

```typescript
// ❌ This will throw an error
export default defineConfig({
  prerender: "invalid", // Must be boolean or object
});

// ✅ This is valid
export default defineConfig({
  prerender: true,
});
```

## Configuration Resolution

Configurations are resolved in this order:

1. Default values
2. User-provided config (`reveal.config.ts`)
3. Environment-specific overrides (`env.development`, etc.)
4. Environment variables (if configured)

## Type Safety

The configuration is fully typed. Use TypeScript for autocomplete and type checking:

```typescript
import { defineConfig } from "reveal/config";
import type { RevealUserConfig } from "reveal/config";

const config: RevealUserConfig = {
  plugins: [react()],
  // TypeScript will autocomplete available options
};
```

## Complete Example

```typescript
import { defineConfig } from "reveal/config";
import react from "reveal/plugins/react";
import payload from "reveal/plugins/payload";
import vercel from "reveal/plugins/vercel";

export default defineConfig({
  plugins: [
    react({
      strictMode: true,
    }),
    payload({
      serverURL: process.env.PAYLOAD_SERVER_URL || "http://localhost:4000",
    }),
    vercel(),
  ],
  
  revealui: {
    prerender: {
      partial: false,
      parallel: 4,
    },
    baseServer: "/",
    baseAssets: "/",
  },
  
  nextjs: {
    output: "standalone",
    experimental: {
      instrumentationHook: true,
    },
  },
  
  env: {
    development: {
      revealui: {
        prerender: false,
      },
    },
    production: {
      revealui: {
        prerender: true,
      },
    },
  },
});
```

## Learn More

- [Configuration Guide](../guides/configuration.md)
- [Migration Guide](../migration/config-system.md)
- [Plugins API](./plugins.md)

