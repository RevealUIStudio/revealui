import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Drift guard: seed-stripe.ts MUST use StripeConstructor.API_VERSION
 * for every apiVersion / api_version slot, never a hardcoded date literal.
 *
 * History: PR #637 consolidated apiVersion references across the codebase
 * to use Stripe.API_VERSION so SDK upgrades auto-track the API version in
 * lockstep. That consolidation missed the webhook-endpoint create call at
 * line 708 (snake_case `api_version:` vs camelCase `apiVersion:` grep miss),
 * leaving a stale `2026-01-28.clover` literal while the runtime SDK was
 * pinned to `2026-04-22.dahlia`. Result: first live `pnpm stripe:seed`
 * would create the webhook at the clover shape; the runtime handler reads
 * the dahlia shape (`invoice.parent?.subscription_details?.subscription`),
 * which is `undefined` on clover payloads, silently no-op'ing the
 * post-refund subscription-cancel cascade.
 *
 * This test fails the build if any future change reintroduces a hardcoded
 * apiVersion date string in seed-stripe.ts. Uses string-method predicates
 * (no regex) per the fleet no-regex hardline.
 */
describe('seed-stripe.ts apiVersion drift guard', () => {
  it('uses StripeConstructor.API_VERSION exclusively (no hardcoded date strings)', async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const seedStripePath = resolve(here, '..', 'seed-stripe.ts');
    const content = await readFile(seedStripePath, 'utf8');

    const lines = content.split('\n');
    const violations: Array<{ lineNum: number; text: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lower = line.toLowerCase();

      // Find either snake_case or camelCase apiVersion keyword.
      const snakeIdx = lower.indexOf('api_version:');
      const camelIdx = lower.indexOf('apiversion:');
      const keyIdx = snakeIdx !== -1 ? snakeIdx : camelIdx;
      if (keyIdx === -1) continue;

      // Look at what follows the colon for a quoted Stripe date literal:
      // either '20XX-... or "20XX-... (Stripe API versions are date-shaped).
      const after = line.slice(keyIdx);
      const hasQuotedDateLiteral = after.includes("'20") || after.includes('"20');

      if (hasQuotedDateLiteral) {
        violations.push({ lineNum: i + 1, text: line.trim() });
      }
    }

    expect(
      violations,
      `seed-stripe.ts must use StripeConstructor.API_VERSION, not hardcoded apiVersion date literals. ` +
        `Found ${violations.length} violation(s): ${JSON.stringify(violations, null, 2)}`,
    ).toEqual([]);
  });
});
