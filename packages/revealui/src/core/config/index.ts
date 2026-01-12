import type { Config } from '../types/index'
import { deepMerge, validateConfig } from './utils'

export function buildConfig(config: Config): Config {
  // Validate the configuration
  validateConfig(config)

  // Apply default values
  const defaultConfig: Partial<Config> = {
    serverURL: process.env.REVEALUI_PUBLIC_SERVER_URL || '',
    admin: {
      importMap: {
        autoGenerate: true,
      },
      ...config.admin,
    },
    typescript: {
      autoGenerate: true,
      outputFile: 'src/types/revealui.ts',
      ...config.typescript,
    },
    localization: {
      locales: ['en'],
      defaultLocale: 'en',
      fallback: true,
      ...(typeof config.localization === 'object' ? config.localization : {}),
    },
    collections: config.collections || [],
    globals: config.globals || [],
    plugins: config.plugins || [],
  }

  // Merge with user config
  const finalConfig = deepMerge<Config>(defaultConfig, config)

  // Apply plugins
  if (Array.isArray(finalConfig.plugins)) {
    for (const plugin of finalConfig.plugins) {
      if (typeof plugin === 'function') {
        Object.assign(finalConfig, plugin(finalConfig))
      }
    }
  }

  return finalConfig
}
