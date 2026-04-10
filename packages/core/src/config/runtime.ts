import type { Config as ContractsConfig } from '@revealui/contracts/admin';
import type { RevealConfig, RevealUIInstance } from '../types/index.js';

/** Accepted config types for getRevealUI */
type AcceptedConfig = RevealConfig | ContractsConfig | Record<string, unknown>;

let revealInstance: RevealUIInstance | null = null;
let configInstance: AcceptedConfig | null = null;

/**
 * Creates or returns a cached RevealUI instance
 *
 * @param options.config - RevealUI configuration object. Accepts:
 *   - `RevealConfig`: Framework configuration type (preferred for type safety)
 *   - `Config` from @revealui/contracts/admin: admin configuration from buildConfig()
 *   - `Record<string, unknown>`: Loose typing for flexibility
 *
 * Note: Generated Config types have a different structure (collections as record vs array)
 * but are runtime-compatible. The function accepts both for convenience.
 *
 * @returns A RevealUI instance that provides admin functionality
 */
export async function getRevealUI(options: { config: AcceptedConfig }): Promise<RevealUIInstance> {
  // In development, always create a new instance to support HMR
  if (process.env.NODE_ENV === 'development') {
    revealInstance = null;
    configInstance = null;
  }

  if (revealInstance && configInstance === options.config) {
    return revealInstance;
  }

  // Import the RevealUI implementation
  const { createRevealUIInstance } = await import('../revealui.js');

  // Type assertion is safe here: generated Config types are runtime-compatible with RevealConfig
  // even though TypeScript sees them as structurally different types
  revealInstance = await createRevealUIInstance(options.config as RevealConfig);
  configInstance = options.config as RevealConfig;

  return revealInstance;
}
