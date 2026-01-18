/**
 * Shared PostCSS Configuration for RevealUI Framework
 *
 * This config provides PostCSS plugins for Tailwind CSS processing.
 * Used by apps and packages that need Tailwind CSS compilation.
 */
import type { Config } from 'postcss-load-config'

const config: Config = {
  plugins: {
    'postcss-import': {
      path: ['src'],
    },
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}

export default config
