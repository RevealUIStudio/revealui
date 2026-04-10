/**
 * RevealUI Plugin Types
 *
 * Defines plugin interfaces.
 *
 * @module @revealui/core/types/plugins
 */

import type { Config } from '@revealui/contracts/admin';

// =============================================================================
// PLUGINS
// =============================================================================

/**
 * Plugin function that transforms config
 * Uses the schema's Config type for compatibility
 */
export type Plugin = (config: Config) => Config | Promise<Config>;

export interface PluginOptions {
  [key: string]: unknown;
}
