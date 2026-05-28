# PostCSS Configuration

Shared PostCSS configuration for the RevealUI Framework.

## Usage

Import the shared PostCSS config in your `postcss.config.ts`:

```ts
import postcssConfig from '@revealui/dev/postcss'

export default postcssConfig
```

## Plugins

The config includes:
- `@tailwindcss/postcss` - Tailwind CSS v4 PostCSS plugin (handles imports and auto-prefixing natively; no separate `postcss-import` or `autoprefixer` needed)

## Configuration

The config is minimal — Tailwind CSS v4 handles everything via its own PostCSS plugin. To extend:

```ts
import postcssConfig from '@revealui/dev/postcss'

export default {
  ...postcssConfig,
  plugins: {
    ...postcssConfig.plugins,
    // add project-specific plugins here
  },
}
```
