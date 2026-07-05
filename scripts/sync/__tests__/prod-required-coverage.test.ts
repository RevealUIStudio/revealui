/**
 * GAP-259 P0-5 — prod-required coverage.
 *
 * Asserts that validate-startup's boot-time enforcement (REQUIRED_IN_PRODUCTION_HOSTED
 * ∪ the REQUIRED_ALWAYS_GROUPS alias groups) is a SUPERSET of every canonical
 * SECRET_PATHS entry flagged `requiredInProdHosted`. This closes the license/secret
 * path drift class from the enforcement side: a secret the spec declares
 * required-at-boot can never silently drop out of the validate-startup lists
 * without failing this test.
 *
 * The "correct validate-startup path" (P0-5 acceptance) is captured by unioning the
 * alias groups: POSTGRES_URL is required via REQUIRED_ALWAYS_GROUPS
 * (['POSTGRES_URL','DATABASE_URL']), not the flat REQUIRED_IN_PRODUCTION_HOSTED list.
 *
 * Both imports are pure leaf modules (required-env.ts + secret-paths.ts), so this
 * test is hermetic — it does not load validate-startup's db/orm/config chain.
 *
 * Zero authored regex — Set membership only (fleet no-regex posture).
 */

import { describe, expect, it } from 'vitest';
import {
  REQUIRED_ALWAYS_GROUPS,
  REQUIRED_IN_PRODUCTION_HOSTED,
} from '../../../apps/server/src/lib/required-env.js';
import { SECRET_PATHS } from '../secret-paths.js';

// Every env var validate-startup enforces at hosted-prod boot: the flat required
// list plus every name in an always-required alias group (a group is satisfied
// when ANY member is set, so each member is an accepted enforcer of that secret).
const ENFORCED_AT_BOOT: ReadonlySet<string> = new Set([
  ...REQUIRED_IN_PRODUCTION_HOSTED,
  ...REQUIRED_ALWAYS_GROUPS.flat(),
]);

const flaggedEntries = SECRET_PATHS.filter((d) => d.requiredInProdHosted);

describe('prod-required coverage (GAP-259 P0-5)', () => {
  it('has requiredInProdHosted entries to check', () => {
    expect(flaggedEntries.length).toBeGreaterThan(0);
  });

  it('every requiredInProdHosted spec entry declares its envVars', () => {
    for (const entry of flaggedEntries) {
      expect(
        entry.envVars,
        `${entry.path} is requiredInProdHosted but declares no envVars`,
      ).toBeDefined();
      expect(entry.envVars?.length ?? 0, `${entry.path} envVars is empty`).toBeGreaterThan(0);
    }
  });

  it('REQUIRED_IN_PRODUCTION_HOSTED ∪ alias groups ⊇ every flagged entry env var', () => {
    for (const entry of flaggedEntries) {
      for (const envVar of entry.envVars ?? []) {
        expect(
          ENFORCED_AT_BOOT.has(envVar),
          `${entry.path} → ${envVar} is flagged requiredInProdHosted but is NOT enforced at ` +
            'boot (missing from both REQUIRED_IN_PRODUCTION_HOSTED and REQUIRED_ALWAYS_GROUPS ' +
            'in apps/server/src/lib/required-env.ts)',
        ).toBe(true);
      }
    }
  });
});
