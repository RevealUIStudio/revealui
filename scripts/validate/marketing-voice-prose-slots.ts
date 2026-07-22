// console-allowed
/**
 * Marketing-voice prose-slot freshness gate (source + dist when present).
 *
 * VES session patches on fleet-marketing use block types like `section` /
 * `ctaSection`. The voice engine fail-closes on unmapped types. Source can
 * list those slots while a stale local `packages/contracts/dist` still only
 * has hero/content/cta (dogfood 2026-07-22: 422 unmapped blockType section).
 *
 * - Always validates **source** MARKETING_PROSE_SLOTS keys (CI SoT).
 * - If **dist** exists, validates the same keys on dist (stale local dist fails).
 * - If dist is missing, source-pass is enough. Dist is gitignored; Quality CI
 *   never has a prior monorepo build, and a full `@revealui/contracts` tsc needs
 *   `@revealui/db` — so this gate must not try to build contracts here.
 *
 * Usage: `pnpm validate:marketing-voice-prose-slots`
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_BLOCKS = path.join(ROOT, 'packages/contracts/dist/marketing-voice/blocks.js');
const SOURCE_BLOCKS = path.join(ROOT, 'packages/contracts/src/marketing-voice/blocks.ts');

/** Must stay in lockstep with packages/contracts/src/marketing-voice/blocks.ts. */
const REQUIRED_SLOTS = [
  'hero',
  'content',
  'cta',
  'section',
  'ctaSection',
  'text',
  'heading',
  'quote',
  'list',
  'divider',
  'spacer',
] as const;

function missingKeys(slots: Record<string, unknown>): string[] {
  return REQUIRED_SLOTS.filter((k) => !(k in slots));
}

async function loadSlots(filePath: string): Promise<Record<string, string[]>> {
  const mod = (await import(pathToFileURL(filePath).href)) as {
    MARKETING_PROSE_SLOTS?: Record<string, string[]>;
  };
  if (!mod.MARKETING_PROSE_SLOTS || typeof mod.MARKETING_PROSE_SLOTS !== 'object') {
    throw new Error(`MARKETING_PROSE_SLOTS not exported from ${path.relative(ROOT, filePath)}`);
  }
  return mod.MARKETING_PROSE_SLOTS;
}

async function main(): Promise<void> {
  const sourceSlots = await loadSlots(SOURCE_BLOCKS);
  const sourceMissing = missingKeys(sourceSlots);
  if (sourceMissing.length > 0) {
    console.error(`[marketing-voice-prose-slots] SOURCE missing keys: ${sourceMissing.join(', ')}`);
    process.exit(1);
  }
  console.log('[marketing-voice-prose-slots] source OK');

  if (!existsSync(DIST_BLOCKS)) {
    console.log(
      '[marketing-voice-prose-slots] dist absent (ok) — source passed; ' +
        'run `pnpm --filter @revealui/contracts build` before local API dogfood',
    );
    process.exit(0);
  }

  const distSlots = await loadSlots(DIST_BLOCKS);
  const distMissing = missingKeys(distSlots);
  if (distMissing.length > 0) {
    console.error(
      `[marketing-voice-prose-slots] DIST missing keys: ${distMissing.join(', ')}\n` +
        `  Present: ${Object.keys(distSlots).sort().join(', ')}\n` +
        '  Rebuild: pnpm --filter @revealui/contracts build\n' +
        '  (Stale dist → VES voice gate 422: unmapped blockType section)',
    );
    process.exit(1);
  }

  console.log(
    `[marketing-voice-prose-slots] OK — ${REQUIRED_SLOTS.length} required slots in source + dist`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
