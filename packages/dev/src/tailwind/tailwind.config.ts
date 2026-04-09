/**
 * Shared Tailwind CSS Configuration for RevealUI Framework
 *
 * This config provides common Tailwind settings, plugins, and theme extensions
 * used across RevealUI apps and packages.
 *
 * @example
 * ```typescript
 * import tailwindConfig from '@revealui/dev/tailwind'
 *
 * export default {
 *   ...tailwindConfig,
 *   content: ['./src/**\/*.{ts,tsx}'],
 * }
 * ```
 */
import aspectRatio from '@tailwindcss/aspect-ratio';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const fontFamily = defaultTheme?.fontFamily || {};

const config: Config = {
  darkMode: 'class',
  theme: {
    screens: {
      ...defaultTheme.screens,
    },
    container: {
      center: true,
    },
    aspectRatio: {
      ...defaultTheme.aspectRatio,
    },
    fontFamily: {
      sans: ['Inter', ...(fontFamily.sans || [])],
      serif: ['Merriweather', ...(fontFamily.serif || [])],
    },
    extend: {
      screens: {
        xs: '475px',
        '3xl': '1920px',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Merriweather', 'serif'],
      },
      maxWidth: {
        '8xl': '1920px',
      },
      aspectRatio: {
        '3/2': '3 / 2',
        '4/3': '4 / 3',
        '21/9': '21 / 9',
        '16/9': '16 / 9',
        '1/1': '1 / 1',
      },
    },
  },
  plugins: [typography, forms, aspectRatio],
};

export default config;
