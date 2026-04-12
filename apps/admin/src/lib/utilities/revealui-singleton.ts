/**
 * RevealUI singleton accessor for the admin app.
 *
 * Caches the RevealUI instance at module scope so that every route handler
 * and utility shares a single initialized instance instead of creating a new
 * one (and a new DB connection) per request.
 *
 * Usage:
 *   import { getRevealUIInstance } from '@/lib/utilities/revealui-singleton'
 *   const revealui = await getRevealUIInstance()
 *
 * Note: Do NOT use this in tests  -  import getRevealUI directly and pass a
 * test config so each test suite gets an isolated instance.
 */

import type { RevealUIInstance } from '@revealui/core';
import { getRevealUI } from '@revealui/core/nextjs';
import config from '../../../revealui.config';

let _instance: RevealUIInstance | null = null;

export async function getRevealUIInstance(): Promise<RevealUIInstance> {
  if (!_instance) {
    _instance = await getRevealUI({ config });
  }
  return _instance;
}

/**
 * Reset the cached instance. Useful for testing and hot-reload scenarios.
 */
export function resetRevealUIInstance(): void {
  _instance = null;
}
