# PostCSS Configuration

Shared PostCSS configuration for the RevealUI Framework.

## Usage

Import the shared PostCSS config in your `postcss.config.ts`:

```ts
import postcssConfig from 'dev/postcss'

export default postcssConfig
```

## Plugins

The config includes:
- `postcss-import` - Import CSS files with `@import`
- `@tailwindcss/postcss` - Tailwind CSS 4.0 PostCSS plugin
- `autoprefixer` - Automatic vendor prefixes

## Configuration

The config sets `postcss-import` to look for files in the `src` directory. If you need to customize this, you can extend the config:

```ts
import postcssConfig from 'dev/postcss'

export default {
  ...postcssConfig,
  plugins: {
    ...postcssConfig.plugins,
    'postcss-import': {
      path: ['src', 'styles'], // Add additional paths
    },
  },
}
```
