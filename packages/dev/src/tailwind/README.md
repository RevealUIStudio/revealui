# Tailwind CSS Configuration

Shared Tailwind CSS configuration for the RevealUI Framework.

## Usage

### Option 1: Direct Import (Simple)

For basic usage, import and extend the shared config:

```ts
import tailwindConfig from 'dev/tailwind'

export default {
  ...tailwindConfig,
  content: ['./src/**/*.{ts,tsx}'],
}
```

### Option 2: Helper Function (Recommended)

For apps that need to extend the theme, use the `createTailwindConfig` helper:

```ts
import { createTailwindConfig } from 'dev/tailwind/create-config'

export default createTailwindConfig({
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'media', // Override default 'class'
  theme: {
    extend: {
      colors: {
        // App-specific colors (merged with shared colors)
      },
      screens: {
        // App-specific breakpoints (merged with shared)
      },
    },
  },
  safelist: ['bg-custom', 'text-custom'], // App-specific safelist
})
```

## Features

The shared config includes:

- **Plugins**: typography, forms, aspect-ratio
- **Theme**: Inter/Merriweather fonts, common aspect ratios, responsive screens
- **Dark Mode**: Class-based by default (can be overridden)
- **Base Settings**: Container centering, default theme extensions

## Helper Function Benefits

The `createTailwindConfig` helper:

- ✅ Deep merges `theme.extend` (app extensions + shared extensions)
- ✅ Preserves shared plugins automatically
- ✅ Requires only `content` to be specified
- ✅ Allows overriding any config option
- ✅ Reduces duplication significantly

## Example: App with Custom Colors

```ts
import { createTailwindConfig } from 'dev/tailwind/create-config'

export default createTailwindConfig({
  content: ['./src/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#ea580c',
          secondary: '#fde047',
        },
      },
    },
  },
})
```

The app will get:
- All shared theme settings (fonts, aspect ratios, etc.)
- App-specific colors merged in
- All shared plugins
- Only needs to specify content paths
