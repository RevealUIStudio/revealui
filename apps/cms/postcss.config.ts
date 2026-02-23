/**
 * PostCSS Configuration for CMS App
 *
 * Sets `base` to the monorepo root so Tailwind v4's content scanner
 * finds source files across all workspace packages (presentation,
 * core, auth, etc.), not just this app directory.
 */
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const postcssConfig = {
  plugins: {
    '@tailwindcss/postcss': {
      base: resolve(__dirname, '../..'),
    },
  },
}

export default postcssConfig
