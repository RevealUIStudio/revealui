/**
 * Codemod registry — central list of every migration transform shipped
 * with this CLI. New codemods must be added here to be discoverable by
 * `revealui migrate`.
 *
 * Ordering matters: the runner applies codemods in array order when
 * multiple are applicable in a single run. Keep them in chronological
 * release order (oldest first) so migrations compose predictably across
 * multi-version upgrades.
 */

import { passwordHasherToAuth } from './transforms/password-hasher-to-auth.js';
import type { Codemod } from './types.js';

export const registry: readonly Codemod[] = [passwordHasherToAuth];

export function getCodemod(name: string): Codemod | undefined {
  return registry.find((c) => c.name === name);
}
