/**
 * RevealUI Plugin Types
 *
 * Defines plugin interfaces.
 *
 * @module @revealui/cms/types/plugins
 */

import type { Config } from '@revealui/schema/cms'

// =============================================================================
// PLUGINS
// =============================================================================

/**
 * Plugin function that transforms config
 * Uses the schema's Config type for compatibility
 */
export type Plugin = (config: Config) => Config | Promise<Config>

export interface PluginOptions {
  [key: string]: unknown
}
