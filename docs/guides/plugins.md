# Plugins Guide

Extend RevealUI with plugins.

## Using Plugins

Add plugins in `reveal.config.ts`:

```typescript
import { defineConfig } from "reveal/config";
import react from "reveal/plugins/react";
import payload from "reveal/plugins/payload";

export default defineConfig({
  plugins: [
    react(),
    payload({
      serverURL: process.env.PAYLOAD_SERVER_URL,
    }),
  ],
});
```

## Built-in Plugins

### React Plugin

Provides React 19 integration:

```typescript
import react from "reveal/plugins/react";

plugins: [
  react({
    strictMode: true,
    useSwc: true,
  }),
]
```

### PayloadCMS Plugin

Integrates PayloadCMS:

```typescript
import payload from "reveal/plugins/payload";

plugins: [
  payload({
    serverURL: "http://localhost:4000",
    collections: ["posts", "pages"],
  }),
]
```

### Vercel Plugin

Optimizes for Vercel deployment:

```typescript
import vercel from "reveal/plugins/vercel";

plugins: [vercel()]
```

## Creating Custom Plugins

Create a plugin:

```typescript
import { createRevealPlugin } from "reveal/plugin";

export default createRevealPlugin("my-plugin", (options) => ({
  revealConfigResolved(context) {
    // Plugin logic
  },
}));
```

## Plugin Lifecycle

Plugins have access to lifecycle hooks:

- `revealPluginInit` - Called when plugin is initialized
- `revealConfigResolved` - Called when config is resolved
- `revealReady` - Called when framework is ready

## Learn More

- [API Reference](../api-reference/plugins.md)
- [Plugin Development Guide](../guides/plugin-development.md)

