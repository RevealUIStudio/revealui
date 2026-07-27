import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import type { RunContext } from './types.js';

/**
 * A plain local run context: this machine's hostname and a fresh run id.
 * Not independently attributable (see the honesty note in `verify.ts`) —
 * it's just enough to tell two receipts on your own disk apart.
 */
export function localRunContext(): RunContext {
  return { runnerId: hostname(), runId: randomUUID() };
}
