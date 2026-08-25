import type { Manifest } from './schemas/manifest.js';

/**
 * Always-on rule ids for adapters that cannot ingest the full rule dump.
 *
 * Union of preamble tier 1 `ruleIds` and any rule with `preambleTier === 1`
 * so a definition cannot drift out of the constitution by forgetting the
 * preamble list (or the reverse).
 */
export function alwaysOnRuleIds(manifest: Manifest): Set<string> {
  const ids = new Set(manifest.preambles.find((p) => p.tier === 1)?.ruleIds ?? []);
  for (const rule of manifest.rules) {
    if (rule.preambleTier === 1) {
      ids.add(rule.id);
    }
  }
  return ids;
}
