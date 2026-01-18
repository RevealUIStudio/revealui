/**
 * Helper function to create Tailwind configs that extend the shared base config
 *
 * This function merges the shared Tailwind config with app-specific overrides,
 * allowing apps to only specify what's different (content paths, safelist, etc.)
 * while inheriting all shared theme settings and plugins.
 *
 * @example
 * ```typescript
 * import { createTailwindConfig } from 'dev/tailwind/create-config'
 *
 * export default createTailwindConfig({
 *   content: ['./src/**\/*.{ts,tsx}'],
 *   theme: {
 *     extend: {
 *       colors: {
 *         // App-specific colors
 *       }
 *     }
 *   }
 * })
 * ```
 */
import { deepMerge } from '@revealui/core'
import type { Config } from 'tailwindcss'
import sharedConfig from './tailwind.config.ts'

/**
 * Create a Tailwind config by merging app-specific overrides with shared config
 *
 * @param overrides - App-specific config overrides
 * @returns Complete Tailwind config
 */
export function createTailwindConfig(
  overrides: Partial<Config> & {
    content: string | string[]
  },
): Config {
  const merged: Config = {
    ...sharedConfig,
    ...overrides,
    theme: overrides.theme
      ? {
          ...sharedConfig.theme,
          ...overrides.theme,
          extend: overrides.theme?.extend
            ? deepMerge(
                (sharedConfig.theme?.extend as Record<string, unknown>) || {},
                overrides.theme.extend as Record<string, unknown>,
              )
            : sharedConfig.theme?.extend,
        }
      : sharedConfig.theme,
    plugins: overrides.plugins || sharedConfig.plugins,
  }

  return merged
}
