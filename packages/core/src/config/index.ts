import { ConfigValidationError, validateConfigStructure } from '@revealui/contracts/cms'
import type { Config } from '../types/index.js'
import { deepMerge } from './utils.js'

export function buildConfig(config: Config): Config {
  // Validate the configuration structure using ConfigContract
  // This provides runtime validation with detailed error messages
  const validationResult = validateConfigStructure(config)
  if (!validationResult.success) {
    // Use ConfigValidationError for structured error reporting
    throw new ConfigValidationError(validationResult.errors, 'config')
  }

  // Type narrowing: after validation, we know the structure is valid
  // The validated config structure matches ConfigContractType
  const validatedConfig = validationResult.data as unknown as Config

  // Apply default values
  // Use validatedConfig as base to ensure type safety
  const defaultConfig: Partial<Config> = {
    serverURL: process.env.REVEALUI_PUBLIC_SERVER_URL || '',
    admin: {
      importMap: {
        autoGenerate: true,
      },
      ...validatedConfig.admin,
    },
    typescript: {
      autoGenerate: true,
      outputFile: 'src/types/revealui.ts',
      ...validatedConfig.typescript,
    },
    localization: {
      locales: ['en'],
      defaultLocale: 'en',
      fallback: true,
      ...(typeof validatedConfig.localization === 'object' ? validatedConfig.localization : {}),
    },
    collections: validatedConfig.collections || [],
    globals: validatedConfig.globals || [],
    plugins: validatedConfig.plugins || [],
  }

  // Merge with user config (use original config to preserve function contracts)
  const finalConfig = deepMerge<Config>(defaultConfig, config)

  // Apply plugins
  if (Array.isArray(finalConfig.plugins)) {
    for (const plugin of finalConfig.plugins) {
      if (typeof plugin === 'function') {
        const pluginFn = plugin as (config: Config) => Config
        const result = pluginFn(finalConfig)
        if (result && typeof (result as unknown as Promise<Config>).then === 'function') {
          throw new Error('Async plugins are not supported in buildConfig.')
        }
        Object.assign(finalConfig, result)
      }
    }
  }

  return finalConfig
}
